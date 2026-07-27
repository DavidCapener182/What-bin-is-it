const canonicalResidentApp = "https://what-bin-is-it-tonight.vercel.app";

function residentAppOrigin() {
  const configured = process.env.RESIDENT_APP_BASE_URL?.trim() || canonicalResidentApp;
  const url = new URL(configured);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/") {
    throw new Error("The resident app broadcast origin is invalid.");
  }
  return url.origin;
}

export async function requestCouncilBroadcast(jobId: string) {
  const secret = process.env.COUNCIL_BROADCAST_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("Council push delivery is not configured.");
  }
  const response = await fetch(`${residentAppOrigin()}/api/push/broadcasts/process`, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ jobId }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => undefined) as {
    status?: unknown;
    accepted?: unknown;
    failed?: unknown;
    error?: unknown;
  } | undefined;
  if (!response.ok) {
    throw new Error(
      typeof payload?.error === "string"
        ? payload.error
        : `Council push delivery failed with ${response.status}.`,
    );
  }
  return {
    status: typeof payload?.status === "string" ? payload.status : "processing",
    accepted: typeof payload?.accepted === "number" ? payload.accepted : 0,
    failed: typeof payload?.failed === "number" ? payload.failed : 0,
  };
}
