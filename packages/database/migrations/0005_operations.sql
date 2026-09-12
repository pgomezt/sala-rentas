CREATE TABLE control.operation_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK(kind IN ('scan','process')),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','failed')),
 retry_of uuid REFERENCES control.operation_jobs(id),
 created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, finished_at timestamptz,
 error_code text, progress jsonb NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX one_active_operation ON control.operation_jobs((1)) WHERE status IN ('queued','running');
CREATE TABLE control.operation_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 job_id uuid NOT NULL REFERENCES control.operation_jobs(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 event jsonb NOT NULL
);
CREATE INDEX operation_event_job ON control.operation_events(job_id,id);
CREATE TRIGGER preserve_operation_events BEFORE UPDATE OR DELETE ON control.operation_events
FOR EACH ROW EXECUTE FUNCTION control.reject_immutable_change();
CREATE TABLE control.worker_state (
 id integer PRIMARY KEY CHECK(id=1), heartbeat_at timestamptz NOT NULL DEFAULT now()
);
