const wasteTypes = new Set(['general', 'recycling', 'garden', 'food', 'other']);

export type VerifiedCollection = {
  id: string;
  date: string;
  wasteType: 'general' | 'recycling' | 'garden' | 'food' | 'other';
  source: 'council';
  label?: string;
  colour?: string;
};

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

export function verifiedCollectionsOnly(value: unknown): VerifiedCollection[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is VerifiedCollection => {
    if (!item || typeof item !== 'object') return false;
    const collection = item as Partial<VerifiedCollection> & { source?: unknown };
    return (
      typeof collection.id === 'string'
      && collection.id.length > 0
      && collection.id.length <= 180
      && isIsoDate(collection.date)
      && wasteTypes.has(collection.wasteType as string)
      && collection.source === 'council'
      && (collection.label === undefined || (
        typeof collection.label === 'string'
        && collection.label.length > 0
        && collection.label.length <= 80
      ))
      && (collection.colour === undefined || (
        typeof collection.colour === 'string'
        && /^#[0-9A-F]{6}$/i.test(collection.colour)
      ))
    );
  });
}
