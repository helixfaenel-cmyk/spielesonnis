import {
  createSessionToken,
  jsonResponse,
  ROOM_CODE_PATTERN,
  sessionCookie,
} from "../../_shared/session.js";

export async function onRequestPost({ request, env }) {
  if (typeof env.AUTH_SECRET !== "string" || env.AUTH_SECRET.length < 32) {
    return jsonResponse({ error: "Der Spielserver ist noch nicht eingerichtet." }, { status: 503 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const room = body && typeof body.room === "string" ? body.room.trim().toUpperCase() : "";
  if (!ROOM_CODE_PATTERN.test(room)) {
    return jsonResponse({ error: "Der Raumcode muss aus 8 gültigen Zeichen bestehen." }, { status: 400 });
  }
  if (!env.GAME_ROOMS) {
    return jsonResponse({ error: "Der Spielserver ist noch nicht verbunden." }, { status: 503 });
  }

  try {
    const gameRoom = env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(`${room}:tic-tac-toe`));
    const registration = await gameRoom.fetch(new Request("https://game-room/api/room/tic-tac-toe/status", {
      headers: { "X-Spielportal-Player": "felix" },
    }));
    if (!registration.ok) {
      return jsonResponse({ error: "Dieser Raum wurde nicht gefunden. Prüfe den Code oder erstelle einen neuen Raum." }, { status: 404 });
    }

    const token = await createSessionToken("felix", room, env.AUTH_SECRET);
    return jsonResponse(
      { account: "felix", room },
      { headers: { "Set-Cookie": sessionCookie(token) } },
    );
  } catch (error) {
    console.error("Could not join room:", error);
    return jsonResponse({ error: "Der Spielraum konnte nicht betreten werden." }, { status: 500 });
  }
}
