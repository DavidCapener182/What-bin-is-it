import assert from "node:assert/strict";
import test from "node:test";

import {
  overlappingDisruptionTitles,
  publishedDisruptionContexts,
} from "../lib/message-preview.ts";

const now = new Date("2026-08-11T10:00:00.000Z");

function disruption(overrides = {}) {
  return {
    id: "123e4567-e89b-42d3-a456-426614174000",
    title: "Collection delay",
    detail: "Crews are delayed.",
    collectionTypes: ["general"],
    areaLabels: [],
    cause: "operational",
    residentInstruction: "Leave the bin out.",
    status: "published",
    startsAt: "2026-08-11T09:00:00.000Z",
    endsAt: "2026-08-11T14:00:00.000Z",
    audience: { scope: "council", collectionTypes: [], collectionDates: [], audienceLabels: [] },
    updatedAt: "2026-08-11T09:00:00.000Z",
    ...overrides,
  };
}

test("message preview receives only published disruption windows that have not ended", () => {
  const contexts = publishedDisruptionContexts([
    disruption(),
    disruption({ id: "223e4567-e89b-42d3-a456-426614174000", status: "draft" }),
    disruption({ id: "323e4567-e89b-42d3-a456-426614174000", endsAt: "2026-08-11T08:00:00.000Z" }),
  ], now);

  assert.deepEqual(contexts, [{
    id: "123e4567-e89b-42d3-a456-426614174000",
    title: "Collection delay",
    startsAt: "2026-08-11T09:00:00.000Z",
    endsAt: "2026-08-11T14:00:00.000Z",
  }]);
});

test("message preview warns only when publishing windows overlap", () => {
  const contexts = publishedDisruptionContexts([disruption()], now);

  assert.deepEqual(overlappingDisruptionTitles({
    startsAt: "2026-08-11T12:00:00.000Z",
    endsAt: "2026-08-11T16:00:00.000Z",
  }, contexts, now), ["Collection delay"]);
  assert.deepEqual(overlappingDisruptionTitles({
    startsAt: "2026-08-11T14:00:00.000Z",
    endsAt: "2026-08-11T16:00:00.000Z",
  }, contexts, now), []);
  assert.deepEqual(overlappingDisruptionTitles({
    startsAt: "2026-08-11T16:00:00.000Z",
    endsAt: "2026-08-11T12:00:00.000Z",
  }, contexts, now), []);
});
