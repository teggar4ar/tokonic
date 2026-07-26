export function isConfirmedStorageNotFound(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { name?: unknown; status?: unknown; statusCode?: unknown };
  const status = value.statusCode ?? value.status;
  return status === 404 || status === "404";
}
