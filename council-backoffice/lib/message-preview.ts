import type { CouncilDisruption } from "@/lib/types";

export type ActiveDisruptionContext = Pick<CouncilDisruption, "id" | "title" | "startsAt" | "endsAt">;

function timestamp(value?: string) {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function publishedDisruptionContexts(
  disruptions: CouncilDisruption[],
  now = new Date(),
): ActiveDisruptionContext[] {
  const nowTimestamp = now.getTime();
  return disruptions.filter((disruption) => {
    const endTimestamp = timestamp(disruption.endsAt);
    return disruption.status === "published" && (endTimestamp === undefined || endTimestamp > nowTimestamp);
  }).map(({ id, title, startsAt, endsAt }) => ({ id, title, startsAt, endsAt }));
}

export function overlappingDisruptionTitles(
  candidate: { startsAt?: string; endsAt?: string },
  disruptions: ActiveDisruptionContext[],
  now = new Date(),
) {
  const candidateStart = timestamp(candidate.startsAt) ?? now.getTime();
  const candidateEnd = timestamp(candidate.endsAt) ?? Number.POSITIVE_INFINITY;
  if (candidateEnd <= candidateStart) return [];

  return disruptions.filter((disruption) => {
    const disruptionStart = timestamp(disruption.startsAt);
    if (disruptionStart === undefined) return false;
    const disruptionEnd = timestamp(disruption.endsAt) ?? Number.POSITIVE_INFINITY;
    return candidateStart < disruptionEnd && disruptionStart < candidateEnd;
  }).map((disruption) => disruption.title);
}
