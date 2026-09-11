export interface HealthStatus {
  service: "web";
  status: "ok";
  configuration: "valid";
  database: "not_checked";
}
export function healthStatus(): HealthStatus {
  return { service: "web", status: "ok", configuration: "valid", database: "not_checked" };
}

