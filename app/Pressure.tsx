"use client";

import { useState } from "react";
import { DIFFICULTIES } from "@/lib/catalog";

const FOLLOW_UPS: Record<(typeof DIFFICULTIES)[number]["id"], string[]> = {
  easy: ["What did you enjoy most about that work?"],
  medium: ["How did you find out where the time was going?"],
  hard: ["How did you find out where the time was going?", "What did the cache cost you in consistency?"],
  bar_raiser: [
    "How did you find out where the time was going?",
    "What did the cache cost you in consistency?",
    "If traffic grew tenfold tomorrow, what breaks first?",
  ],
};

export function Pressure() {
  const [level, setLevel] = useState<(typeof DIFFICULTIES)[number]["id"]>("medium");
  return (
    <>
      <div className="seg" role="tablist" aria-label="Difficulty">
        {DIFFICULTIES.map((item) => (
          <button
            key={item.id} type="button" role="tab" className="btn" id={`tab-${item.id}`}
            aria-selected={level === item.id} aria-controls="press-panel" onClick={() => setLevel(item.id)}
          >
            <span className={`heat-key heat-${item.heat}`} style={{ width: 16 }} />
            {item.label}
          </button>
        ))}
      </div>
      <div className="press" role="tabpanel" id="press-panel" aria-labelledby={`tab-${level}`}>
        <div>
          <p className="press__label">From a sample resume</p>
          <p className="press__line">Cut checkout latency from 900 ms to 300 ms.</p>
        </div>
        <ol className="press__grid" style={{ margin: 0, paddingLeft: "var(--space-md)" }}>
          {FOLLOW_UPS[level].map((line) => <li key={line} style={{ fontSize: "var(--text-xl)", lineHeight: 1.3 }}>{line}</li>)}
        </ol>
      </div>
    </>
  );
}
