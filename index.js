import { GameRoom } from "./backend/index.js";

const SESSION_COOKIE = "spielportal_session";

function getSessionAccount(request) {
  const url = new URL(request.url);
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookieEntry = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));

  const cookieValue = cookieEntry ? cookieEntry.slice(SESSION_COOKIE.length + 1).trim() : null;
  if (cookieValue && ["sonni", "felix", "spectator"].includes(cookieValue)) {
    return cookieValue;
  }

  const queryValue = url.searchParams.get("player");
  if (queryValue && ["sonni", "felix", "spectator"].includes(queryValue)) {
    return queryValue;
  }

  return null;
}

function getSessionName(request) {
  const url = new URL(request.url);
  const headerName = request.headers.get("X-Spielportal-Name");
  if (headerName && headerName.trim()) return headerName.trim();

  const queryName = url.searchParams.get("name");
  if (queryName && queryName.trim()) return queryName.trim();

  return null;
}

function withSessionHeaders(request) {
  const headers = new Headers(request.headers);
  const account = getSessionAccount(request);
  const name = getSessionName(request);

  if (account && !headers.has("X-Spielportal-Player")) {
    headers.set("X-Spielportal-Player", account);
  }
  if (name && !headers.has("X-Spielportal-Name")) {
    headers.set("X-Spielportal-Name", name);
  }

  return new Request(request, { headers });
}

const originalFetch = GameRoom.prototype.fetch;
GameRoom.prototype.fetch = async function fetchWithSession(request) {
  return originalFetch.call(this, withSessionHeaders(request));
};

export { GameRoom };

function jsonResponse(value, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(value), { ...init, headers });
}

function getAccountFromCookie(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const entry = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));

  if (!entry) return null;
  const value = entry.slice(SESSION_COOKIE.length + 1).trim();
  return ["sonni", "felix", "spectator"].includes(value) ? value : null;
}

function sessionCookie(account) {
  return `${SESSION_COOKIE}=${account}; Path=/; SameSite=Lax; Max-Age=604800`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
}

async function handlePlayerSelect({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Ungueltige Anfrage." }, { status: 400 });
  }

  const selected =
    body?.account ||
    body?.player ||
    body?.role ||
    "sonni";

  const normalized = ["sonni", "felix", "spectator"].includes(selected) ? selected : "sonni";

  return jsonResponse(
    { account: normalized },
    {
      headers: {
        "Set-Cookie": sessionCookie(normalized),
      },
    },
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
  if (!env.GAME_ROOMS) {
    return jsonResponse({ error: "Der Spielserver ist noch nicht verbunden." }, { status: 503 });
  }

  const cookie = request.headers.get("Cookie") || "";
  const results = await Promise.all(
    SCOREBOARD_GAMES.map(async (game) => {
      const room = env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(game));
      const response = await room.fetch(
        new Request(`https://game-room/api/room/${game}/scoreboard`, {
          headers: { Cookie: cookie },
        }),
      );
      return response.ok ? response.json() : null;
    }),
  );

  if (results.some((result) => result === null)) {
    return jsonResponse({ error: "Scoreboard konnte nicht geladen werden." }, { status: 503 });
  }

  const wins = { sonni: 0, felix: 0 };
  for (const result of results) {
    wins.sonni += Number(result.sonni || 0);
    wins.felix += Number(result.felix || 0);
  }

  return jsonResponse({ wins });
}

const ALLOWED_GAMES = new Set(["tic-tac-toe", "battleship", "yatzy", "find-match", "memory"]);

async function handleGame({ request, env, params }) {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return jsonResponse({ error: "WebSocket-Verbindung erforderlich." }, { status: 426 });
  }

  const game = params.game;
  if (!ALLOWED_GAMES.has(game)) {
    return jsonResponse({ error: "Spiel nicht gefunden." }, { status: 404 });
  }
  if (!env.GAME_ROOMS) {
    return jsonResponse({ error: "Der Spielserver ist noch nicht verbunden." }, { status: 503 });
  }

  const account = getSessionAccount(request);
  if (!account) {
    return jsonResponse({ error: "Unauthorized" }, { status: 401 });
  }

  const room = env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(game));
  return room.fetch(request);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/login" && request.method === "POST") {
      return handlePlayerSelect({ request, env });
    }
    if (path === "/api/players/select" && request.method === "POST") {
      return handlePlayerSelect({ request, env });
    }
    if (path === "/api/logout" && request.method === "POST") {
      return handleLogout({ request, env });
    }

    if ((path === "/api/sessions" || path === "/api/session") && request.method === "GET") {
      return handleSessions({ request, env });
    }

    if (path === "/api/scoreboard" && request.method === "GET") {
      return handleScoreboard({ request, env });
    }

    const gameMatch1 = path.match(/^\/api\/games\/([\w-]+)$/);
    const gameMatch2 = path.match(/^\/api\/room\/([\w-]+)$/);
    const gameMatch = gameMatch1 || gameMatch2;

    if (gameMatch) {
      return handleGame({ request, env, params: { game: gameMatch[1] } });
    }

    if (path.startsWith("/api/")) {
      return jsonResponse({ error: "Nicht gefunden." }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
};
