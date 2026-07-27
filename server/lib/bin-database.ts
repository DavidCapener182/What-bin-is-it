import postgres from 'postgres';

let sqlClient: ReturnType<typeof postgres> | undefined;

export function binDatabase() {
  const databaseUrl = process.env.BIN_DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('Bin app database storage is not configured.');
  if (!sqlClient) {
    sqlClient = postgres(databaseUrl, {
      max: 1,
      prepare: false,
      connect_timeout: 10,
      idle_timeout: 20,
    });
  }
  return sqlClient;
}

export function binDatabaseConfigured() {
  return Boolean(process.env.BIN_DATABASE_URL?.trim());
}
