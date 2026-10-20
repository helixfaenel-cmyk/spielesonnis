import { GameRoom } from "./backend/index.js";

export { GameRoom };

// ===== Hilfsfunktionen =====
const SESSION_COOKIE = "spielportal_session";

function jsonResponse(value, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(value), { ...init, headers });
}

function getAccountFromCookie(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookie = cookieHeader.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(SESSION_COOKIE + "="));
  if (!cookie) return null;
  const account = cookie.slice(SESSION_COOKIE.length + 1);
  if (account === "sonni" || account === "felix") return account;
  return null;
}

function sessionCookie(account) {
  return SESSION_COOKIE + "=" + account + "; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800";
}

function clearSessionCookie() {
  return SESSION_COOKIE + "=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0";
}

// ===== API-Handler (ohne Anmeldung) =====
async function handleLogin({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Ungueltige Anfrage." }, { status: 400 });
  }
  const account = body && (body.account === "sonni" || body.account === "felix") ? body.account : "sonni";
  return jsonResponse(
    { account },
    { headers: { "Set-Cookie": sessionCookie(account) } },
  );
}

function handleLogout() {
  return jsonResponse({}, { headers: { "Set-Cookie": clearSessionCookie() } });
}

function handleSessions({ request }) {
  const account = getAccountFromCookie(request);
  return jsonResponse(account ? { account } : { account: null });
}

const SCOREBOARD_GAMES = ["tic-tac-toe", "battleship", "yatzy", "find-match", "memory"];

async function handleScoreboard({ request, env }) {
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

const ALLOWED_GAMES = new Set(["tic-tac-toe", "battleship", "yatzy", "find-match", "memory"]);

async function handleGame({ request, env, params }) {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return jsonResponse({ error: "WebSocket-Verbindung erforderlich." }, { status: 426 });
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
