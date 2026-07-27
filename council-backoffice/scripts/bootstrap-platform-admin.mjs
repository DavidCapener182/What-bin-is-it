import process from "node:process";

import postgres from "postgres";

function value(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

const email = value("--email")?.toLowerCase();
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  throw new Error("Pass one exact account with --email person@example.gov.uk.");
}
if (!process.env.BIN_DATABASE_URL) throw new Error("BIN_DATABASE_URL is required.");

if (!process.argv.includes("--apply")) {
  console.log(JSON.stringify({
    dryRun: true,
    action: "Assign explicit What Bin platform superadmin",
    email,
  }, null, 2));
  console.log("No changes made. Repeat with --apply after checking the exact account.");
  process.exit(0);
}

const sql = postgres(process.env.BIN_DATABASE_URL, { max: 1, ssl: "require" });
try {
  const users = await sql`
    SELECT id
    FROM auth.users
    WHERE lower(email) = ${email}
    LIMIT 1
  `;
  if (!users[0]) {
    throw new Error("That email does not have a Supabase Auth account yet. Create it through the approved Auth onboarding process first.");
  }
  const rows = await sql`
    INSERT INTO bin_council_platform_admins (user_id, status)
    VALUES (${users[0].id}::uuid, 'active')
    ON CONFLICT (user_id) DO UPDATE SET
      status = 'active',
      updated_at = now()
    RETURNING id, user_id, status
  `;
  console.log(JSON.stringify({
    applied: true,
    platformAdminId: rows[0].id,
    userId: rows[0].user_id,
    status: rows[0].status,
  }, null, 2));
} finally {
  await sql.end({ timeout: 2 });
}
