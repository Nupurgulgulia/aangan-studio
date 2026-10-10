"use client";
import { createLocalAudioTrack, Room, RoomEvent, Track, type LocalAudioTrack, type RemoteTrack } from "livekit-client";
import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "connecting" | "live" | "ended" | "scoring" | "scored";

const MIC_HELP =
  "Microphone access is blocked. Click the lock/tune icon left of the address bar → Site settings → Microphone → Allow, then reload this page. On Windows also check Settings → Privacy → Microphone → allow desktop/browser apps.";

/** Live input level 0..1 from a MediaStreamTrack, so the caller can see the mic is picking them up. */
function useMicLevel(track: MediaStreamTrack | null) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!track) return setLevel(0);
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(new MediaStream([track]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
      setLevel(peak);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      void ctx.close();
    };
  }, [track]);
  return level;
}

export function TestCall() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [roomName, setRoomName] = useState("");
  const [message, setMessage] = useState("");
  const [leadId, setLeadId] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [micTrack, setMicTrack] = useState<LocalAudioTrack | null>(null);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const room = useRef<Room | null>(null);
  const audio = useRef<HTMLDivElement>(null);
  const level = useMicLevel(micTrack?.mediaStreamTrack ?? null);

  useEffect(
    () => () => {
      void room.current?.disconnect();
      micTrack?.stop();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** Ask for the mic first (before any call exists) and list input devices. */
  async function prepareMic(id?: string): Promise<LocalAudioTrack | null> {
    try {
      micTrack?.stop();
      const track = await createLocalAudioTrack({
        deviceId: id || undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "audioinput");
      setDevices(list);
      setDeviceId(track.mediaStreamTrack.getSettings().deviceId ?? id ?? "");
      setMicTrack(track);
      return track;
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setMessage(
        name === "NotAllowedError" || name === "SecurityError"
          ? MIC_HELP
          : name === "NotFoundError"
            ? "No microphone found. Plug one in (or enable it in Windows sound settings) and try again."
            : name === "NotReadableError"
              ? "The microphone is in use by another app (Zoom, Teams, another tab). Close it and try again."
              : `Couldn't open the microphone: ${String(e instanceof Error ? e.message : e)}`,
      );
      setMicTrack(null);
      return null;
    }
  }

  async function switchDevice(id: string) {
    setDeviceId(id);
    const track = await prepareMic(id);
    // Mid-call: swap the published track.
    if (track && room.current && phase === "live") {
      const pub = room.current.localParticipant.getTrackPublication(Track.Source.Microphone);
      if (pub?.track) await room.current.localParticipant.unpublishTrack(pub.track);
      await room.current.localParticipant.publishTrack(track, { source: Track.Source.Microphone });
    }
  }

  async function start() {
    setMessage("");
    setLeadId("");
    // Diagnostics only (?listen=1): join without a mic to observe how long Vaani keeps the call.
    const listenOnly = new URLSearchParams(window.location.search).get("listen") === "1";
    const track = listenOnly ? null : micTrack ?? (await prepareMic(deviceId));
    if (!track && !listenOnly) return; // never connect a call the caller can't speak into

    setPhase("connecting");
    let r: Room | null = null;
    try {
      const res = await fetch("/api/test-call", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Could not start the call");
      setRoomName(j.roomName);

      // livekit-client is pinned to 2.13.8: Vaani's LiveKit server predates the newer signalling
      // (/rtc/v1 returns 404, single peer connection). With 2.22, publishing the mic never got an
      // answer, the client hit its 15 s negotiation deadline and reconnected, and Vaani ended the call.
      r = new Room({ adaptiveStream: true });
      room.current = r;
      r.on(RoomEvent.TrackSubscribed, (t: RemoteTrack) => {
        if (t.kind === Track.Kind.Audio) audio.current?.appendChild(t.attach());
      });
      r.on(RoomEvent.ActiveSpeakersChanged, (speakers) =>
        setAgentSpeaking(speakers.some((s) => s.identity !== r!.localParticipant.identity)),
      );
      r.on(RoomEvent.Disconnected, () => setPhase((p) => (p === "live" ? "ended" : p)));

      await r.connect(j.url, j.token);
      await r.startAudio(); // inside the click handler, so autoplay is allowed
      if (track) {
        await r.localParticipant.publishTrack(track, { source: Track.Source.Microphone });
        const pub = r.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (!pub || pub.isMuted) throw new Error("Your microphone could not be sent to the call.");
      }
      setPhase("live");
    } catch (e) {
      await r?.disconnect(); // don't leave the agent talking to nobody
      room.current = null;
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
      setMessage(`Scored: ${j.label}${j.duplicate ? " (already scored automatically)" : ""}.`);
      setPhase("scored");
    }
  }

  const canStart = phase === "idle" || phase === "scored" || phase === "ended";

  return (
    <div className="card">
      <div className="row">
        {!micTrack && canStart && (
          <button className="sec" onClick={() => prepareMic(deviceId)}>
            Check microphone
          </button>
        )}
        {canStart && <button onClick={start}>Start test call</button>}
        {phase === "connecting" && <button disabled>Connecting…</button>}
        {phase === "live" && (
          <>
            <span className="pill qualified">{agentSpeaking ? "Agent speaking" : "Live: speak now"}</span>
            <button className="sec" onClick={hangUp}>Hang up</button>
          </>
        )}
        {(phase === "ended" || phase === "scoring") && roomName && (
          <button className="sec" onClick={score} disabled={phase === "scoring"}>
            {phase === "scoring" ? "Scoring…" : "Score this call"}
          </button>
        )}
        {leadId && <a href={`/lead/${leadId}`}>Open the lead</a>}
      </div>

      {micTrack && (
        <div className="row" aria-label="Microphone">
          <span className="sub" style={{ margin: 0 }}>Mic</span>
          <div style={{ flex: "1 1 160px", maxWidth: 260, height: 10, borderRadius: 5, background: "var(--line)", overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.min(100, Math.round(level * 160))}%`,
                height: "100%",
                background: level > 0.04 ? "var(--green)" : "var(--muted)",
                transition: "width 60ms linear",
              }}
            />
          </div>
          {devices.length > 1 && (
            <select value={deviceId} onChange={(e) => switchDevice(e.target.value)} style={{ maxWidth: 260 }}>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "Microphone"}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      {micTrack && phase !== "live" && (
        <p className="sub" style={{ margin: "4px 0 0" }}>Say something: the bar should turn green. If it stays grey, pick another microphone.</p>
      )}
      {roomName && <p className="sub" style={{ margin: "8px 0 0" }}>Call id: {roomName}</p>}
      {message && <p style={{ margin: "8px 0 0" }}>{message}</p>}
      <div ref={audio} hidden />
    </div>
  );
}
