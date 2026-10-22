import { google } from "googleapis";
import { getGoogleConfig } from "./googleConfig.js";

export type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export function createOAuthClient(): OAuth2Client {
  const config = getGoogleConfig();
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

/** Paso 1: URL a la que se redirige al usuario para autorizar. `state` protege contra CSRF. */
export function buildAuthUrl(state: string): string {
  return createOAuthClient().generateAuthUrl({
    access_type: "offline", // necesario para recibir refresh_token
    prompt: "consent",      // fuerza a Google a entregar refresh_token
    scope: [...getGoogleConfig().scopes],
    include_granted_scopes: true,
    state,
  });
}

/** Paso 2: intercambia el `code` del callback por tokens. */
export async function exchangeCode(code: string) {
  const { tokens } = await createOAuthClient().getToken(code);
  if (!tokens.refresh_token) {
    // Pasa si el usuario ya había autorizado antes y Google no reenvía el refresh_token.
    throw new Error("Google no devolvió refresh_token; revoca el acceso previo y vuelve a conectar.");
  }
  return tokens;
}
