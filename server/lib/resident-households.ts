import { createHash, randomBytes } from 'node:crypto';
import type postgres from 'postgres';

import { findCouncilByProviderId } from '../../src/lib/council-directory.ts';
import type { BinAccountUser } from './bin-auth.ts';
import { binDatabase } from './bin-database.ts';

type HouseholdRow = {
  id: string;
  council_provider_id: string;
  display_name: string;
  owner_user_id: string;
  role: 'owner' | 'member';
  created_at: Date;
};
type MemberRow = { household_id: string; user_id: string; display_name: string; role: 'owner' | 'member'; joined_at: Date };
type ActionRow = { id: number; household_id: string; actor_user_id: string; responsible_user_id: string | null; collection_date: string | Date; waste_type: string; action: string; occurred_at: Date };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const wasteTypes = new Set(['general', 'recycling', 'garden', 'food', 'other']);
const actionTypes = new Set(['assigned', 'put-out', 'collected', 'missed', 'brought-in']);

export class ResidentHouseholdOperationError extends Error {
  readonly code: 'HOUSEHOLD_ACCESS_DENIED' | 'HOUSEHOLD_INVITE_INVALID';
  readonly status: 403 | 409;

  constructor(
    code: 'HOUSEHOLD_ACCESS_DENIED' | 'HOUSEHOLD_INVITE_INVALID',
    message: string,
    status: 403 | 409,
  ) {
    super(message);
    this.name = 'ResidentHouseholdOperationError';
    this.code = code;
    this.status = status;
  }
}

function text(value: unknown, label: string, maximum: number) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  const result = value.trim();
  if (result.length > maximum) throw new Error(`${label} is too long.`);
  return result;
}
function uuid(value: unknown, label: string) {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new Error(`${label} is invalid.`);
  return value.toLowerCase();
}
function isoDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T12:00:00Z`))) throw new Error('Collection date is invalid.');
  return value;
}
function tokenHash(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function parseCreateHousehold(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('The household is invalid.');
  const input = value as Record<string, unknown>;
  const councilProviderId = text(input.councilProviderId, 'Council', 120);
  if (!findCouncilByProviderId(councilProviderId)) throw new Error('The selected council is not recognised.');
  return {
    councilProviderId,
    displayName: text(input.displayName, 'Household name', 80),
    memberName: text(input.memberName, 'Your name', 60),
  };
}

export function parseHouseholdInvite(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('The invite request is invalid.');
  return { householdId: uuid((value as Record<string, unknown>).householdId, 'Household') };
}

export function parseJoinHousehold(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('The invite is invalid.');
  const input = value as Record<string, unknown>;
  const token = text(input.token, 'Invite', 200);
  if (!/^[A-Za-z0-9_-]{32,200}$/.test(token)) throw new Error('The invite is invalid.');
  return { token, memberName: text(input.memberName, 'Your name', 60) };
}

export function parseHouseholdAction(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('The household action is invalid.');
  const input = value as Record<string, unknown>;
  const wasteType = text(input.wasteType, 'Bin type', 20);
  const action = text(input.action, 'Action', 20);
  if (!wasteTypes.has(wasteType) || !actionTypes.has(action)) throw new Error('The household action is invalid.');
  return {
    householdId: uuid(input.householdId, 'Household'),
    collectionDate: isoDate(input.collectionDate),
    wasteType,
    action,
    responsibleUserId: input.responsibleUserId === undefined ? undefined : uuid(input.responsibleUserId, 'Responsible member'),
  };
}

async function requireMember(sql: postgres.Sql | postgres.TransactionSql, householdId: string, userId: string) {
  const rows = await sql<{ role: 'owner' | 'member' }[]>`
    SELECT role FROM bin_household_members
    WHERE household_id = ${householdId}::uuid AND user_id = ${userId}::uuid
    LIMIT 1
  `;
  if (!rows[0]) throw new ResidentHouseholdOperationError(
    'HOUSEHOLD_ACCESS_DENIED',
    'You are not a member of that household.',
    403,
  );
  return rows[0];
}

export async function listResidentHouseholds(userId: string) {
  const sql = binDatabase();
  const households = await sql<HouseholdRow[]>`
    SELECT h.id, h.council_provider_id, h.display_name, h.owner_user_id, m.role, h.created_at
    FROM bin_households h
    JOIN bin_household_members m ON m.household_id = h.id
    WHERE m.user_id = ${userId}::uuid AND h.status = 'active'
    ORDER BY h.created_at DESC
  `;
  if (!households.length) return [];
  const ids = households.map((item) => item.id);
  const [members, actions] = await Promise.all([
    sql<MemberRow[]>`
      SELECT household_id, user_id, display_name, role, joined_at
      FROM bin_household_members
      WHERE household_id = any(${ids}::uuid[])
      ORDER BY joined_at, user_id
    `,
    sql<ActionRow[]>`
      SELECT id, household_id, actor_user_id, responsible_user_id, collection_date, waste_type, action, occurred_at
      FROM bin_household_collection_actions
      WHERE household_id = any(${ids}::uuid[])
      ORDER BY occurred_at DESC
      LIMIT 200
    `,
  ]);
  return households.map((household) => ({
    id: household.id,
    councilProviderId: household.council_provider_id,
    displayName: household.display_name,
    role: household.role,
    createdAt: household.created_at.toISOString(),
    members: members.filter((member) => member.household_id === household.id).map((member) => ({
      id: member.user_id,
      displayName: member.display_name,
      role: member.role,
      joinedAt: member.joined_at.toISOString(),
    })),
    actions: actions.filter((action) => action.household_id === household.id).map((action) => ({
      id: String(action.id),
      actorUserId: action.actor_user_id,
      responsibleUserId: action.responsible_user_id ?? undefined,
      collectionDate: action.collection_date instanceof Date ? action.collection_date.toISOString().slice(0, 10) : String(action.collection_date).slice(0, 10),
      wasteType: action.waste_type,
      action: action.action,
      occurredAt: action.occurred_at.toISOString(),
    })),
  }));
}

export async function createResidentHousehold(user: BinAccountUser, input: ReturnType<typeof parseCreateHousehold>) {
  const sql = binDatabase();
  await sql.begin(async (transaction) => {
    const existing = await transaction<{ id: string }[]>`
      SELECT id FROM bin_households
      WHERE owner_user_id = ${user.id}::uuid AND council_provider_id = ${input.councilProviderId}
      LIMIT 1
    `;
    let householdId = existing[0]?.id;
    if (householdId) {
      await transaction`UPDATE bin_households SET display_name = ${input.displayName}, status = 'active', updated_at = now() WHERE id = ${householdId}::uuid`;
    } else {
      const created = await transaction<{ id: string }[]>`
        INSERT INTO bin_households (owner_user_id, council_provider_id, display_name)
        VALUES (${user.id}::uuid, ${input.councilProviderId}, ${input.displayName})
        RETURNING id
      `;
      householdId = created[0]?.id;
    }
    if (!householdId) throw new Error('The household could not be created.');
    await transaction`
      INSERT INTO bin_household_members (household_id, user_id, display_name, role)
      VALUES (${householdId}::uuid, ${user.id}::uuid, ${input.memberName}, 'owner')
      ON CONFLICT (household_id, user_id) DO UPDATE SET display_name = excluded.display_name, role = 'owner'
    `;
  });
  return listResidentHouseholds(user.id);
}

export async function createResidentHouseholdInvite(user: BinAccountUser, householdId: string) {
  const sql = binDatabase();
  const member = await requireMember(sql, householdId, user.id);
  if (member.role !== 'owner') throw new ResidentHouseholdOperationError(
    'HOUSEHOLD_ACCESS_DENIED',
    'Only the household owner can create an invite.',
    403,
  );
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await sql`
    INSERT INTO bin_household_invites (household_id, token_hash, created_by, expires_at)
    VALUES (${householdId}::uuid, ${tokenHash(token)}, ${user.id}::uuid, ${expiresAt})
  `;
  return { token, expiresAt: expiresAt.toISOString() };
}

export async function joinResidentHousehold(user: BinAccountUser, input: ReturnType<typeof parseJoinHousehold>) {
  const sql = binDatabase();
  await sql.begin(async (transaction) => {
    const invites = await transaction<{ id: string; household_id: string }[]>`
      SELECT id, household_id
      FROM bin_household_invites
      WHERE token_hash = ${tokenHash(input.token)}
        AND revoked_at IS NULL AND expires_at > now() AND uses < max_uses
      FOR UPDATE
    `;
    const invite = invites[0];
    if (!invite) throw new ResidentHouseholdOperationError(
      'HOUSEHOLD_INVITE_INVALID',
      'This invite has expired or is no longer valid.',
      409,
    );
    await transaction`
      INSERT INTO bin_household_members (household_id, user_id, display_name, role)
      VALUES (${invite.household_id}::uuid, ${user.id}::uuid, ${input.memberName}, 'member')
      ON CONFLICT (household_id, user_id) DO UPDATE SET display_name = excluded.display_name
    `;
    await transaction`UPDATE bin_household_invites SET uses = uses + 1 WHERE id = ${invite.id}::uuid`;
  });
  return listResidentHouseholds(user.id);
}

export async function recordResidentHouseholdAction(user: BinAccountUser, input: ReturnType<typeof parseHouseholdAction>) {
  const sql = binDatabase();
  await requireMember(sql, input.householdId, user.id);
  if (input.responsibleUserId) await requireMember(sql, input.householdId, input.responsibleUserId);
  await sql`
    INSERT INTO bin_household_collection_actions (
      household_id, actor_user_id, responsible_user_id, collection_date, waste_type, action
    ) VALUES (
      ${input.householdId}::uuid, ${user.id}::uuid, ${input.responsibleUserId ?? null},
      ${input.collectionDate}::date, ${input.wasteType}, ${input.action}
    )
  `;
  return listResidentHouseholds(user.id);
}
