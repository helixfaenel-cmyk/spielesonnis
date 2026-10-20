export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if ((path === "/api/sessions" || path === "/api/session") && request.method === "GET") {
      return new Response(JSON.stringify({ account: null }), {
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
      });
    }
    if (path === "/api/login" && request.method === "POST") {
      return new Response(JSON.stringify({ error: "Die Anmeldung ist serverseitig noch nicht eingerichtet." }), {
        status: 503,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
      });
    }
    if (path === "/api/logout" && request.method === "POST") {
      return new Response(JSON.stringify({}), {
        headers: { "Content-Type": "application/json; charset=utf-8", "Set-Cookie": "spielportal_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0" }
      });
    }
    if (path === "/api/scoreboard" && request.method === "GET") {
      return new Response(JSON.stringify({ error: "Bitte erneut anmelden." }), {
        status: 401,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
      });
    }
    const gameMatch = path.match(/^\/api\/games\/([\w-]+)$/);
    if (gameMatch) {
      return new Response(JSON.stringify({ error: "WebSocket-Verbindung erforderlich." }), {
        status: 426,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
