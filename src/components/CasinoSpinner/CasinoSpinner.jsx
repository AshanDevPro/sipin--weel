import React, { useEffect, useMemo, useRef, useState } from "react";
import "./CasinoSpinner.css";

const SEGMENT_COUNT = 6;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;
const BULB_COUNT = 24;
const BULB_ANGLE = 360 / BULB_COUNT;
const DEFAULT_SPIN_DURATION = 5400;

const defaultColors = [
  "#7cc5ff",
  "#d9f2ff",
  "#1d5fe3",
  "#a6dbff",
  "#d5ecff",
  "#2850cf",
];

export const defaultValues = [
  { id: 1, label: "50% BONUS" },
  { id: 2, label: "NO WIN" },
  { id: 3, label: "150% BONUS" },
  { id: 4, label: "TRY AGAIN" },
  { id: 5, label: "100% BONUS" },
  { id: 6, label: "FREE SPINS" },
];

/**
 * CasinoSpinner
 *
 * Reusable 6-segment casino wheel.
 *
 * Props:
 * - values: Array<string | number | { id?: string | number; label: string; color?: string; textColor?: string }>
 * - onResult?: ({ index, id, label, item }) => void
 * - enableSound?: boolean
 * - className?: string
 * - title?: string
 * - subtitle?: string
 * - spinLabel?: string
 * - spinDuration?: number
 */
export default function CasinoSpinner({
  values = defaultValues,
  onResult,
  enableSound = false,
  className = "",
  eyebrow = "Casino Bonus Wheel",
  title = "Lucky Bonus Spin",
  subtitle = "Tap the wheel for one fair random reward.",
  spinLabel = "SPIN",
  spinDuration = DEFAULT_SPIN_DURATION,
  showHeader = true,
  showResult = true,
  resultLabel = "Selected Result",
  resultPlaceholder = "Tap spin to reveal your bonus",
}) {
  const items = useMemo(() => normalizeValues(values), [values]);
  const shouldShowHeader = showHeader && (eyebrow || title || subtitle);

  const wheelRef = useRef(null);
  const rotationRef = useRef(0);
  const animationFrameRef = useRef(0);
  const tickBucketRef = useRef(-1);
  const tickAudioRef = useRef(null);
  const winAudioRef = useRef(null);

  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [activeBulb, setActiveBulb] = useState(-1);

  useEffect(() => {
    if (wheelRef.current) {
      wheelRef.current.style.transform = "rotate(0deg)";
    }
  }, []);

  useEffect(() => {
    if (!enableSound) {
      cleanupAudio(tickAudioRef.current);
      cleanupAudio(winAudioRef.current);
      tickAudioRef.current = null;
      winAudioRef.current = null;
      return undefined;
    }

    tickAudioRef.current = createTickAudio();
    winAudioRef.current = createWinAudio();

    return () => {
      cleanupAudio(tickAudioRef.current);
      cleanupAudio(winAudioRef.current);
      tickAudioRef.current = null;
      winAudioRef.current = null;
    };
  }, [enableSound]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      cleanupAudio(tickAudioRef.current);
      cleanupAudio(winAudioRef.current);
    };
  }, []);

  const spin = () => {
    if (isSpinning) {
      return;
    }

    const winnerIndex = Math.floor(Math.random() * SEGMENT_COUNT);
    const winnerItem = items[winnerIndex];
    const payload = {
      index: winnerIndex,
      id: winnerItem.id,
      label: winnerItem.label,
      item: winnerItem,
    };

    const currentRotation = rotationRef.current;
    const currentNormalized = normalizeAngle(currentRotation);
    const targetNormalized = normalizeAngle(360 - winnerIndex * SEGMENT_ANGLE);
    const deltaToTarget = normalizeAngle(targetNormalized - currentNormalized);
    const fullTurns = 5 + Math.floor(Math.random() * 3);
    const endRotation = currentRotation + fullTurns * 360 + deltaToTarget;

    cancelAnimationFrame(animationFrameRef.current);
    tickBucketRef.current = Math.floor(currentNormalized / BULB_ANGLE);
    setSelectedResult(null);
    setIsSpinning(true);

    const startTime = performance.now();

    const step = (now) => {
      const progress = Math.min((now - startTime) / spinDuration, 1);
      const easedProgress = easeOutQuint(progress);
      const nextRotation = currentRotation + (endRotation - currentRotation) * easedProgress;

      rotationRef.current = nextRotation;
      applyRotation(wheelRef.current, nextRotation);
      syncBulbState(nextRotation, setActiveBulb, tickBucketRef, tickAudioRef, enableSound);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
        return;
      }

      setIsSpinning(false);
      setSelectedResult(payload);
      playAudio(winAudioRef.current, enableSound);
      onResult?.(payload);
    };

    animationFrameRef.current = requestAnimationFrame(step);
  };

  return (
    <section className={`casino-spinner ${className}`.trim()}>
      {shouldShowHeader ? (
        <div className="casino-spinner__header">
          {eyebrow ? <span className="casino-spinner__eyebrow">{eyebrow}</span> : null}
          {title ? <h2 className="casino-spinner__title">{title}</h2> : null}
          {subtitle ? <p className="casino-spinner__subtitle">{subtitle}</p> : null}
        </div>
      ) : null}

      <div className="casino-spinner__stage">
        <div className="casino-spinner__pointer" aria-hidden="true">
          <span className="casino-spinner__pointer-core" />
        </div>

        <div className="casino-spinner__frame">
          <div className="casino-spinner__rim" />
          <div className="casino-spinner__shine" />

          <div ref={wheelRef} className="casino-spinner__wheel">
            <WheelSvg items={items} />

            {Array.from({ length: BULB_COUNT }).map((_, bulbIndex) => {
              const angle = bulbIndex * BULB_ANGLE - 90;
              const radius = 46;
              const x = 50 + Math.cos((angle * Math.PI) / 180) * radius;
              const y = 50 + Math.sin((angle * Math.PI) / 180) * radius;
              const isActive = activeBulb === bulbIndex;

              return (
                <span
                  key={`bulb-${bulbIndex}`}
                  className={`casino-spinner__bulb${bulbIndex % 4 === 0 ? " is-accent" : ""}${
                    isActive ? " is-active" : ""
                  }`}
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                  }}
                />
              );
            })}
          </div>

          <div className="casino-spinner__button-wrap">
            <button
              type="button"
              className="casino-spinner__button"
              onClick={spin}
              disabled={isSpinning}
              aria-label={isSpinning ? "Wheel spinning" : "Spin the wheel"}
            >
              <span>{isSpinning ? "..." : spinLabel}</span>
            </button>
          </div>
        </div>
      </div>

      {showResult ? (
        <div className="casino-spinner__result" aria-live="polite">
          <div className="casino-spinner__result-copy">
            <span className="casino-spinner__result-label">{resultLabel}</span>
            <strong className="casino-spinner__result-value">
              {selectedResult ? selectedResult.label : resultPlaceholder}
            </strong>
          </div>
          <span className="casino-spinner__result-tag">
            {selectedResult ? `ID ${selectedResult.id}` : "WAITING"}
          </span>
        </div>
      ) : null}
    </section>
  );
}

function WheelSvg({ items }) {
  const size = 1000;
  const center = size / 2;
  const radius = 475;
  const textRadius = 305;

  return (
    <svg
      className="casino-spinner__svg"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Casino prize wheel"
    >
      {items.map((item, index) => {
        const startAngle = -90 - SEGMENT_ANGLE / 2 + index * SEGMENT_ANGLE;
        const endAngle = startAngle + SEGMENT_ANGLE;
        const midAngle = startAngle + SEGMENT_ANGLE / 2;
        const textPosition = polarToCartesian(center, center, textRadius, midAngle);

        return (
          <g key={item.id}>
            <path
              d={describeSlice(center, center, radius, startAngle, endAngle)}
              fill={item.color}
              stroke="rgba(235, 246, 255, 0.95)"
              strokeWidth="9"
            />

            <g
              transform={`translate(${textPosition.x}, ${textPosition.y}) rotate(${midAngle + 90})`}
            >
              {splitLabel(item.label).map((line, lineIndex, lines) => (
                <text
                  key={`${item.id}-${lineIndex}`}
                  x="0"
                  y={(lineIndex - (lines.length - 1) / 2) * 40}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={item.textColor}
                  fontSize="38"
                  fontWeight="900"
                  letterSpacing="1.6"
                >
                  {line}
                </text>
              ))}
            </g>
          </g>
        );
      })}

      <circle
        cx={center}
        cy={center}
        r="155"
        fill="transparent"
        stroke="rgba(255, 255, 255, 0.18)"
        strokeWidth="16"
      />
    </svg>
  );
}

function normalizeValues(values) {
  const entries = Array.isArray(values) ? values.slice(0, SEGMENT_COUNT) : [];

  while (entries.length < SEGMENT_COUNT) {
    entries.push(defaultValues[entries.length]);
  }

  return entries.map((value, index) => {
    const fallback = defaultValues[index];
    const item =
      value && typeof value === "object" && !Array.isArray(value)
        ? value
        : { label: String(value ?? fallback.label) };
    const color = item.color ?? defaultColors[index % defaultColors.length];

    return {
      id: item.id ?? fallback.id,
      label: String(item.label ?? fallback.label),
      color,
      textColor: item.textColor ?? getTextColor(color),
    };
  });
}

function applyRotation(node, angle) {
  if (!node) {
    return;
  }

  node.style.transform = `rotate(${angle}deg)`;
}

function syncBulbState(angle, setActiveBulb, tickBucketRef, tickAudioRef, enableSound) {
  const normalized = normalizeAngle(angle);
  const bucket = Math.floor(normalized / BULB_ANGLE);

  if (bucket === tickBucketRef.current) {
    return;
  }

  tickBucketRef.current = bucket;
  setActiveBulb(((bucket % BULB_COUNT) + BULB_COUNT) % BULB_COUNT);
  playAudio(tickAudioRef.current, enableSound);
}

function normalizeAngle(angle) {
  return ((angle % 360) + 360) % 360;
}

function easeOutQuint(progress) {
  return 1 - Math.pow(1 - progress, 5);
}

function polarToCartesian(cx, cy, radius, angleInDegrees) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeSlice(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

function splitLabel(label) {
  const words = String(label).trim().split(/\s+/).filter(Boolean);

  if (words.length <= 2) {
    return [words.join(" ")];
  }

  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
}

function getTextColor(backgroundColor) {
  const hex = backgroundColor.replace("#", "");

  if (hex.length !== 6) {
    return "#09203b";
  }

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const brightness = red * 0.299 + green * 0.587 + blue * 0.114;

  return brightness < 160 ? "#ffffff" : "#09203b";
}

function playAudio(audio, enabled) {
  if (!enabled || !audio?.play) {
    return;
  }

  audio.play();
}

function cleanupAudio(audio) {
  if (!audio?.dispose) {
    return;
  }

  audio.dispose();
}

function createTickAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  const context = new AudioContextClass();

  return {
    play() {
      if (context.state === "suspended") {
        context.resume();
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(1250, context.currentTime);
      gain.gain.setValueAtTime(0.024, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.028);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.032);
    },
    dispose() {
      if (context.state !== "closed") {
        context.close();
      }
    },
  };
}

function createWinAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  const context = new AudioContextClass();

  return {
    play() {
      if (context.state === "suspended") {
        context.resume();
      }

      const start = context.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];

      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const noteStart = start + index * 0.09;

        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(frequency, noteStart);
        gain.gain.setValueAtTime(0.001, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.08, noteStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.26);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(noteStart);
        oscillator.stop(noteStart + 0.3);
      });
    },
    dispose() {
      if (context.state !== "closed") {
        context.close();
      }
    },
  };
}
