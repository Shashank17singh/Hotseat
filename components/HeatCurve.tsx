"use client";

import { useEffect, useRef, useState } from "react";
import { heatStep } from "@/lib/score";

export type CurvePoint = { label: string; score: number; detail?: string };

const HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 32 };
const GRID = [0, 50, 100];

// Each segment takes the heat step of the score it climbs to, so the line reads like a firing curve.
export function HeatCurve({ points, caption }: { points: CurvePoint[]; caption: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (!box.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    observer.observe(box.current);
    return () => observer.disconnect();
  }, []);

  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length > 1 ? (i / (points.length - 1)) * plotWidth : plotWidth / 2);
  const y = (score: number) => PAD.top + (1 - score / 100) * plotHeight;
  const hitWidth = points.length > 1 ? plotWidth / (points.length - 1) : plotWidth;
  const labelEvery = Math.ceil(points.length / Math.max(1, Math.floor(plotWidth / 56)));

  return (
    <figure ref={box} className="curve" style={{ margin: 0 }}>
      <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label={caption}>
        {GRID.map((value) => (
          <g key={value}>
            <line className="curve__grid" x1={PAD.left} x2={width - PAD.right} y1={y(value)} y2={y(value)} />
            <text className="curve__tick" x={PAD.left - 8} y={y(value) + 4} textAnchor="end">{value}</text>
          </g>
        ))}
        {points.slice(1).map((point, i) => (
          <line
            key={i}
            x1={x(i)} y1={y(points[i].score)} x2={x(i + 1)} y2={y(point.score)}
            strokeWidth={2} strokeLinecap="round"
            style={{ stroke: `var(--heat-${heatStep(point.score)})` }}
          />
        ))}
        {points.map((point, i) => (
          <g key={point.label + i}>
            <circle className="curve__mark" cx={x(i)} cy={y(point.score)} r={active === i ? 7 : 5} style={{ fill: `var(--heat-${heatStep(point.score)})` }} />
            {i % labelEvery === 0 && (
              <text className="curve__tick" x={x(i)} y={HEIGHT - 8} textAnchor={i === 0 && points.length > 1 ? "start" : "middle"}>{point.label}</text>
            )}
            <rect
              className="curve__hit"
              x={x(i) - hitWidth / 2} y={0} width={hitWidth} height={HEIGHT}
              tabIndex={0}
              aria-label={`${point.label}: ${point.score}`}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            />
          </g>
        ))}
      </svg>
      {active !== null && (
        <div className="curve__tip" style={{ left: x(active), top: y(points[active].score) }}>
          <strong>{points[active].score}</strong> {points[active].label}
          {points[active].detail && <div>{points[active].detail}</div>}
        </div>
      )}
    </figure>
  );
}
