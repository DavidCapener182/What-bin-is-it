const councilIdPattern = /^[a-z0-9][a-z0-9-]{2,79}$/;

export function councilIdsForResidentUse(
  currentCouncilIds: string[],
  resolvedCouncilId?: string,
) {
  return [...new Set([
    ...currentCouncilIds,
    resolvedCouncilId,
  ].filter((councilId): councilId is string => (
    typeof councilId === 'string'
    && councilIdPattern.test(councilId)
    && councilId !== 'unconnected'
  )))].sort().slice(0, 10);
}
