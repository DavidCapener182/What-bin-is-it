import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const allowedImageSizeAdvisories = new Map([
  [
    1138808,
    {
      name: "image-size",
      range: "<=2.0.2",
      url: "https://github.com/advisories/GHSA-w3rx-r6r6-pgpr",
    },
  ],
  [
    1138809,
    {
      name: "image-size",
      range: "<=2.0.2",
      url: "https://github.com/advisories/GHSA-5p2g-fcmc-qvqq",
    },
  ],
]);

const expectedImageSizeInstallation = {
  version: "1.2.1",
  nodePath: "node_modules/image-size",
  metroRange: "^1.0.2",
};

function fail(message, detail) {
  console.error(`Production dependency audit failed: ${message}`);
  if (detail) console.error(detail);
  process.exit(1);
}

const audit = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["audit", "--omit=dev", "--audit-level=high", "--json"],
  { encoding: "utf8" },
);

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  fail("npm audit did not return valid JSON.", audit.stderr || audit.stdout);
}

if (audit.error) fail("npm audit could not run.", audit.error.message);

const vulnerabilities = report.vulnerabilities ?? {};
const blockingSeverities = new Set(["high", "critical"]);

function advisoryIsAllowed(advisory) {
  if (!advisory || typeof advisory !== "object") return false;
  const expected = allowedImageSizeAdvisories.get(advisory.source);
  return Boolean(
    expected &&
      advisory.name === expected.name &&
      advisory.dependency === expected.name &&
      advisory.range === expected.range &&
      advisory.url === expected.url,
  );
}

function traceAdvisories(name, visiting = new Set()) {
  if (visiting.has(name)) return { foundAllowed: false, valid: true };
  const vulnerability = vulnerabilities[name];
  if (!vulnerability) return { foundAllowed: false, valid: false };

  const nextVisiting = new Set(visiting).add(name);
  const via = Array.isArray(vulnerability.via) ? vulnerability.via : [];
  if (via.length === 0) return { foundAllowed: false, valid: false };

  let foundAllowed = false;
  for (const cause of via) {
    if (typeof cause === "string") {
      const traced = traceAdvisories(cause, nextVisiting);
      if (!traced.valid) return traced;
      foundAllowed ||= traced.foundAllowed;
      continue;
    }
    if (!advisoryIsAllowed(cause)) {
      return { foundAllowed: false, valid: false };
    }
    foundAllowed = true;
  }

  return { foundAllowed, valid: true };
}

function tracesOnlyToAllowedAdvisories(name) {
  const traced = traceAdvisories(name);
  return traced.valid && traced.foundAllowed;
}

const blocking = Object.entries(vulnerabilities).filter(
  ([, vulnerability]) => blockingSeverities.has(vulnerability.severity),
);
const rejected = blocking.filter(
  ([name]) => !tracesOnlyToAllowedAdvisories(name),
);

if (rejected.length > 0) {
  const summary = rejected
    .map(([name, vulnerability]) => `${name} (${vulnerability.severity})`)
    .join(", ");
  fail("unapproved high or critical advisories remain.", summary);
}

const imageSizeVulnerability = vulnerabilities["image-size"];
if (imageSizeVulnerability) {
  const nodes = imageSizeVulnerability.nodes ?? [];
  const imageSizePackage = JSON.parse(
    readFileSync(new URL("../node_modules/image-size/package.json", import.meta.url)),
  );
  const packageLock = JSON.parse(
    readFileSync(new URL("../package-lock.json", import.meta.url)),
  );
  const metroRange =
    packageLock.packages?.["node_modules/metro"]?.dependencies?.["image-size"];

  if (
    imageSizePackage.version !== expectedImageSizeInstallation.version ||
    nodes.length !== 1 ||
    nodes[0] !== expectedImageSizeInstallation.nodePath ||
    metroRange !== expectedImageSizeInstallation.metroRange
  ) {
    fail(
      "the temporary image-size exception no longer matches the reviewed SDK 57 dependency path.",
      `Found version=${imageSizePackage.version}, nodes=${nodes.join(",")}, metro range=${metroRange}.`,
    );
  }

  const advisoryIds = new Set(
    imageSizeVulnerability.via
      .filter((cause) => cause && typeof cause === "object")
      .map((cause) => cause.source),
  );
  if (
    advisoryIds.size !== allowedImageSizeAdvisories.size ||
    [...allowedImageSizeAdvisories.keys()].some((id) => !advisoryIds.has(id))
  ) {
    fail("the image-size advisory set has changed and requires review.");
  }

  console.warn(
    "Production audit passed with one narrowly reviewed upstream exception: " +
      "Metro 0.84.4 requires image-size ^1.0.2, npm latest is 2.0.2, and both " +
      "the installed and latest published releases are covered by GHSA-w3rx-r6r6-pgpr and " +
      "GHSA-5p2g-fcmc-qvqq. Every other high or critical advisory remains blocking.",
  );
} else if (blocking.length > 0) {
  fail("unexpected blocking advisories were not evaluated.");
} else {
  console.log("Production dependency audit passed with no high or critical advisories.");
}
