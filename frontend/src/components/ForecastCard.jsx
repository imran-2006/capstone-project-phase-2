import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarClock, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
import client from "../api/client";
import RiskBadge from "./RiskBadge";

const TREND_STYLES = {
  worsening: { icon: TrendingUp, text: "Trending up", color: "text-red-500" },
  improving: { icon: TrendingDown, text: "Trending down", color: "text-green-600 dark:text-green-400" },
  stable: { icon: Minus, text: "Steady", color: "text-gray-500 dark:text-gray-400" },
};

// Tiny inline chart: recent risk scores (solid) + forecast (dashed, hollow dot)
function Sparkline({ recent, forecast }) {
  const W = 220;
  const H = 56;
  const PAD = 6;
  const total = recent.length + 1;
  const x = (i) => PAD + (i * (W - PAD * 2)) / (total - 1);
  const y = (score) => H - PAD - (score / 3) * (H - PAD * 2);

  const points = recent.map((s, i) => `${x(i)},${y(s)}`).join(" ");
  const lastX = x(recent.length - 1);
  const lastY = y(recent[recent.length - 1]);
  const fx = x(recent.length);
  const fy = y(forecast);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14">
      <polyline points={points} fill="none" stroke="#6339e6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {recent.map((s, i) => (
        <circle key={i} cx={x(i)} cy={y(s)} r="2.5" fill="#6339e6" />
      ))}
      <line x1={lastX} y1={lastY} x2={fx} y2={fy} stroke="#f97316" strokeWidth="2" strokeDasharray="4 3" />
      <circle cx={fx} cy={fy} r="4" fill="white" stroke="#f97316" strokeWidth="2" />
    </svg>
  );
}

export default function ForecastCard({ refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    client
      .get("/forecast")
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="card p-6"
    >
      <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
        <CalendarClock size={18} className="text-primary-600" />
        Risk Forecast
      </h2>

      {loading && (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-primary-600" size={22} />
        </div>
      )}

      {!loading && failed && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Couldn't load the forecast right now.
        </p>
      )}

      {!loading && !failed && data && !data.available && (
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{data.message}</p>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-2 flex-1 rounded-full ${
                  i < data.based_on ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {!loading && !failed && data && data.available && (() => {
        const trend = TREND_STYLES[data.trend] || TREND_STYLES.stable;
        const TrendIcon = trend.icon;
        return (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Next check-in estimate</p>
                <RiskBadge level={data.forecast_level} />
              </div>
              <div className={`flex items-center gap-1.5 text-sm font-medium ${trend.color}`}>
                <TrendIcon size={16} />
                {trend.text}
              </div>
            </div>

            <Sparkline recent={data.recent} forecast={data.forecast_score} />
            <div className="flex items-center gap-4 mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary-600" /> Past check-ins
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-orange-500 bg-white" /> Forecast
              </span>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300">{data.message}</p>
            <p className="text-xs text-gray-400 mt-3">
              Estimate based on your last {data.based_on} check-ins, not a guarantee.
            </p>
          </div>
        );
      })()}
    </motion.div>
  );
}
