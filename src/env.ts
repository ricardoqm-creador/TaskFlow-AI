// Lectura de variables de entorno. Un único sitio para todas las configuraciones.

/** Devuelve la variable o lanza un error que nombra la que falta. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

/** Entero positivo opcional: usa `fallback` si no está definida. */
export function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} debe ser un entero positivo`);
  return parsed;
}
