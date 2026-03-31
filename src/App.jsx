import React, { useState, useRef, useEffect, useCallback } from 'react';

// --- CUSTOM ANIMATION STYLES ---
const customStyles = `
  @keyframes needle-flick {
    0% { transform: rotate(0deg); }
    50% { transform: rotate(-25deg); }
    100% { transform: rotate(0deg); }
  }
  .animate-needle {
    transform-origin: 20px 10px;
    animation: needle-flick 0.1s infinite linear;
  }
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 15px rgba(255, 215, 0, 0.4), inset 0 4px 10px rgba(255,255,255,0.5); transform: scale(1); }
    50% { box-shadow: 0 0 40px rgba(255, 215, 0, 1), inset 0 4px 10px rgba(255,255,255,0.8); transform: scale(1.05); }
  }
  .animate-pulse-glow {
    animation: pulse-glow 2s infinite ease-in-out;
  }
  @keyframes pop-in {
    0% { transform: scale(0.8); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  .animate-pop-in {
    animation: pop-in 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }
  @keyframes star-burst {
    0% { transform: translate(0, 0) scale(0.5) rotate(0deg); opacity: 1; }
    100% { transform: translate(var(--tx), var(--ty)) scale(2) rotate(360deg); opacity: 0; }
  }
  .star-particle {
    position: absolute;
    animation: star-burst 1s ease-out forwards;
  }
`;

// --- AUDIO UTILS ---
let audioCtx = null;

const initAudio = () => {
  if (typeof window !== 'undefined') {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }
  return audioCtx;
};

const playTickSound = () => {
  const ctx = initAudio();
  if (!ctx) return;
  
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.05);
  
  gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
  
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  
  osc.start();
  osc.stop(ctx.currentTime + 0.05);
};

const playWinSound = () => {
  const ctx = initAudio();
  if (!ctx) return;

  const now = ctx.currentTime;
  const frequencies = [523.25, 659.25, 783.99, 1046.50];
  
  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = freq;
    
    const startTime = now + (i * 0.1);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(startTime);
    osc.stop(startTime + 0.5);
  });
};

// --- MATH UTILS ---
const polarToCartesian = (cx, cy, r, angleInDegrees) => {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: cx + (r * Math.cos(angleInRadians)),
    y: cy + (r * Math.sin(angleInRadians))
  };
};

const getSegmentPath = (cx, cy, r, startAngle, endAngle) => {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M", cx, cy,
    "L", start.x, start.y,
    "A", r, r, 0, largeArcFlag, 1, end.x, end.y,
    "Z"
  ].join(" ");
};

// --- SPIN WHEEL COMPONENT ---
export const SpinWheel = ({ segments, onComplete, spinDuration = 5000 }) => {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const wheelRef = useRef(null);
  const animationFrameRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (isSpinning) {
      let lastSegment = null;
      
      const checkRotation = () => {
        if (wheelRef.current) {
          const st = window.getComputedStyle(wheelRef.current);
          const tr = st.getPropertyValue("-webkit-transform") || st.getPropertyValue("transform");
          
          if (tr !== 'none') {
            const values = tr.split('(')[1].split(')')[0].split(',');
            const a = values[0];
            const b = values[1];
            let angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));
            if (angle < 0) angle += 360;

            const segmentAngle = 360 / segments.length;
            const currentSegment = Math.floor(((360 - angle) + (segmentAngle / 2)) % 360 / segmentAngle) % segments.length;
            
            if (lastSegment !== null && currentSegment !== lastSegment) {
              playTickSound();
            }
            lastSegment = currentSegment;
          }
        }
        animationFrameRef.current = requestAnimationFrame(checkRotation);
      };
      
      animationFrameRef.current = requestAnimationFrame(checkRotation);
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isSpinning, segments.length]);

  const handleSpin = useCallback(() => {
    if (isSpinning) return;
    initAudio();
    
    setIsSpinning(true);
    
    const segmentCount = segments.length;
    const segmentAngle = 360 / segmentCount;
    
    const targetIndex = Math.floor(Math.random() * segmentCount);
    const baseTargetAngle = (segmentCount - targetIndex) * segmentAngle;
    const jitter = (Math.random() - 0.5) * (segmentAngle * 0.8);
    const targetDegree = baseTargetAngle + jitter;

    const currentMod = rotation % 360;
    let degreesToAdd = targetDegree - currentMod;
    
    if (degreesToAdd <= 0) degreesToAdd += 360;

    const fullSpins = 5 * 360;
    const newRotation = rotation + fullSpins + degreesToAdd;

    setRotation(newRotation);

    timeoutRef.current = setTimeout(() => {
      setIsSpinning(false);
      playWinSound();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (onComplete) onComplete(segments[targetIndex]);
    }, spinDuration);
    
  }, [isSpinning, rotation, segments, onComplete, spinDuration]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const svgSize = 300;
  const center = svgSize / 2;
  const outerRadius = 140;
  const innerRadius = 130;

  return (
    <div className="relative flex flex-col items-center justify-center select-none w-full max-w-[400px] aspect-square animate-pop-in">
      
      {/* Pointer Needle */}
      <div className={`absolute top-[-10px] z-20 drop-shadow-lg transition-transform ${isSpinning ? 'animate-needle' : ''}`}>
        <svg width="40" height="50" viewBox="0 0 40 50">
          <polygon points="5,0 35,0 20,40" fill="#FFD700" stroke="#B8860B" strokeWidth="2" />
          <polygon points="10,5 30,5 20,32" fill="#FFE866" />
        </svg>
      </div>

      {/* Wheel Container */}
      <div className="relative w-full h-full overflow-hidden rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.5)] bg-blue-900 border-4 border-blue-950">
        <div 
          ref={wheelRef}
          className="w-full h-full"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: `transform ${spinDuration}ms cubic-bezier(0.15, 0.85, 0.25, 1)`,
          }}
        >
          <svg viewBox={`0 0 ${svgSize} ${svgSize}`} className="w-full h-full">
            {/* Outer Ring */}
            <circle cx={center} cy={center} r={outerRadius} fill="#1a448a" />
            
            {/* Outer Ring Dots */}
            {Array.from({ length: 24 }).map((_, i) => {
              const pos = polarToCartesian(center, center, outerRadius - 5, i * 15);
              return (
                <circle key={`dot-${i}`} cx={pos.x} cy={pos.y} r="3" fill={i % 2 === 0 ? "#FFFFFF" : "#FFD700"} />
              );
            })}

            {/* Inner Wheel Background */}
            <circle cx={center} cy={center} r={innerRadius} fill="#1E5BB2" />

            {/* Segments */}
            {segments.map((segment, index) => {
              const segmentAngle = 360 / segments.length;
              const startAngle = -segmentAngle / 2;
              const endAngle = segmentAngle / 2;

              // Place text 55% of the way out from center along the segment's midline
              const textRadius = innerRadius * 0.55;
              // In the local (pre-rotation) segment space, midline points straight up → textY < center
              const textX = center;
              const textY = center - textRadius;
              // Total rotation applied to this segment group
              const segRotation = index * segmentAngle;

              const words = segment.label.split(' ');

              return (
                <g key={segment.id} transform={`rotate(${segRotation}, ${center}, ${center})`}>
                  {/* Wedge Path */}
                  <path
                    d={getSegmentPath(center, center, innerRadius, startAngle, endAngle)}
                    fill={segment.bgColor}
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="1"
                  />

                  {/* Counter-rotate text so it always reads upright */}
                  <g transform={`translate(${textX}, ${textY}) rotate(${-segRotation})`}>
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={segment.textColor}
                      fontSize="13"
                      fontWeight="900"
                      fontFamily="Arial, sans-serif"
                    >
                      {words.length > 1 ? (
                        <>
                          <tspan x="0" dy="-7">{words[0]}</tspan>
                          <tspan x="0" dy="16">{words.slice(1).join(' ')}</tspan>
                        </>
                      ) : (
                        <tspan x="0" dy="0">{segment.label}</tspan>
                      )}
                    </text>
                  </g>
                </g>
              );
            })}
            
            {/* Inner Decoration Circle */}
            <circle cx={center} cy={center} r="30" fill="#1a448a" />
          </svg>
        </div>
      </div>

      {/* Center SPIN Button */}
      <button 
        onClick={handleSpin}
        disabled={isSpinning}
        className={`absolute z-10 w-24 h-24 rounded-full border-[6px] border-yellow-200 
          bg-gradient-to-b from-yellow-300 to-yellow-600 
          flex items-center justify-center font-black text-xl text-blue-950 tracking-wider
          transition-all duration-200 ease-in-out
          ${isSpinning ? 'cursor-not-allowed scale-95 opacity-90 shadow-none' : 'animate-pulse-glow hover:scale-110 active:scale-95 cursor-pointer'}
        `}
      >
        SPIN
      </button>
    </div>
  );
};


// --- DEMO APP WRAPPER ---
export default function App() {
  const [lastWin, setLastWin] = useState(null);
  const [showParticles, setShowParticles] = useState(false);

  const defaultSegments = [
    { id: 1, label: '50% BONUS', bgColor: '#9fc7e8', textColor: '#ffffff' },
    { id: 2, label: 'NO WIN', bgColor: '#e3eff7', textColor: '#1e3a8a' },
    { id: 3, label: 'BONUS 150%', bgColor: '#1c55c4', textColor: '#ffffff' },
    { id: 4, label: 'TRY AGAIN', bgColor: '#9fc7e8', textColor: '#ffffff' },
    { id: 5, label: 'BONUS 50%', bgColor: '#e3eff7', textColor: '#1e3a8a' },
    { id: 6, label: '150% BONUS', bgColor: '#1c55c4', textColor: '#ffffff' },
  ];

  const handleComplete = (segment) => {
    setLastWin(segment);
    console.log("Segment Won:", segment);
    
    if (segment.label !== 'NO WIN' && segment.label !== 'TRY AGAIN') {
      setShowParticles(true);
      setTimeout(() => setShowParticles(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 via-blue-700 to-blue-400 flex flex-col items-center justify-center p-4 font-sans text-white overflow-hidden relative">
      <style>{customStyles}</style>
      
      {/* Confetti/Particle Layer */}
      {showParticles && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50 flex items-center justify-center">
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 360) / 24;
            const distance = 120 + Math.random() * 150;
            const tx = `${Math.cos(angle * Math.PI / 180) * distance}px`;
            const ty = `${Math.sin(angle * Math.PI / 180) * distance}px`;
            return (
              <div 
                key={i} 
                className="star-particle text-yellow-300 drop-shadow-lg font-black"
                style={{ '--tx': tx, '--ty': ty, fontSize: `${Math.random() * 20 + 10}px` }}
              >
                ✦
              </div>
            );
          })}
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-8 z-10 animate-pop-in" style={{ opacity: 0, animationDelay: '0.1s' }}>
        <h1 className="text-4xl md:text-6xl font-black italic tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 drop-shadow-md">
          WHEEL OF BONUS
        </h1>
        <p className="mt-2 text-blue-200 font-semibold text-lg tracking-widest uppercase">
          Spin to Claim Your Prize
        </p>
      </div>

      {/* The Wheel */}
      <SpinWheel 
        segments={defaultSegments} 
        onComplete={handleComplete} 
        spinDuration={5000} 
      />

      {/* Result Display */}
      <div className="mt-12 h-20 flex items-center justify-center z-10">
        {lastWin && (
          <div className="animate-bounce flex flex-col items-center">
            <span className="text-blue-100 text-sm font-bold uppercase tracking-widest">
              You Landed On
            </span>
            <span className={`text-3xl font-black px-6 py-2 rounded-lg shadow-lg mt-2 ${
                lastWin.label === 'NO WIN' || lastWin.label === 'TRY AGAIN' 
                  ? 'bg-slate-700 text-white' 
                  : 'bg-yellow-400 text-blue-900'
              }`}
            >
              {lastWin.label}
            </span>
          </div>
        )}
      </div>

    </div>
  );
}
