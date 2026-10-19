import { jsonResponse, readSession } from "../_shared/session.js";

export async function onRequestGet({ request, env }) {
  const session = await readSession(request, env.AUTH_SECRET);
  return jsonResponse(session || { account: null, room: null });
}
