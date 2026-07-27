import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const consoleDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceEnvironment = resolve(consoleDirectory, "..", ".env.local");

if (existsSync(workspaceEnvironment)) {
  loadEnvFile(workspaceEnvironment);
}

const environment = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL
    || process.env.EXPO_PUBLIC_SUPABASE_URL
    || "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    || "",
};

const nextExecutable = resolve(
  consoleDirectory,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);

const child = spawn(
  process.execPath,
  [nextExecutable, "dev", "--port", "3010", ...process.argv.slice(2)],
  {
    cwd: consoleDirectory,
    env: environment,
    stdio: "inherit",
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 0 : 1);
});
