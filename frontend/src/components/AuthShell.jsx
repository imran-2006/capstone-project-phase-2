import { motion } from "framer-motion";
import { Brain } from "lucide-react";

const POINTS = [
  "Log a 30-second daily check-in",
  "See exactly which habits drive your risk",
  "Get tomorrow's risk forecast before the block hits",
];

export default function AuthShell({ children }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="hidden lg:flex relative overflow-hidden flex-col justify-between p-12 text-white bg-ink">
        <div className="absolute -top-24 -left-16 w-[420px] h-[420px] rounded-full bg-primary-600/60 blur-[110px]" />
        <div className="absolute bottom-[-120px] right-[-60px] w-[380px] h-[380px] rounded-full bg-orange-400/30 blur-[120px]" />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
            <Brain size={22} />
          </div>
          <span className="font-display font-semibold text-lg">Creative Block Predictor</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-5xl font-bold leading-[1.05]">
            Know your creative block before it knows you.
          </h2>
          <ul className="mt-8 space-y-3 text-white/75">
            {POINTS.map((p, i) => (
              <motion.li
                key={p}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.12 }}
                className="flex items-start gap-3"
              >
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary-300 flex-shrink-0" />
                {p}
              </motion.li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-white/50">
          Random Forest prediction · Explainable AI · Risk forecast
        </p>
      </aside>

      {/* Form side */}
      <main className="flex items-center justify-center px-4 py-10">{children}</main>
    </div>
  );
}
