export function dataQualityDateOnly(value: string | Date | null) {
  if (value === null) return null;
  if (typeof value === "string") {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  }
  return Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : null;
}
