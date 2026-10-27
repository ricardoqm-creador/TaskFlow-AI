// Utilidades de fechas compartidas por el backend.

/** true si `value` es una fecha real en formato YYYY-MM-DD (rechaza "2026-02-30"). */
export function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
