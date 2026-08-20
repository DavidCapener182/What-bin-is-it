import { NextRequest, NextResponse } from "next/server";

import { requireCouncilSession } from "@/lib/auth";
import { isConsoleE2eFixtureSession } from "@/lib/console-e2e-fixtures";
import { estimateCouncilAudience } from "@/lib/data";
import type { CouncilAudienceCriteria } from "@/lib/types";

const allowedCollectionTypes = new Set(["general", "recycling", "garden", "food", "other"]);

function stringList(value: unknown, maximum: number, predicate: (value: string) => boolean) {
  if (!Array.isArray(value) || value.length > maximum) return undefined;
  const result = [...new Set(value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean))];
  return result.every(predicate) ? result : undefined;
}

function parseAudience(value: unknown): CouncilAudienceCriteria | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (!Object.keys(record).every((key) => ["scope", "collectionTypes", "collectionDates", "audienceLabels"].includes(key))) return undefined;
  if (record.scope !== "council" && record.scope !== "targeted") return undefined;
  const collectionTypes = stringList(record.collectionTypes, 6, (item) => allowedCollectionTypes.has(item));
  const collectionDates = stringList(record.collectionDates, 24, (item) => /^\d{4}-\d{2}-\d{2}$/.test(item));
  const audienceLabels = stringList(record.audienceLabels, 24, (item) => /^[\p{L}\p{N}][\p{L}\p{N} .&'/-]{0,79}$/u.test(item));
  if (!collectionTypes || !collectionDates || !audienceLabels) return undefined;
  if (record.scope === "targeted" && !collectionTypes.length && !collectionDates.length && !audienceLabels.length) return undefined;
  return { scope: record.scope, collectionTypes: collectionTypes as CouncilAudienceCriteria["collectionTypes"], collectionDates, audienceLabels };
}

export async function POST(request: NextRequest) {
  const session = await requireCouncilSession("content:publish");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const audience = parseAudience(body);
  if (!audience) return NextResponse.json({ error: "Invalid audience." }, { status: 400 });
  const estimatedRecipientCount = isConsoleE2eFixtureSession(session)
    ? audience.scope === "council" ? 1_248 : 126
    : await estimateCouncilAudience(session, audience);
  return NextResponse.json({ estimatedRecipientCount }, { headers: { "Cache-Control": "private, no-store" } });
}
