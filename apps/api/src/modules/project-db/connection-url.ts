/** Replace the database path segment of a Postgres URL. Local/dev only — stores plain text. */
export function rewriteDatabaseInUrl(adminUrl: string, databaseName: string): string {
  try {
    const u = new URL(adminUrl);
    u.pathname = `/${databaseName}`;
    return u.toString();
  } catch {
    return adminUrl.replace(/\/[^/?]+(\?|$)/, `/${databaseName}$1`);
  }
}
