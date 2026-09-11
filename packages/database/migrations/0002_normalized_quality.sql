CREATE SCHEMA core;
CREATE SCHEMA quality;
CREATE SCHEMA analytics;

CREATE TABLE core.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nit text CHECK (nit IS NULL OR nit ~ '^[0-9]+$'),
  check_digit text CHECK (check_digit IS NULL OR check_digit ~ '^[0-9]$'),
  canonical_name text NOT NULL CHECK (btrim(canonical_name) <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Deliberately not unique: identity/alias approval must handle conflicting source NITs.
CREATE INDEX company_nit_idx ON core.companies(nit);
CREATE TABLE core.company_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES core.companies(id),
  original_name text NOT NULL,
  normalized_name text NOT NULL CHECK (btrim(normalized_name) <> ''),
  approved_by text NOT NULL CHECK (btrim(approved_by) <> ''),
  approved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, original_name)
);
CREATE INDEX company_alias_lookup_idx ON core.company_aliases(normalized_name);

CREATE TABLE core.records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_run_id uuid NOT NULL,
  file_version_id uuid NOT NULL,
  raw_row_id uuid NOT NULL,
  dataset_kind text NOT NULL CHECK (dataset_kind IN ('REG', 'LEG')),
  document_number_original text,
  document_number_normalized text,
  issuing_department_code text CHECK (issuing_department_code IS NULL OR issuing_department_code ~ '^[0-9]{2}$'),
  document_sequence text,
  identity_rule_version text,
  document_year integer CHECK (document_year IS NULL OR document_year BETWEEN 1900 AND 2100),
  document_type text,
  invoice text,
  expedition_date date,
  legalization_date date,
  expiry_date date,
  origin_label text,
  destination_label text,
  origin_divipola text CHECK (origin_divipola IS NULL OR origin_divipola ~ '^([0-9]{2}|[0-9]{5})$'),
  destination_divipola text CHECK (destination_divipola IS NULL OR destination_divipola ~ '^([0-9]{2}|[0-9]{5})$'),
  origin_company_id uuid REFERENCES core.companies(id),
  destination_company_id uuid REFERENCES core.companies(id),
  quantity numeric(24,6),
  quantity_unit text,
  declared_amount numeric(24,2),
  currency text NOT NULL DEFAULT 'COP' CHECK (currency ~ '^[A-Z]{3}$'),
  source_days_remaining numeric(12,3),
  normalized_fields jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(normalized_fields) = 'object'),
  quality_status text NOT NULL DEFAULT 'pending' CHECK (quality_status IN ('pending','valid','warning','quarantine')),
  eligible_for_quantity boolean NOT NULL DEFAULT false,
  eligible_for_amount boolean NOT NULL DEFAULT false,
  eligible_for_timeliness boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (load_run_id, file_version_id, dataset_kind)
    REFERENCES control.load_runs(id, file_version_id, dataset_kind),
  FOREIGN KEY (raw_row_id, file_version_id) REFERENCES raw.rows(id, file_version_id),
  UNIQUE (load_run_id, raw_row_id),
  UNIQUE (id, load_run_id),
  CHECK (NOT eligible_for_quantity OR (quantity IS NOT NULL AND quantity >= 0 AND quantity <> 'NaN'::numeric AND quantity_unit IS NOT NULL AND btrim(quantity_unit) <> '')),
  CHECK (NOT eligible_for_amount OR (declared_amount IS NOT NULL AND declared_amount >= 0 AND declared_amount <> 'NaN'::numeric)),
  CHECK (NOT eligible_for_timeliness OR (dataset_kind = 'LEG' AND legalization_date IS NOT NULL AND expiry_date IS NOT NULL)),
  CHECK (quality_status NOT IN ('pending','quarantine') OR
    NOT (eligible_for_quantity OR eligible_for_amount OR eligible_for_timeliness))
);
-- Search index, NOT unique: equal numbers must not discard business rows.
CREATE INDEX record_document_idx ON core.records(dataset_kind, document_year, document_number_normalized);
CREATE INDEX record_dates_idx ON core.records(dataset_kind, expedition_date, legalization_date);
CREATE INDEX record_raw_idx ON core.records(raw_row_id);

CREATE TABLE quality.issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_run_id uuid NOT NULL REFERENCES control.load_runs(id),
  record_id uuid,
  rule_code text NOT NULL CHECK (btrim(rule_code) <> ''),
  field_name text,
  severity text NOT NULL CHECK (severity IN ('info','warning','error')),
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (record_id, load_run_id) REFERENCES core.records(id, load_run_id)
);
CREATE INDEX issue_run_idx ON quality.issues(load_run_id, severity);
CREATE TABLE quality.review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES quality.issues(id),
  action text NOT NULL CHECK (action IN ('acknowledge','propose_correction','resolve','reopen')),
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  proposed_value jsonb,
  actor text NOT NULL CHECK (btrim(actor) <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER preserve_reviews BEFORE UPDATE OR DELETE ON quality.review_events
FOR EACH ROW EXECUTE FUNCTION control.reject_immutable_change();
CREATE TRIGGER preserve_review_truncate BEFORE TRUNCATE ON quality.review_events
FOR EACH STATEMENT EXECUTE FUNCTION control.reject_immutable_change();

-- Published normalized results are snapshots; corrections belong to a new load run.
CREATE FUNCTION core.protect_published_records() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_run uuid; new_run uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_run := OLD.load_run_id; END IF;
  IF TG_OP <> 'DELETE' THEN new_run := NEW.load_run_id; END IF;
  PERFORM 1 FROM control.load_runs WHERE id IN (old_run, new_run) ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM control.load_runs WHERE id IN (old_run, new_run) AND status = 'ready') THEN
    RAISE EXCEPTION 'Published records are immutable' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER published_record_guard BEFORE INSERT OR UPDATE OR DELETE ON core.records
FOR EACH ROW EXECUTE FUNCTION core.protect_published_records();
CREATE TRIGGER preserve_record_truncate BEFORE TRUNCATE ON core.records
FOR EACH STATEMENT EXECUTE FUNCTION control.reject_immutable_change();

CREATE VIEW analytics.published_records AS
SELECT r.* FROM core.records r JOIN control.publications p ON p.load_run_id = r.load_run_id;
CREATE VIEW analytics.expeditions AS SELECT * FROM analytics.published_records WHERE dataset_kind = 'REG';
CREATE VIEW analytics.legalizations AS SELECT * FROM analytics.published_records WHERE dataset_kind = 'LEG';
CREATE VIEW analytics.load_summary AS
SELECT l.id AS load_run_id, l.dataset_kind, l.scope_key, l.status,
  r.quantity_unit, r.currency,
  count(r.id) AS source_records,
  count(r.id) FILTER (WHERE r.eligible_for_quantity) AS quantity_included,
  count(r.id) FILTER (WHERE NOT r.eligible_for_quantity) AS quantity_excluded,
  sum(r.quantity) FILTER (WHERE r.eligible_for_quantity) AS validated_quantity,
  count(r.id) FILTER (WHERE r.eligible_for_amount) AS amount_included,
  count(r.id) FILTER (WHERE NOT r.eligible_for_amount) AS amount_excluded,
  sum(r.declared_amount) FILTER (WHERE r.eligible_for_amount) AS validated_amount,
  count(r.id) FILTER (WHERE r.eligible_for_timeliness) AS timeliness_included
FROM control.load_runs l LEFT JOIN core.records r ON r.load_run_id = l.id
GROUP BY l.id, r.quantity_unit, r.currency;
COMMENT ON VIEW analytics.load_summary IS 'Per-load diagnostic totals only. Never sum overlapping versions; quantities require compatible units. Amounts are declared values, not proven tax revenue.';
