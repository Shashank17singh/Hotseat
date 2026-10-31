"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MediaStatus = "idle" | "requesting" | "ready" | "denied" | "missing" | "unsupported" | "error";

function statusOf(error: unknown): MediaStatus {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "missing";
  return "error";
}

const VIDEO = { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } };
const AUDIO = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

export function useMedia() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<MediaStatus>("idle");
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current) return streamRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return null;
    }
    setStatus("requesting");
    try {
      let media: MediaStream;
      try {
        media = await navigator.mediaDevices.getUserMedia({ audio: AUDIO, video: VIDEO });
      } catch (error) {
        // A machine with a mic but no camera can still do the whole interview by voice.
        if (statusOf(error) !== "missing") throw error;
        media = await navigator.mediaDevices.getUserMedia({ audio: AUDIO });
        setCameraOn(false);
      }
      streamRef.current = media;
      setStream(media);
      setStatus("ready");
      return media;
    } catch (error) {
      setStatus(statusOf(error));
      return null;
    }
  }, []);

  const toggleMic = useCallback(() => {
    setMicOn((on) => {
      streamRef.current?.getAudioTracks().forEach((track) => (track.enabled = !on));
      return !on;
    });
  }, []);

  const toggleCamera = useCallback(() => {
    setCameraOn((on) => {
      streamRef.current?.getVideoTracks().forEach((track) => (track.enabled = !on));
      return !on;
    });
  }, []);

  useEffect(() => stop, [stop]);

  return { stream, status, micOn, cameraOn, start, stop, toggleMic, toggleCamera };
}

export function mediaMessage(status: MediaStatus) {
  switch (status) {
    case "denied":
      return "Camera and microphone access is blocked. Allow it in your browser's site settings, or type your answers instead.";
    case "missing":
      return "No microphone was found. Connect one, or type your answers instead.";
    case "unsupported":
      return "This browser cannot use a microphone here. The site must be on HTTPS, or you can type your answers.";
    case "error":
      return "The camera or microphone could not start. It may be in use by another app.";
    default:
      return "";
  }
}

// Reads the microphone level as 0 to 1 without re-rendering on each frame.
export function useLevel(stream: MediaStream | null, onLevel: (level: number) => void) {
  const callback = useRef(onLevel);
  useEffect(() => {
    callback.current = onLevel;
  });

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) return;
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const timer = window.setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, s) => sum + s * s, 0) / samples.length);
      callback.current(Math.min(1, rms * 4));
    }, 100);
    return () => {
      window.clearInterval(timer);
      source.disconnect();
      void context.close();
    };
  }, [stream]);
}
