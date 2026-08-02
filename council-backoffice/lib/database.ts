import postgres from "postgres";

let client: ReturnType<typeof postgres> | undefined;

export function councilDatabase() {
  const databaseUrl = process.env.BIN_DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("Council back-office storage is not configured.");
  if (!client) {
    const connectionUrl = new URL(databaseUrl);
    if (process.env.NODE_ENV !== "production" && connectionUrl.port === "6543") {
      // Supabase's session-mode pooler is steadier for a persistent local dev
      // server. Production serverless functions continue to use transaction
      // mode from the configured URL.
      connectionUrl.port = "5432";
    }
    client = postgres(connectionUrl.toString(), {
      // Vercel and local hot reload can create several application processes.
      // One connection per process avoids exhausting the Supabase pooler while
      // remaining ample for this low-volume private administration console.
      max: 1,
      prepare: false,
      connect_timeout: 10,
      idle_timeout: 20,
      max_lifetime: 60,
      connection: {
        application_name: "what-bin-council-console",
        statement_timeout: 10_000,
        lock_timeout: 5_000,
        idle_in_transaction_session_timeout: 10_000,
      },
      transform: { undefined: null },
    });
  }
  return client;
}

export function councilDatabaseConfigured() {
  return Boolean(process.env.BIN_DATABASE_URL?.trim());
}
