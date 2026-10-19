import { createSessionToken, jsonResponse, sessionCookie } from "../../_shared/session.js";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const GAMES = ["tic-tac-toe", "battleship", "yatzy", "find-match", "memory"];

function generateRoomCode() {
  const random = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(random, (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join("");
}

export async function onRequestPost({ env }) {
  if (typeof env.AUTH_SECRET !== "string" || env.AUTH_SECRET.length < 32) {
    return jsonResponse({ error: "Der Spielserver ist noch nicht eingerichtet." }, { status: 503 });
  }
  if (!env.GAME_ROOMS) {
    return jsonResponse({ error: "Der Spielserver ist noch nicht verbunden." }, { status: 503 });
  }
  const room = generateRoomCode();

  try {
    const registrations = await Promise.all(GAMES.map(async (game) => {
      const gameRoom = env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(`${room}:${game}`));
      return gameRoom.fetch(new Request(`https://game-room/api/room/${game}/register`, {
        method: "POST",
        headers: { "X-Spielportal-Player": "sonni" },
      }));
    }));
    if (registrations.some((registration) => !registration.ok)) {
      console.error("Could not register every game for room:", room);
      return jsonResponse({ error: "Der Spielraum konnte nicht angelegt werden." }, { status: 503 });
    }

    const token = await createSessionToken("sonni", room, env.AUTH_SECRET);
    return jsonResponse(
      { account: "sonni", room },
      { headers: { "Set-Cookie": sessionCookie(token) } },
    );
  } catch (error) {
    console.error("Could not create room session:", error);
    return jsonResponse({ error: "Der Spielraum konnte nicht erstellt werden." }, { status: 500 });
  }
}
