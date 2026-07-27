import type { CouncilPermission, CouncilRole } from "./types";

const rolePermissions: Record<CouncilRole, ReadonlySet<CouncilPermission>> = {
  owner: new Set([
    "dashboard:view",
    "content:write",
    "content:publish",
    "guidance:write",
    "partners:write",
    "partners:approve",
    "reports:write",
    "support:view",
    "support:reply",
    "analytics:view",
    "analytics:export",
    "audit:view",
    "organisation:manage",
  ]),
  admin: new Set([
    "dashboard:view",
    "content:write",
    "content:publish",
    "guidance:write",
    "partners:write",
    "partners:approve",
    "reports:write",
    "support:view",
    "support:reply",
    "analytics:view",
    "analytics:export",
    "audit:view",
  ]),
  editor: new Set([
    "dashboard:view",
    "content:write",
    "content:publish",
    "guidance:write",
    "partners:write",
    "reports:write",
  ]),
  analyst: new Set([
    "dashboard:view",
    "analytics:view",
    "analytics:export",
    "audit:view",
  ]),
  support: new Set([
    "dashboard:view",
    "reports:write",
    "support:view",
    "support:reply",
  ]),
};

export function councilRoleCan(role: CouncilRole, permission: CouncilPermission) {
  return rolePermissions[role].has(permission);
}

export function assertCouncilPermission(role: CouncilRole, permission: CouncilPermission) {
  if (!councilRoleCan(role, permission)) {
    throw new Error("Your council role does not allow that action.");
  }
}
