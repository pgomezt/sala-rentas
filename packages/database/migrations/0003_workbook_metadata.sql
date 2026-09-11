CREATE TABLE raw.workbooks (
  file_version_id uuid PRIMARY KEY REFERENCES control.file_versions(id),
  reader_name text NOT NULL,
  reader_version text NOT NULL,
  date_system text NOT NULL CHECK (date_system IN ('1900', '1904')),
  sheet_manifest jsonb NOT NULL CHECK (jsonb_typeof(sheet_manifest) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER preserve_workbook_metadata BEFORE UPDATE OR DELETE ON raw.workbooks
FOR EACH ROW EXECUTE FUNCTION control.reject_immutable_change();
CREATE TRIGGER preserve_workbook_truncate BEFORE TRUNCATE ON raw.workbooks
FOR EACH STATEMENT EXECUTE FUNCTION control.reject_immutable_change();
