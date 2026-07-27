import process from "node:process";

import postgres from "postgres";

function value(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

const required = {
  provider: value("--provider"),
  slug: value("--slug"),
  council: value("--council"),
  email: value("--email")?.toLowerCase(),
  role: value("--role"),
};
const missing = Object.entries(required).filter(([, item]) => !item).map(([key]) => key);
if (missing.length) {
  console.error(`Missing required arguments: ${missing.join(", ")}`);
  console.error("Usage: npm run staff:bootstrap -- --provider lad-e00000000 --slug example --council \"Example Council\" --email staff@example.gov.uk --role owner --apply");
  process.exit(1);
}
if (!/^lad-[ensw]\d{8}$/.test(required.provider)) throw new Error("Provider ID is invalid.");
if (!/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/.test(required.slug)) throw new Error("Slug is invalid.");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(required.email)) throw new Error("Email is invalid.");
if (!["owner", "admin", "editor", "analyst", "support"].includes(required.role)) throw new Error("Role is invalid.");
if (!process.env.BIN_DATABASE_URL) throw new Error("BIN_DATABASE_URL is required.");
if (!process.argv.includes("--apply")) {
  console.log(JSON.stringify({
    dryRun: true,
    action: "Provision council staff membership",
    providerId: required.provider,
    council: required.council,
    email: required.email,
    role: required.role,
  }, null, 2));
  console.log("No changes made. Repeat with --apply after checking the exact council, email and role.");
  process.exit(0);
}

const sql = postgres(process.env.BIN_DATABASE_URL, { max: 1, ssl: "require" });
try {
  const result = await sql.begin(async (tx) => {
    const users = await tx`
      SELECT id FROM auth.users
      WHERE lower(email) = ${required.email}
      LIMIT 1
    `;
    if (!users[0]) {
      throw new Error("That email does not have a Supabase Auth account yet. Create the account through the approved Supabase Auth onboarding process before assigning a council role.");
    }
    const organisations = await tx`
      INSERT INTO bin_council_organisations (provider_id, slug, name, status, plan_tier)
      VALUES (${required.provider}, ${required.slug}, ${required.council}, 'pilot', 'pilot')
      ON CONFLICT (provider_id) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = now()
      RETURNING id, provider_id, name
    `;
    const organisation = organisations[0];
    await tx`
      INSERT INTO bin_council_staff (organisation_id, user_id, role, status)
      VALUES (${organisation.id}::uuid, ${users[0].id}::uuid, ${required.role}, 'active')
      ON CONFLICT (organisation_id, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        status = 'active',
        updated_at = now()
    `;
    return { organisation, userId: users[0].id };
  });
  console.log(JSON.stringify({
    applied: true,
    organisation: result.organisation.name,
    providerId: result.organisation.provider_id,
    userId: result.userId,
    role: required.role,
  }, null, 2));
} finally {
  await sql.end({ timeout: 2 });
}
