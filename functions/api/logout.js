import { clearSessionCookie, jsonResponse } from "../_shared/session.js";

export async function onRequestPost() {
  return jsonResponse({}, { headers: { "Set-Cookie": clearSessionCookie() } });
}
