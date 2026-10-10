"use client";
import { Room, RoomEvent, Track, type RemoteTrack } from "livekit-client";
import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "connecting" | "live" | "ended" | "scoring" | "scored";

export function TestCall() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [roomName, setRoomName] = useState("");
  const [message, setMessage] = useState("");
  const [leadId, setLeadId] = useState("");
  const room = useRef<Room | null>(null);
  const audio = useRef<HTMLDivElement>(null);

  useEffect(() => () => void room.current?.disconnect(), []);

  async function start() {
    setPhase("connecting");
    setMessage("");
    try {
      const res = await fetch("/api/test-call", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not start the call");
      setRoomName(j.roomName);

      const r = new Room();
      room.current = r;
      r.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) audio.current?.appendChild(track.attach());
      });
      r.on(RoomEvent.Disconnected, () => setPhase((p) => (p === "live" ? "ended" : p)));
      await r.connect(j.url, j.token);
      await r.localParticipant.setMicrophoneEnabled(true);
      setPhase("live");
    } catch (e) {
      setMessage(String(e instanceof Error ? e.message : e));
      setPhase("idle");
    }
  }

  async function hangUp() {
    await room.current?.disconnect();
    room.current = null;
    setPhase("ended");
  }

  async function score() {
    setPhase("scoring");
    setMessage("");
    const res = await fetch(`/api/test-call/${encodeURIComponent(roomName)}/score`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (res.status === 202) {
      setMessage(j.message);
      setPhase("ended");
    } else if (!res.ok) {
      setMessage(j.error ?? "Scoring failed");
      setPhase("ended");
    } else {
      setLeadId(j.id);
      setMessage(`Scored: ${j.label}${j.duplicate ? " (already scored)" : ""}.`);
      setPhase("scored");
    }
  }

  return (
    <div className="card">
      <div className="row">
        {(phase === "idle" || phase === "scored") && <button onClick={start}>Start test call</button>}
        {phase === "connecting" && <button disabled>Connecting…</button>}
        {phase === "live" && (
          <>
            <span className="pill qualified">Live: speak now</span>
            <button className="sec" onClick={hangUp}>Hang up</button>
          </>
        )}
        {(phase === "ended" || phase === "scoring") && (
          <button onClick={score} disabled={phase === "scoring"}>
            {phase === "scoring" ? "Scoring…" : "Score this call"}
          </button>
        )}
        {leadId && <a href={`/lead/${leadId}`}>Open the lead</a>}
      </div>
      {roomName && <p className="sub" style={{ margin: "8px 0 0" }}>Call id: {roomName}</p>}
      {message && <p style={{ margin: "8px 0 0" }}>{message}</p>}
      <div ref={audio} hidden />
    </div>
  );
}
