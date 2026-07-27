const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const providerPattern = /^lad-[ensw][0-9]{8}$/;
const itemKeyPattern = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function requiredText(value: FormDataEntryValue | null, label: string, maximum: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > maximum) {
    throw new Error(`${label} must be between 1 and ${maximum} characters.`);
  }
  return text;
}

export function optionalText(value: FormDataEntryValue | null, maximum: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return undefined;
  if (text.length > maximum) throw new Error(`A value is longer than ${maximum} characters.`);
  return text;
}

export function safeHttpsUrl(value: FormDataEntryValue | null, required = false) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw && !required) return undefined;
  if (!raw || raw.length > 500) throw new Error("Enter a valid HTTPS link.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Enter a valid HTTPS link.");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Only HTTPS links without embedded credentials are allowed.");
  }
  return url.toString();
}

export function isoDateTime(value: FormDataEntryValue | null, required = false) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw && !required) return undefined;
  const date = new Date(raw);
  if (!raw || Number.isNaN(date.getTime())) throw new Error("Enter a valid date and time.");
  return date.toISOString();
}

export function splitValues(value: FormDataEntryValue | null, maximum = 50) {
  if (typeof value !== "string") return [];
  const values = [...new Set(
    value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean),
  )];
  if (values.length > maximum || values.some((item) => item.length > 120)) {
    throw new Error(`Enter no more than ${maximum} short values.`);
  }
  return values;
}

export function selectedValues(formData: FormData, name: string) {
  return [...new Set(
    formData
      .getAll(name)
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean),
  )];
}

export function integerValue(
  value: FormDataEntryValue | null,
  label: string,
  minimum: number,
  maximum: number,
) {
  const parsed = typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

export function assertUuid(value: string) {
  if (!uuidPattern.test(value)) throw new Error("The selected record is invalid.");
  return value;
}

export function assertProviderId(value: string) {
  if (!providerPattern.test(value)) throw new Error("The council provider is invalid.");
  return value;
}

export function normaliseItemKey(value: FormDataEntryValue | null) {
  const raw = requiredText(value, "Item key", 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!itemKeyPattern.test(raw)) throw new Error("The item key is invalid.");
  return raw;
}

export function safeReturnPath(value: string | undefined) {
  if (!value || !/^\/[a-z0-9/_?=&-]*$/i.test(value) || value.startsWith("//")) {
    return "/";
  }
  return value;
}
