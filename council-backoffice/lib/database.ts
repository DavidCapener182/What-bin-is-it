import postgres from "postgres";

let client: ReturnType<typeof postgres> | undefined;

export function councilDatabase() {
  const databaseUrl = process.env.BIN_DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("Council back-office storage is not configured.");
  if (!client) {
    client = postgres(databaseUrl, {
      max: 3,
      prepare: false,
      connect_timeout: 10,
      idle_timeout: 20,
      transform: { undefined: null },
    });
  }
  return client;
}

export function councilDatabaseConfigured() {
  return Boolean(process.env.BIN_DATABASE_URL?.trim());
}
