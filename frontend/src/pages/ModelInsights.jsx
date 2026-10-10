import { useEffect, useState } from "react";
import { Lightbulb, RefreshCw } from "lucide-react";
import client from "../api/client";

const FEATURE_LABELS = {
  sleep_hours: "Sleep",
  stress_level_enc: "Stress level",
  work_hours: "Work hours",
  inspiration_level_enc: "Inspiration",
  mood_enc: "Mood",
  energy_level: "Energy",
  focus_level: "Focus",
  screen_time: "Screen time",
  break_frequency_enc: "Break frequency",
};

function featureLabel(feature) {
  return FEATURE_LABELS[feature] || feature.replace(/_enc$/, "").replaceAll("_", " ");
}

const FEATURE_IDEAS = {
  sleep_hours: ["Write down one thing you can leave for tomorrow.", "Take two quiet minutes away from your screen before your next task."],
  stress_level_enc: ["Write the next tiny step for one task. Leave the rest for later.", "Take three slow breaths, then choose one thing to focus on."],
  work_hours: ["Step away for three minutes, then return with one clear next task.", "Break your current task into one small action you can finish soon."],
  inspiration_level_enc: ["Collect one image, phrase, or sound that interests you. No need to use it yet.", "Make a deliberately rough first version for two minutes."],
  mood_enc: ["Name how you feel, then choose a task that fits your energy right now.", "Write one sentence about what would make the next few minutes easier."],
  energy_level: ["Stretch gently, then choose one easy next action.", "Pick a small task that does not require a perfect start."],
  focus_level: ["Set a five-minute timer for one task and silence notifications.", "Clear one distraction from your workspace before you continue."],
  screen_time: ["Look away from your screen for a moment, then decide what to do next.", "Switch to paper for a quick list of your next one or two tasks."],
  break_frequency_enc: ["Take a short pause, then return with one clear next step.", "Stand up, get some water, and restart with a small task."],
};

const GENERAL_IDEAS = ["Write down the smallest useful next step for your work.", "Make a rough first draft for two minutes. It does not need to be good yet."];

export default function ModelInsights() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ideaIndex, setIdeaIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    client
      .get("/model-insights")
      .then((res) => {
        if (!mounted) return;
        setData(res.data);
        setError("");
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.response?.data?.detail || "Model insights could not be loaded.");
        setData(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="card p-6 text-sm text-gray-600 dark:text-gray-300">
        Loading model insights…
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-sm text-red-600 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (!data || !Array.isArray(data.feature_importance)) {
    return (
      <div className="card p-6 text-sm text-gray-600 dark:text-gray-300">
        No model insights available yet.
      </div>
    );
  }

  const leadingFeatures = data.feature_importance.slice(0, 3);
  const ideas = FEATURE_IDEAS[leadingFeatures[0]?.feature] || GENERAL_IDEAS;
  const currentIdea = ideas[ideaIndex % ideas.length];

  return (
    <div className="max-w-3xl space-y-7 pb-10">
      <div>
        <p className="text-sm font-medium text-primary-600 dark:text-primary-300">A simple guide</p>
        <h1 className="mt-1 font-display text-4xl font-bold">Small steps for your creative flow</h1>
        <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-300">The model looks for patterns in check-ins. Here are a few things it often notices, plus a small idea you can try.</p>
      </div>

      <section>
        <h2 className="font-display text-xl font-bold">Patterns in the examples</h2>
        <p className="mb-4 mt-1 text-sm text-gray-600 dark:text-gray-400">These are general signals, not a personal explanation of your result.</p>
        <ol className="divide-y divide-gray-200 border-y border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {leadingFeatures.map((item) => (
            <li key={item.feature} className="flex items-center gap-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-800 dark:bg-primary-900/50 dark:text-primary-200">{leadingFeatures.indexOf(item) + 1}</span>
              <span className="font-medium capitalize">{featureLabel(item.feature)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-gray-200 py-5 dark:border-gray-800" aria-label="Small action idea">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"><Lightbulb size={19} /></span>
          <div>
            <h2 className="font-display text-xl font-bold">Try one small step</h2>
            <p className="mt-2 text-gray-700 dark:text-gray-200">{currentIdea}</p>
            <button type="button" onClick={() => setIdeaIndex((index) => index + 1)} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-900 dark:text-primary-300 dark:hover:text-primary-100">
              <RefreshCw size={15} /> Show another idea
            </button>
          </div>
        </div>
      </section>

      <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">The model was trained on synthetic examples. These ideas are optional prompts, not medical advice, and do not change your prediction.</p>
    </div>
  );
}
