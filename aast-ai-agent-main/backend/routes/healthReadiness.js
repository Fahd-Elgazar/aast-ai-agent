function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isRagHealthReady(health) {
  if (health === true) return true;
  if (!isRecord(health)) return false;

  if (isRecord(health.retriever)) {
    return health.retriever.ok === true && health.retriever.endpoint_valid === true;
  }

  const status = String(health.status || "").toLowerCase();
  return health.ok === true && ["ok", "healthy", "ready"].includes(status);
}

export function areRequiredTopologyServicesReady(services, readiness) {
  if (!isRecord(services) || !isRecord(readiness)) return false;

  return Object.entries(services).every(([service, disposition]) => (
    disposition !== "required" || readiness[service] === true
  ));
}
