// Configuración de Google. Se lee al primer uso (no al importar) para poder probar sin variables.
import { requireEnv } from "../../env.js";

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: readonly string[];
  tokenKey: Buffer;
}

let cached: GoogleConfig | undefined;

export function getGoogleConfig(): GoogleConfig {
  if (!cached) {
    const tokenKey = Buffer.from(requireEnv("TOKEN_ENCRYPTION_KEY"), "base64");
    if (tokenKey.length !== 32) {
      throw new Error("TOKEN_ENCRYPTION_KEY debe ser una clave de 32 bytes en base64");
    }
    cached = {
      clientId: requireEnv("GOOGLE_CLIENT_ID"),
      clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirectUri: requireEnv("GOOGLE_REDIRECT_URI"),
      // Mínimo privilegio: solo crear/editar/borrar eventos, sin acceso a otros datos del calendario.
      scopes: ["https://www.googleapis.com/auth/calendar.events"],
      tokenKey,
    };
  }
  return cached;
}
