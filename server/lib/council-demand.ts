import { findCouncilByProviderId } from '../../src/lib/council-directory.ts';

import { binDatabase } from './bin-database';
import { ensurePilotCouncilWorkspaces, isPilotParticipantId } from './pilot-analytics';

export type CouncilDemandRequest = {
  installationId: string;
  councilId: string;
  notifyRequested: boolean;
};

const providerPattern = /^lad-[ensw][0-9]{8}$/;

export function parseCouncilDemandRequest(value: unknown): CouncilDemandRequest {
  if (!value || typeof value !== 'object') throw new Error('The council request is invalid.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !['installationId', 'councilId', 'notifyRequested'].includes(key))) {
    throw new Error('The council request contains an invalid field.');
  }
  if (!isPilotParticipantId(input.installationId)) throw new Error('The installation reference is invalid.');
  if (
    typeof input.councilId !== 'string'
    || !providerPattern.test(input.councilId)
    || !findCouncilByProviderId(input.councilId)
  ) {
    throw new Error('The selected council is invalid.');
  }
  if (typeof input.notifyRequested !== 'boolean') throw new Error('Choose whether to receive a connection update.');
  return {
    installationId: input.installationId,
    councilId: input.councilId,
    notifyRequested: input.notifyRequested,
  };
}

export async function saveCouncilDemandRequest(input: CouncilDemandRequest) {
  await ensurePilotCouncilWorkspaces([input.councilId]);
  const sql = binDatabase();
  const rows = await sql<{ request_count: number; notify_requested: boolean }[]>`
    INSERT INTO bin_council_demand_requests (
      council_id,
      installation_id,
      notify_requested
    ) VALUES (
      ${input.councilId},
      ${input.installationId}::uuid,
      ${input.notifyRequested}
    )
    ON CONFLICT (council_id, installation_id) DO UPDATE SET
      notify_requested = bin_council_demand_requests.notify_requested OR excluded.notify_requested,
      last_requested_at = now(),
      request_count = least(bin_council_demand_requests.request_count + 1, 1000)
    RETURNING request_count, notify_requested
  `;
  return {
    requested: true,
    notifyRequested: rows[0]?.notify_requested ?? input.notifyRequested,
  };
}
