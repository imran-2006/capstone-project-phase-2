import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";

export default function FactorBars({ factors }) {
  if (!factors || factors.length === 0) return null;

  const maxImpact = Math.max(...factors.map((f) => f.impact_pct));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      className="card p-6"
    >
      <h2 className="font-semibold text-lg mb-1 flex items-center gap-2">
        <Lightbulb size={18} className="text-primary-600" />
        Why this prediction?
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        How much each factor moved your risk compared with a typical day.
      </p>

      <div className="space-y-3.5">
        {factors.map((f, i) => {
          const raises = f.direction === "increases";
          return (
            <div key={f.feature}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium truncate">{f.label}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {f.value}
                  </span>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    raises ? "text-red-500" : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {raises ? "+" : "-"}
                  {f.impact_pct}%
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(f.impact_pct / maxImpact) * 100}%` }}
                  transition={{ duration: 0.6, delay: 0.1 + i * 0.08, ease: "easeOut" }}
                  className={`h-full rounded-full ${raises ? "bg-red-500" : "bg-green-500"}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-5 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Raises risk
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Lowers risk
        </span>
      </div>
    </motion.div>
  );
}
