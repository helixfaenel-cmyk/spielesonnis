import { jsonResponse, readSession } from "../_shared/session.js";

const GAMES = ["tic-tac-toe", "battleship", "yatzy", "find-match", "memory"];

export async function onRequestGet({ request, env }) {
  const session = await readSession(request, env.AUTH_SECRET);
  if (!session) return jsonResponse({ error: "Bitte erst einem Spielraum beitreten." }, { status: 401 });
  if (!env.GAME_ROOMS) {
    return jsonResponse({ error: "Der Spielserver ist noch nicht verbunden." }, { status: 503 });
  }

  const results = await Promise.all(GAMES.map(async (game) => {
    const room = env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(`${session.room}:${game}`));
    const response = await room.fetch(new Request(`https://game-room/api/room/${game}/scoreboard`, {
      headers: { "X-Spielportal-Player": session.account },
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
