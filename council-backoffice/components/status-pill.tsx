export function StatusPill({ status }: { status: string }) {
  const normalised = status.toLowerCase().replace(/[^a-z-]/g, "");
  return <span className={`status-pill status-${normalised}`}>{status.replaceAll("-", " ")}</span>;
}
