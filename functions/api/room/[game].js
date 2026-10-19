import { jsonResponse, readSession } from "../../_shared/session.js";

const ALLOWED_GAMES = new Set(["tic-tac-toe", "battleship", "yatzy", "find-match", "memory"]);

export async function onRequest({ request, env, params }) {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return jsonResponse({ error: "WebSocket-Verbindung erforderlich." }, { status: 426 });
  }
  if (request.headers.get("Origin") !== new URL(request.url).origin) {
    return jsonResponse({ error: "Ungültiger Verbindungsursprung." }, { status: 403 });
  }

  const session = await readSession(request, env.AUTH_SECRET);
  if (!session) return jsonResponse({ error: "Bitte erst einem Spielraum beitreten." }, { status: 401 });

  const game = params.game;
  const requestedRoom = new URL(request.url).searchParams.get("room");
  if (!ALLOWED_GAMES.has(game)) return jsonResponse({ error: "Spiel nicht gefunden." }, { status: 404 });
  if (requestedRoom !== session.room) {
    return jsonResponse({ error: "Der Raumcode stimmt nicht mit deiner Sitzung überein." }, { status: 403 });
  }
  if (!env.GAME_ROOMS) {
    return jsonResponse({ error: "Der Spielserver ist noch nicht verbunden." }, { status: 503 });
  }

  const headers = new Headers(request.headers);
  headers.set("X-Spielportal-Player", session.account);
  const room = env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(`${session.room}:${game}`));
  return room.fetch(new Request(request, { headers }));
}
