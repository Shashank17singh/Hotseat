"use client";

import { useCallback, useEffect, useRef } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { PresenceTally } from "@/lib/presence";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const SAMPLE_MS = 500;

// Runs in the browser only. Frames are read from the video element and are never uploaded.
export function usePresence(enabled: boolean, video: React.RefObject<HTMLVideoElement | null>) {
  const landmarker = useRef<FaceLandmarker | null>(null);
  const tally = useRef(new PresenceTally());
  const sampling = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    (async () => {
      try {
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        const instance = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: "VIDEO",
          numFaces: 1,
        });
        if (disposed) instance.close();
        else landmarker.current = instance;
      } catch {
        // An optional measurement must never interrupt the interview.
      }
    })();
    return () => {
      disposed = true;
      landmarker.current?.close();
      landmarker.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      const element = video.current;
      if (!sampling.current || !landmarker.current || !element || element.readyState < 2) return;
      const result = landmarker.current.detectForVideo(element, performance.now());
      tally.current.add(result.faceLandmarks[0]);
    }, SAMPLE_MS);
    return () => window.clearInterval(timer);
  }, [enabled, video]);

  const begin = useCallback(() => {
    tally.current.reset();
    sampling.current = true;
  }, []);

  const end = useCallback(() => {
    sampling.current = false;
    return tally.current.ratio();
  }, []);

  return { begin, end };
}
