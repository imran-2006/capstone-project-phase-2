import { motion } from "framer-motion";

const LEVELS = ["Low", "Medium", "High", "Critical"];
const COLORS = ["#22c55e", "#eab308", "#f97316", "#ef4444"];
const CX = 120, CY = 120, R = 92;

const polar = (deg) => {
  const rad = (Math.PI / 180) * deg;
  return [CX + R * Math.cos(rad), CY - R * Math.sin(rad)];
};

// segment i spans 180deg -> 0deg split in four, with a small gap
const arc = (i) => {
  const start = 180 - i * 45 - 2;
  const end = 180 - (i + 1) * 45 + 2;
  const [x1, y1] = polar(start);
  const [x2, y2] = polar(end);
  return `M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`;
};

export default function RiskGauge({ level }) {
  const idx = Math.max(0, LEVELS.indexOf(level));
  const angle = -90 + 22.5 + idx * 45;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 240 140" className="w-full max-w-[280px]" role="img" aria-label={`Creative block risk: ${level}`}>
        {LEVELS.map((l, i) => (
          <path
            key={l}
            d={arc(i)}
            fill="none"
            stroke={COLORS[i]}
            strokeWidth="16"
            strokeLinecap="round"
            opacity={i === idx ? 1 : 0.28}
          />
        ))}
        <motion.g
          initial={{ rotate: -90 }}
          animate={{ rotate: angle }}
          transition={{ type: "spring", stiffness: 70, damping: 11, delay: 0.15 }}
          style={{ originX: `${CX}px`, originY: `${CY}px` }}
        >
          <line x1={CX} y1={CY} x2={CX} y2={CY - 70} stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </motion.g>
        <circle cx={CX} cy={CY} r="9" fill="currentColor" />
        <circle cx={CX} cy={CY} r="4" fill="#fff" />
      </svg>
      <p className="font-display text-3xl font-bold -mt-1" style={{ color: COLORS[idx] }}>
        {level} risk
      </p>
    </div>
  );
}
