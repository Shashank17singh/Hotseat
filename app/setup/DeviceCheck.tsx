"use client";

import { useEffect, useRef } from "react";
import { mediaMessage, useLevel, useMedia } from "@/hooks/useMedia";
import { speak } from "@/lib/speech";
import { readSettings } from "@/lib/storage";

export function DeviceCheck() {
  const { stream, status, start, stop } = useMedia();
  const video = useRef<HTMLVideoElement>(null);
  const meter = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (video.current) video.current.srcObject = stream;
  }, [stream]);

  useLevel(stream, (level) => meter.current?.style.setProperty("--level", String(level)));

  const hasCamera = Boolean(stream?.getVideoTracks().length);
  const message = mediaMessage(status);

  return (
    <div className="devices">
      <div className="selfview">
        <video ref={video} autoPlay muted playsInline aria-label="Camera preview" hidden={!hasCamera} />
        {!hasCamera && <div className="selfview__off">{status === "ready" ? "No camera found" : "Camera off"}</div>}
      </div>
      <div className="field">
        <span className="field__label">Microphone level</span>
        <div className="meter" ref={meter} data-testid="mic-meter"><div className="meter__fill" /></div>
        <p className="field__help">{status === "ready" ? "Speak normally. The bar should move." : "Turn on the test to see your level."}</p>
        <div className="btn-row" style={{ marginTop: "var(--space-xs)" }}>
          {status === "ready" ? (
            <button type="button" className="btn" onClick={stop}>Stop test</button>
          ) : (
            <button type="button" className="btn" aria-busy={status === "requesting"} disabled={status === "requesting"} onClick={() => void start()}>Test mic and camera</button>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => {
              const { voiceURI, speechRate } = readSettings();
              speak("This is how your interviewer will sound.", { voiceURI, rate: speechRate });
            }}
          >
            Test speaker
          </button>
        </div>
        {message && <div className="notice" role="alert">{message}</div>}
      </div>
    </div>
  );
}
