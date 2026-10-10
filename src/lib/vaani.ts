// Vaani REST API (docs.vaanivoice.ai). Server-only: uses VAANI_API_KEY.
const API = "https://api.vaanivoice.ai/api";

function headers() {
  const key = process.env.VAANI_API_KEY?.trim();
  if (!key) throw new Error("VAANI_API_KEY is not set");
  return { "X-API-Key": key, "content-type": "application/json" };
}

/** Starts an in-browser (WebRTC) session with the agent: an inbound-style test call without a phone number. */
export async function startWebCall(): Promise<{ token: string; roomName: string; url: string }> {
  const agentId = process.env.VAANI_AGENT_ID?.trim();
  if (!agentId) throw new Error("VAANI_AGENT_ID is not set");
  const res = await fetch(`${API}/trigger-call/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ agent_id: agentId, medium: "webrtc" }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Vaani trigger-call ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
  const token = j.token ?? j.access_token;
  const url = String(j.connection_url ?? j.room_url ?? "").replace(/^http/, "ws");
  if (!token || !url || !j.room_name) throw new Error("Vaani trigger-call response missing token/room/url");
  return { token, roomName: j.room_name, url };
}

/**
 * Builds a call_postprocessing-shaped event from Vaani's REST API, for when the
 * webhook can't reach us (local demo) or was missed. Returns null if Vaani hasn't
 * finished post-processing yet.
 */
export async function fetchFinishedCall(callId: string): Promise<Record<string, unknown> | null> {
  const id = encodeURIComponent(callId);
  const t = await fetch(`${API}/transcript/${id}`, { headers: headers() });
  if (t.status === 404) return null;
  if (!t.ok) throw new Error(`Vaani transcript ${t.status}: ${(await t.text()).slice(0, 200)}`);
  const { transcript } = await t.json();
  // Vaani answers 200 with an error message in place of the transcript while it isn't ready.
  const text = String(transcript ?? "").trim();
  if (!text || /^(error retrieving transcript|transcript is not available)/i.test(text)) return null;

  const d = await fetch(`${API}/call_details/${id}`, { headers: headers() });
  const details = d.ok ? await d.json() : {};
  const entities = details.entity && typeof details.entity === "object" ? details.entity : {};

  return {
    event: "call_postprocessing",
    call_id: callId,
    timestamp: new Date().toISOString(),
    data: { call_id: callId, room_name: callId, call_duration: 0, transcript, summary: details.summary, entities },
  };
}
