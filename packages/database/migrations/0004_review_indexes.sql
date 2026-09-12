CREATE INDEX record_run_id_idx ON core.records(load_run_id, id);
CREATE INDEX record_review_date_idx ON core.records(load_run_id, (COALESCE(legalization_date, expedition_date)));
CREATE INDEX issue_record_idx ON quality.issues(record_id);
CREATE INDEX review_issue_idx ON quality.review_events(issue_id, created_at);
