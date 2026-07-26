export function normalisePostcode(input: string) {
  const compact = input.trim().toUpperCase().replace(/\s+/g, '');
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
}

export function isUkPostcode(input: string) {
  const postcode = normalisePostcode(input);
  return /^(GIR 0AA|(?:(?:[A-PR-UWYZ]\d[\dA-HJKSTUW]?|[A-PR-UWYZ][A-HK-Y]\d[\dABEHMNPRVWXY]?) \d[ABD-HJLNP-UW-Z]{2}))$/i.test(postcode);
}

export function cleanPostcodeLocality(
  parish: string | undefined,
  adminDistrict: string | undefined,
  region: string | undefined,
  fallback: string,
) {
  const clean = (value: string | undefined) => value
    ?.replace(/,\s*unparished area$/i, '')
    .replace(/\bunparished area\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*$/, '')
    .trim();
  return clean(parish) || clean(adminDistrict) || clean(region) || fallback;
}

export function matchingAddressId(addresses: { id: string; postcode: string }[], postcode: string) {
  const canonicalPostcode = normalisePostcode(postcode);
  return addresses.find((address) => normalisePostcode(address.postcode) === canonicalPostcode)?.id;
}

export function requiresExactCouncilAddress(providerId: string, councilAddressId?: string) {
  return providerId === 'lad-e08000011' && !councilAddressId;
}

export function buildNearestPostcodeUrl(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('Your device returned an invalid latitude.');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Your device returned an invalid longitude.');
  }
  const query = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    limit: '1',
  });
  return `https://api.postcodes.io/postcodes?${query.toString()}`;
}
