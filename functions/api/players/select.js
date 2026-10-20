import {
  createSessionToken,
  GLOBAL_ROOM,
  jsonResponse,
  normalizePlayerName,
  sessionCookie,
} from "../../_shared/session.js";

const GAMES = ["tic-tac-toe", "battleship", "yatzy", "find-match", "memory"];

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

  const account = body && ["sonni", "felix", "spectator"].includes(body.account) ? body.account : "";
  const botEnabled = account === "sonni" && body.bot === true;
  const name = account === "spectator" ? "Zuschauer" : normalizePlayerName(body && body.name);
  if (!account) return jsonResponse({ error: "Bitte Spieler 1, Spieler 2 oder Zuschauer auswählen." }, { status: 400 });
  if (!name) return jsonResponse({ error: "Der Name muss 1 bis 24 Zeichen lang sein." }, { status: 400 });
  if (!env.GAME_ROOMS) {
    return jsonResponse({ error: "Der Spielserver ist noch nicht verbunden." }, { status: 503 });
  }

  try {
    const primaryRoom = env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(`global:${GAMES[0]}`));
    const status = await primaryRoom.fetch(new Request(`https://game-room/api/room/${GAMES[0]}/status`));
    if (account === "spectator" && !status.ok) {
      return jsonResponse({ error: "Es gibt noch keine Partie. Warte, bis ein Spieler einen Platz auswählt." }, { status: 404 });
    }

    if (account !== "spectator") {
      const claims = await Promise.all(GAMES.map(async (game) => {
        const room = env.GAME_ROOMS.get(env.GAME_ROOMS.idFromName(`global:${game}`));
        return room.fetch(new Request(`https://game-room/api/room/${game}/claim`, {
          method: "POST",
          headers: {
            "X-Spielportal-Player": account,
            "X-Spielportal-Name": name,
            "X-Spielportal-Bot": String(botEnabled),
          },
        }));
      }));
      const conflict = claims.find((response) => response.status === 409);
      if (conflict) {
        return jsonResponse({ error: "Dieser Spielerplatz ist bereits vergeben." }, { status: 409 });
      }
      if (claims.some((response) => !response.ok)) {
        console.error("Could not claim player slot in every global game room:", account);
        return jsonResponse({ error: "Der Spielerplatz konnte nicht für alle Spiele freigeschaltet werden." }, { status: 503 });
      }
    }

    const token = await createSessionToken(account, GLOBAL_ROOM, name, env.AUTH_SECRET);
    return jsonResponse(
      { account, name },
      { headers: { "Set-Cookie": sessionCookie(token) } },
    );
  } catch (error) {
    console.error("Could not select player role:", error);
    return jsonResponse({ error: "Die Spielauswahl konnte nicht gespeichert werden." }, { status: 500 });
  }
}
