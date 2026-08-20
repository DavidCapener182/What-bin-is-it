const controlCharacters = /[\u0000-\u001f\u007f]/;

export function boundedDisplayText(value: unknown, maximumLength: number) {
  if (typeof value !== 'string' || !Number.isSafeInteger(maximumLength) || maximumLength < 1) {
    return undefined;
  }
  const text = value.trim();
  if (!text || text.length > maximumLength || controlCharacters.test(text)) return undefined;
  return text;
}

export function normaliseExternalHttpsUrl(value: unknown, maximumLength = 2_048) {
  if (typeof value !== 'string' || controlCharacters.test(value)) return undefined;
  const input = value.trim();
  if (!input || input.length > maximumLength) return undefined;
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) return undefined;
    const canonical = url.toString();
    return canonical.length <= maximumLength ? canonical : undefined;
  } catch {
    return undefined;
  }
}

export function boundedStringRecord(value: unknown, maximumEntries = 200) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value).slice(0, maximumEntries).filter(([key, item]) => (
    boundedDisplayText(key, 100) !== undefined
    && typeof item === 'string'
    && item.length <= 1_000
    && !controlCharacters.test(item)
  ));
  return Object.fromEntries(entries) as Record<string, string>;
}
