"use client";

export function englishVoices() {
  if (typeof speechSynthesis === "undefined") return [];
  return speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith("en"));
}

export function splitSentences(text: string) {
  return text.match(/[^.!?]+[.!?]*\s*/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
}

// Chrome silently stops long utterances, so text is spoken a sentence at a time.
export function speak(text: string, options: { voiceURI?: string; rate?: number } = {}) {
  let cancelled = false;
  const finished = new Promise<void>((resolve) => {
    if (typeof speechSynthesis === "undefined" || !text.trim()) return resolve();
    speechSynthesis.cancel();
    const voices = englishVoices();
    if (voices.length === 0) return resolve();
    const voice = voices.find((v) => v.voiceURI === options.voiceURI);
    const sentences = splitSentences(text);

    const next = (index: number) => {
      if (cancelled || index >= sentences.length) return resolve();
      const utterance = new SpeechSynthesisUtterance(sentences[index]);
      if (voice) utterance.voice = voice;
      utterance.rate = options.rate ?? 1;
      // Some engines never fire `end`; this keeps the interview from hanging on a silent question.
      const guard = window.setTimeout(() => next(index + 1), 3000 + sentences[index].length * 110);
      const advance = () => {
        window.clearTimeout(guard);
        next(index + 1);
      };
      utterance.onend = advance;
      utterance.onerror = advance;
      speechSynthesis.speak(utterance);
    };
    next(0);
  });

  return {
    finished,
    cancel() {
      cancelled = true;
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    },
  };
}

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

function recognitionClass() {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

// Live captions are a convenience and a fallback. Browsers without this API still get a Whisper transcript.
export function startCaptions(onCaption: (text: string) => void) {
  const Recognizer = recognitionClass();
  if (!Recognizer) return { stop: () => "" };

  let finalText = "";
  let stopped = false;
  const recognizer = new Recognizer();
  recognizer.continuous = true;
  recognizer.interimResults = true;
  recognizer.lang = navigator.language.startsWith("en") ? navigator.language : "en-US";
  recognizer.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (result.isFinal) finalText += `${result[0].transcript} `;
      else interim += result[0].transcript;
    }
    onCaption(`${finalText}${interim}`.trim());
  };
  recognizer.onerror = () => undefined;
  // Chrome ends recognition after a long silence, so it is restarted until the answer stops.
  recognizer.onend = () => {
    if (stopped) return;
    try {
      recognizer.start();
    } catch {
      stopped = true;
    }
  };
  try {
    recognizer.start();
  } catch {
    stopped = true;
  }

  return {
    stop() {
      stopped = true;
      try {
        recognizer.stop();
      } catch {
        // Already stopped.
      }
      return finalText.trim();
    },
  };
}
