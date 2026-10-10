import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, CheckCircle2, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import SliderInput from "../components/SliderInput";
import SelectInput from "../components/SelectInput";
import RiskGauge from "../components/RiskGauge";
import FactorBars from "../components/FactorBars";
import ForecastCard from "../components/ForecastCard";
import { useCreator } from "../context/CreatorContext";
import { fieldDisplay } from "../data/creatorFields";

const STRESS_LEVELS = ["Low", "Medium", "High", "Very High"];
const INSPIRATION_LEVELS = ["Very Low", "Low", "Medium", "High", "Very High"];
const MOODS = ["Happy", "Neutral", "Motivated", "Tired", "Sad", "Frustrated"];
const BREAK_FREQ = ["Rarely", "Sometimes", "Often"];

const DEFAULT_FORM = {
  sleep_hours: 7,
  stress_level: "Medium",
  work_hours: 8,
  inspiration_level: "Medium",
  mood: "Neutral",
  energy_level: 6,
  focus_level: 6,
  screen_time: 5,
  break_frequency: "Sometimes",
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

export default function Dashboard() {
  const { user } = useAuth();
  const { profile, personalization } = useCreator();
  const fieldName = fieldDisplay(profile);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const update = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const handleAnalyze = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await client.post("/predict", form);
      setResult(res.data);
      toast.success("Analysis complete");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Prediction failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm font-medium text-primary-600 dark:text-primary-300">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="font-display text-4xl font-bold mt-1">
          {greeting()}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-xl">
          How are you really doing today? Log your metrics to predict and prevent a creative block.
        </p>
        {fieldName && (
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium px-3 py-1 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 hover:bg-primary-100"
          >
            {fieldName}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Daily Check-in Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="card p-6"
        >
          <h2 className="font-semibold text-lg mb-5 flex items-center gap-2">
            <Sparkles size={18} className="text-primary-600" />
            Daily Check-in
          </h2>

          <div className="space-y-5">
            <SliderInput label="Sleep Hours" value={form.sleep_hours} onChange={update("sleep_hours")} min={0} max={12} step={0.5} unit="h" />
            <SelectInput label="Stress Level" value={form.stress_level} onChange={update("stress_level")} options={STRESS_LEVELS} />
            <SliderInput label="Work Hours" value={form.work_hours} onChange={update("work_hours")} min={0} max={16} step={0.5} unit="h" />
            <SelectInput label="Inspiration Level" value={form.inspiration_level} onChange={update("inspiration_level")} options={INSPIRATION_LEVELS} />
            <SelectInput label="Current Mood" value={form.mood} onChange={update("mood")} options={MOODS} />
            <SliderInput label="Energy Level" value={form.energy_level} onChange={update("energy_level")} min={1} max={10} />
            <SliderInput label="Focus Level" value={form.focus_level} onChange={update("focus_level")} min={1} max={10} />
            <SliderInput label="Screen Time" value={form.screen_time} onChange={update("screen_time")} min={0} max={12} step={0.5} unit="h" />
            <SelectInput label="Break Frequency" value={form.break_frequency} onChange={update("break_frequency")} options={BREAK_FREQ} />

            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="w-full btn-primary text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60 mt-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              Analyze My Risk
            </button>
          </div>
        </motion.div>

        {/* Right column: Result + Explanation + Suggestions + Forecast */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="card p-6"
              >
                <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <TrendingUp size={18} className="text-primary-600" />
                  Prediction Result
                </h2>

                <div className="mb-5">
                  <RiskGauge level={result.risk_level} />
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Confidence</span>
                    <span className="text-sm font-semibold">{result.confidence}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${result.confidence}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="h-full bg-primary-600 rounded-full"
                    />
                  </div>
                </div>

                {result.risk_level === "High" || result.risk_level === "Critical" ? (
                  <Link
                    to="/rescue"
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-violet-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:from-primary-500 hover:to-violet-500"
                  >
                    Start Rescue Mode
                  </Link>
                ) : null}

                <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 mt-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Reason: </span>
                    {result.reason}
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty-result"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="card p-6 flex flex-col items-center justify-center text-center py-12"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-3">
                  <Sparkles size={24} className="text-primary-600" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                  Fill in your daily check-in and click "Analyze My Risk" to see your prediction.
                </p>
                {personalization.daily_prompt && (
                  <p className="text-xs text-primary-700 dark:text-primary-200 bg-primary-50 dark:bg-primary-900/30 rounded-xl px-3 py-2 mt-4 max-w-xs">
                    {fieldName ? `Creative prompt for you: ` : "Creative prompt: "}
                    {personalization.daily_prompt}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {result && <FactorBars factors={result.factors} />}

          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="card p-6"
            >
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-primary-600" />
                Recovery Suggestions
              </h2>
              <ul className="space-y-2.5">
                {result.suggestions.map((s, i) => (
                  <motion.li
                    key={s}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.06 }}
                    className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <CheckCircle2 size={16} className="text-primary-500 mt-0.5 flex-shrink-0" />
                    {s}
                  </motion.li>
                ))}
              </ul>

              {personalization.recovery_tips.length > 0 && (
                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-sm font-medium mb-2">
                    {fieldName ? `For your ${fieldName} work` : "Creative warm-ups"}
                  </p>
                  <ul className="space-y-2">
                    {personalization.recovery_tips.map((tip) => (
                      <li key={tip} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                        <Sparkles size={15} className="text-primary-500 mt-0.5 flex-shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                  {personalization.warmup && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                      Quick warm-up: {personalization.warmup}
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          )}

          <ForecastCard refreshKey={result?.checkin_id ?? 0} />
        </div>
      </div>
    </div>
  );
}
