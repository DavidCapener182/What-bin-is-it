export const COUNCIL_AUTH_FETCH_TIMEOUT_MS = 8_000;

export const councilAuthFetch: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const upstreamSignal = init?.signal;
  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
  const timeout = setTimeout(() => {
    controller.abort(new Error("Council authentication service timed out."));
  }, COUNCIL_AUTH_FETCH_TIMEOUT_MS);

  if (upstreamSignal?.aborted) abortFromUpstream();
  else upstreamSignal?.addEventListener("abort", abortFromUpstream, { once: true });

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    upstreamSignal?.removeEventListener("abort", abortFromUpstream);
  }
};
