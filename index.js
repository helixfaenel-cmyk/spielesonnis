import { GameRoom } from "./backend/index.js";

export { GameRoom };

// ===== Session-Verwaltung (JWT) =====
const SESSION_COOKIE = "spielportal_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
const VALID_ACCOUNTS = new Set(["sonni", "felix"]);

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
  if (!secret || secret.length < 32) {
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

async function createSessionToken(account, secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encodeBase64Url(JSON.stringify({
    sub: account,
    iat: now,
    exp: now + SESSION_DURATION_SECONDS,
  }));
  const unsignedToken = header + "." + payload;
  const key = await importSecret(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(unsignedToken));
  const binary = String.fromCharCode(...new Uint8Array(signature));
  const encodedSignature = btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
  return unsignedToken + "." + encodedSignature;
}

async function readSession(request, secret) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookie = cookieHeader.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(SESSION_COOKIE + "="));
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
      new TextEncoder().encode(encodedHeader + "." + encodedPayload),
    );
    return valid ? payload.sub : null;
  } catch (error) {
    if (error instanceof TypeError || error instanceof SyntaxError || error instanceof DOMException) return null;
    throw error;
  }
}

function sessionCookie(token) {
  return SESSION_COOKIE + "=" + token + "; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=" + SESSION_DURATION_SECONDS;
}

function clearSessionCookie() {
  return SESSION_COOKIE + "=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0";
}

function jsonResponse(value, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(value), { ...init, headers });
}

// ===== API-Handler =====
const LOGIN_ACCOUNTS = {
  sonni: "SONNI_PASSWORD",
  felix: "FELIX_PASSWORD",
};

async function handleLogin({ request, env }) {
  let credentials;
  try {
    credentials = await request.json();
  } catch {
    return jsonResponse({ error: "Ungueltige Anfrage." }, { status: 400 });
  }

  const account = credentials && credentials.account;
  const password = credentials && credentials.password;
  const configuredPassword = LOGIN_ACCOUNTS[account] && env[LOGIN_ACCOUNTS[account]];
  if (typeof configuredPassword !== "string" || !env.AUTH_SECRET) {
    return jsonResponse({ error: "Die Anmeldung ist serverseitig noch nicht eingerichtet." }, { status: 503 });
  }
  if (typeof password !== "string" || password !== configuredPassword) {
    return jsonResponse({ error: "Account oder Passwort ist falsch." }, { status: 401 });
  }

  try {
    const token = await createSessionToken(account, env.AUTH_SECRET);
    return jsonResponse(
      { account },
      { headers: { "Set-Cookie": sessionCookie(token) } },
    );
  } catch (error) {
    console.error("Could not create login session:", error);
    return jsonResponse({ error: "Die Anmeldung ist momentan nicht verfuegbar." }, { status: 500 });
  }
}

async function handleLogout() {
  return jsonResponse({}, { headers: { "Set-Cookie": clearSessionCookie() } });
}

const SCOREBOARD_GAMES = ["tic-tac-toe", "battleship", "yatzy", "find-match", "memory"];

async function handleScoreboard({ request, env }) {
  const account = await readSession(request, env.AUTH_SECRET);
  if (!account) return jsonResponse({ error: "Bitte erneut anmelden." }, { status: 401 });
  if (!env.GAME_ROOMS) return jsonResponse({ error: "Der Spielserver ist noch nicht verbunden." }, { status: 503 });

  const cookie = request.headers.get("Cookie") || "";
  const results = await Promise.all(SCOREBOARD_GAMES.map(async (game) => {
    const room = env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(game));
    const response = await room.fetch(new Request("https://game-room/api/room/" + game + "/scoreboard", {
      headers: { Cookie: cookie },
    }));
    return response.ok ? response.json() : null;
  }));
  if (results.some((result) => result === null)) {
    return jsonResponse({ error: "Scoreboard konnte nicht geladen werden." }, { status: 503 });
  }

  const wins = { sonni: 0, felix: 0 };
  for (const result of results) {
    wins.sonni += result.sonni;
    wins.felix += result.felix;
  }
  return jsonResponse({ wins });
}

async function handleSessions({ request, env }) {
  const account = await readSession(request, env.AUTH_SECRET);
  return jsonResponse(account ? { account } : { account: null });
}

const ALLOWED_GAMES = new Set(["tic-tac-toe", "battleship", "yatzy", "find-match", "memory"]);
const GAME_PLAYERS = new Set(["sonni", "felix"]);

async function handleGame({ request, env, params }) {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return jsonResponse({ error: "WebSocket-Verbindung erforderlich." }, { status: 426 });
  }
  if (request.headers.get("Origin") !== new URL(request.url).origin) {
    return jsonResponse({ error: "Ungueltiger Verbindungsursprung." }, { status: 403 });
  }

  const account = await readSession(request, env.AUTH_SECRET);
  if (!account) return jsonResponse({ error: "Bitte erneut anmelden." }, { status: 401 });
  if (!GAME_PLAYERS.has(account)) {
    return jsonResponse({ error: "Nur Sonni und Felix koennen an den Multiplayer-Spielen teilnehmen." }, { status: 403 });
  }

  const game = params.game;
  if (!ALLOWED_GAMES.has(game)) return jsonResponse({ error: "Spiel nicht gefunden." }, { status: 404 });
  if (!env.GAME_ROOMS) return jsonResponse({ error: "Der Spielserver ist noch nicht verbunden." }, { status: 503 });

  const room = env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(game));
  return room.fetch(request);
}

// ===== Routing =====
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/login" && request.method === "POST") {
      return handleLogin({ request, env });
    }
    if (path === "/api/logout" && request.method === "POST") {
      return handleLogout({ request, env });
    }
    if (path === "/api/scoreboard" && request.method === "GET") {
      return handleScoreboard({ request, env });
    }
    if ((path === "/api/sessions" || path === "/api/session") && request.method === "GET") {
      return handleSessions({ request, env });
    }

    const gameMatch = path.match(/^\/api\/games\/([\w-]+)$/);
    if (gameMatch) {
      return handleGame({ request, env, params: { game: gameMatch[1] } });
    }

    return env.ASSETS.fetch(request);
  },
};
