-- Provenance and load control. No business data is inserted by this migration.
CREATE SCHEMA control;
CREATE SCHEMA raw;

CREATE TABLE control.data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (btrim(name) <> ''),
  kind text NOT NULL CHECK (kind IN ('filesystem', 'google_drive')),
  location text NOT NULL CHECK (btrim(location) <> ''),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE control.source_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES control.data_sources(id),
  external_id text NOT NULL CHECK (btrim(external_id) <> ''),
  display_name text NOT NULL CHECK (btrim(display_name) <> ''),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  missing_since timestamptz,
  UNIQUE (source_id, external_id)
);
CREATE TABLE control.file_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file_id uuid NOT NULL REFERENCES control.source_files(id),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  original_storage_key text NOT NULL CHECK (btrim(original_storage_key) <> ''),
  source_modified_at timestamptz,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_file_id, sha256)
);
CREATE TABLE control.rule_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (btrim(name) <> ''),
  version text NOT NULL CHECK (btrim(version) <> ''),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);
CREATE TABLE control.load_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_version_id uuid NOT NULL REFERENCES control.file_versions(id),
  rule_set_id uuid NOT NULL REFERENCES control.rule_sets(id),
  parser_version text NOT NULL CHECK (btrim(parser_version) <> ''),
  idempotency_key text NOT NULL UNIQUE CHECK (btrim(idempotency_key) <> ''),
  dataset_kind text NOT NULL CHECK (dataset_kind IN ('REG', 'LEG')),
  -- scope_key identifies a reviewed, disjoint publication slot; never infer it from filename alone.
  scope_key text NOT NULL CHECK (btrim(scope_key) <> ''),
  coverage_start date,
  coverage_end date,
  load_mode text NOT NULL DEFAULT 'unclassified' CHECK (load_mode IN ('unclassified', 'snapshot', 'incremental')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'review', 'ready', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  rows_read bigint NOT NULL DEFAULT 0 CHECK (rows_read >= 0),
  rows_normalized bigint NOT NULL DEFAULT 0 CHECK (rows_normalized >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((coverage_start IS NULL) = (coverage_end IS NULL)),
  CHECK (coverage_start IS NULL OR coverage_start <= coverage_end),
  CHECK (finished_at IS NULL OR (started_at IS NOT NULL AND finished_at >= started_at)),
  CHECK (rows_normalized <= rows_read),
  UNIQUE (id, file_version_id, dataset_kind),
  UNIQUE (id, dataset_kind, scope_key)
);
CREATE INDEX load_runs_file_idx ON control.load_runs(file_version_id);

CREATE TABLE raw.rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_version_id uuid NOT NULL REFERENCES control.file_versions(id),
  sheet_name text NOT NULL CHECK (btrim(sheet_name) <> ''),
  row_number integer NOT NULL CHECK (row_number > 0),
  -- Ordered arrays preserve duplicate headers, cell positions, nulls and original type descriptors.
  headers jsonb NOT NULL CHECK (jsonb_typeof(headers) = 'array'),
  cells jsonb NOT NULL CHECK (jsonb_typeof(cells) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_array_length(headers) = jsonb_array_length(cells)),
  UNIQUE (file_version_id, sheet_name, row_number),
  UNIQUE (id, file_version_id)
);
CREATE FUNCTION control.reject_immutable_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Immutable project evidence cannot be modified' USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER preserve_raw_rows BEFORE UPDATE OR DELETE ON raw.rows
FOR EACH ROW EXECUTE FUNCTION control.reject_immutable_change();
CREATE TRIGGER preserve_raw_truncate BEFORE TRUNCATE ON raw.rows
FOR EACH STATEMENT EXECUTE FUNCTION control.reject_immutable_change();
CREATE TRIGGER preserve_versions BEFORE UPDATE OR DELETE ON control.file_versions
FOR EACH ROW EXECUTE FUNCTION control.reject_immutable_change();
CREATE TRIGGER preserve_rules BEFORE UPDATE OR DELETE ON control.rule_sets
FOR EACH ROW EXECUTE FUNCTION control.reject_immutable_change();

CREATE TABLE control.publications (
  dataset_kind text NOT NULL,
  scope_key text NOT NULL,
  load_run_id uuid NOT NULL UNIQUE,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by text NOT NULL CHECK (btrim(published_by) <> ''),
  PRIMARY KEY (dataset_kind, scope_key),
  FOREIGN KEY (load_run_id, dataset_kind, scope_key)
    REFERENCES control.load_runs(id, dataset_kind, scope_key)
);
CREATE FUNCTION control.validate_publication() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE selected_run control.load_runs;
BEGIN
  SELECT * INTO STRICT selected_run FROM control.load_runs WHERE id = NEW.load_run_id FOR UPDATE;
  IF selected_run.status <> 'ready' OR selected_run.load_mode <> 'snapshot'
    OR selected_run.coverage_start IS NULL OR selected_run.finished_at IS NULL THEN
    RAISE EXCEPTION 'Only complete, reviewed snapshot runs can be published' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER publication_guard BEFORE INSERT OR UPDATE ON control.publications
FOR EACH ROW EXECUTE FUNCTION control.validate_publication();
CREATE FUNCTION control.protect_published_run() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'ready' OR EXISTS (SELECT 1 FROM control.publications WHERE load_run_id = OLD.id) THEN
    RAISE EXCEPTION 'Published runs cannot be modified; publish a new run' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER published_run_guard BEFORE UPDATE ON control.load_runs
FOR EACH ROW EXECUTE FUNCTION control.protect_published_run();

CREATE TABLE control.publication_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_kind text NOT NULL,
  scope_key text NOT NULL,
  previous_load_run_id uuid REFERENCES control.load_runs(id),
  new_load_run_id uuid REFERENCES control.load_runs(id),
  actor text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION control.audit_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO control.publication_events(dataset_kind, scope_key, previous_load_run_id, actor)
    VALUES (OLD.dataset_kind, OLD.scope_key, OLD.load_run_id, current_user);
    RETURN OLD;
  END IF;
  INSERT INTO control.publication_events(dataset_kind, scope_key, previous_load_run_id, new_load_run_id, actor)
  VALUES (NEW.dataset_kind, NEW.scope_key, CASE WHEN TG_OP = 'UPDATE' THEN OLD.load_run_id ELSE NULL END,
    NEW.load_run_id, NEW.published_by);
  RETURN NEW;
END;
$$;
CREATE TRIGGER publication_audit AFTER INSERT OR UPDATE OR DELETE ON control.publications
FOR EACH ROW EXECUTE FUNCTION control.audit_publication();
CREATE TRIGGER preserve_publication_events BEFORE UPDATE OR DELETE ON control.publication_events
FOR EACH ROW EXECUTE FUNCTION control.reject_immutable_change();
CREATE TRIGGER preserve_publication_event_truncate BEFORE TRUNCATE ON control.publication_events
FOR EACH STATEMENT EXECUTE FUNCTION control.reject_immutable_change();
