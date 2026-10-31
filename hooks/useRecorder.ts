"use client";

import { useCallback, useRef } from "react";

export const LEVEL_INTERVAL_MS = 100;

export type Recording = {
  audio: Blob;
  clip: Blob | null;
  seconds: number;
  levels: number[];
};

function pickType(candidates: string[]) {
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function record(stream: MediaStream, options: MediaRecorderOptions) {
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, options);
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
  });
  recorder.start(1000);
  return { recorder, stopped };
}

// Two recorders run together: small audio for transcription, and a fuller clip that never leaves the device.
export function useRecorder() {
  const active = useRef<{
    audio: ReturnType<typeof record>;
    clip: ReturnType<typeof record> | null;
    startedAt: number;
    levels: number[];
  } | null>(null);

  const start = useCallback((stream: MediaStream, keepVideo: boolean) => {
    const audioStream = new MediaStream(stream.getAudioTracks());
    const audio = record(audioStream, {
      mimeType: pickType(["audio/webm;codecs=opus", "audio/mp4", "audio/webm"]),
      audioBitsPerSecond: 24_000,
    });
    const hasVideo = keepVideo && stream.getVideoTracks().some((t) => t.enabled);
    const clip = hasVideo
      ? record(stream, {
          mimeType: pickType(["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/mp4"]),
          videoBitsPerSecond: 500_000,
          audioBitsPerSecond: 32_000,
        })
      : null;
    active.current = { audio, clip, startedAt: performance.now(), levels: [] };
  }, []);

  const pushLevel = useCallback((level: number) => {
    active.current?.levels.push(level);
  }, []);

  const stop = useCallback(async (): Promise<Recording | null> => {
    const session = active.current;
    if (!session) return null;
    active.current = null;
    session.audio.recorder.stop();
    session.clip?.recorder.stop();
    const [audio, clip] = await Promise.all([session.audio.stopped, session.clip?.stopped ?? null]);
    return {
      audio,
      clip: clip ?? audio,
      seconds: (performance.now() - session.startedAt) / 1000,
      levels: session.levels,
    };
  }, []);

  return { start, stop, pushLevel };
}
