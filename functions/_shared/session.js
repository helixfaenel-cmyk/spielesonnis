const SESSION_COOKIE = "spielportal_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
const VALID_ACCOUNTS = new Set(["sonni", "felix", "spectator"]);
const GLOBAL_ROOM = "GLOBAL";
const DEFAULT_PLAYER_NAMES = { sonni: "Spieler 1", felix: "Spieler 2", spectator: "Zuschauer" };

export function normalizePlayerName(value) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (!name || Array.from(name).length > 24 || /[\u0000-\u001F\u007F]/u.test(name)) return null;
  return name;
}

function encodeBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function importSecret(secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 characters.");
  }
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionToken(account, room, name, secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encodeBase64Url(JSON.stringify({
    sub: account,
    room,
    name,
    iat: now,
    exp: now + SESSION_DURATION_SECONDS,
  }));
  const unsignedToken = `${header}.${payload}`;
  const key = await importSecret(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(unsignedToken));
  const binary = String.fromCharCode(...new Uint8Array(signature));
  const encodedSignature = btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
  return `${unsignedToken}.${encodedSignature}`;
}

export async function readSession(request, secret) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookie = cookieHeader.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) return null;

  const token = cookie.slice(SESSION_COOKIE.length + 1);
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedHeader)));
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPayload)));
    if (
      header.alg !== "HS256" ||
      !VALID_ACCOUNTS.has(payload.sub) ||
      payload.room !== GLOBAL_ROOM ||
      (payload.name !== undefined && !normalizePlayerName(payload.name)) ||
      !Number.isInteger(payload.exp) ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    const key = await importSecret(secret);
    const signature = decodeBase64Url(encodedSignature);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );
    return valid
      ? {
        account: payload.sub,
        room: payload.room,
        name: normalizePlayerName(payload.name) || DEFAULT_PLAYER_NAMES[payload.sub],
      }
      : null;
  } catch (error) {
    if (error instanceof TypeError || error instanceof SyntaxError || error instanceof DOMException) return null;
    throw error;
  }
}

export function sessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_DURATION_SECONDS}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export function jsonResponse(value, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(value), { ...init, headers });
}

export { GLOBAL_ROOM };
