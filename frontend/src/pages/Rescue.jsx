import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pause, Play, SkipForward, X, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCreator } from "../context/CreatorContext";

const DURATION_OPTIONS = [2, 5, 10];

const WARMUP_LIBRARY = {
  writer: [
    "Write three random sentences about the room around you.",
    "Write a tiny story opening in exactly three lines.",
    "Describe one object in a way that feels impossible to ignore.",
  ],
  artist: [
    "Draw three simple shapes and turn each into a tiny object.",
    "Sketch a quick landscape made only from circles and lines.",
    "Create three rough thumbnails for a single idea.",
  ],
  developer: [
    "Write a tiny piece of pseudocode for a small tool you wish existed.",
    "List three bugs in your current workflow and a fix for each.",
    "Draft a 5-line algorithm for one tiny daily win.",
  ],
  musician: [
    "Tap a simple rhythm for 10 counts, then repeat it with a twist.",
    "Hum a melody that matches your breathing pattern.",
    "Invent three notes and make a tiny phrase from them.",
  ],
  filmmaker: [
    "Storyboard three frames of a scene from a mundane object.",
    "Imagine one 30-second video with no dialogue and a strange angle.",
    "List three shots that would make a room feel alive.",
  ],
};

const PLAN_COPY = {
  sleep: {
    title: "Sleep-first reset",
    summary: "Close your eyes for 20 seconds, loosen your jaw, and let your first goal be simply to rest.",
  },
  screen_time: {
    title: "Screen-free reset",
    summary: "Look away from the screen, stretch your neck, and take a short walk or stand by a window for a moment.",
  },
  stress: {
    title: "Stress-softening breath",
    summary: "Use the longer breath cycle and stay soft on the exhale to settle your body before you return to work.",
  },
  work_hours: {
    title: "Stop-and-reset micro-break",
    summary: "Take a deliberate pause before the next task. Choose the smallest visible action and stop obsessing over the whole list.",
  },
  energy: {
    title: "Light-movement reset",
    summary: "Stand, stretch, and do one tiny task that makes progress without demanding deep focus.",
  },
  inspiration: {
    title: "Inspiration warm-up",
    summary: "Use one playful prompt to get your creative muscles moving before you try the real task.",
  },
  mood: {
    title: "Gentle grounding",
    summary: "Notice three things you can see, then soften your shoulders and return to one small next step.",
  },
  generic: {
    title: "Reset and refocus",
    summary: "Take a short pause, lower the pressure, and return with one small task in front of you.",
  },
};

function formatSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getRiskBasedDefaultDuration(riskLevel) {
  if (riskLevel === "Critical") return 10;
  if (riskLevel === "High") return 5;
  return 2;
}

function readStoredAudioPreference() {
  try {
    const value = localStorage.getItem("cbp_rescue_audio");
    if (value === null) return false;
    return value === "1";
  } catch {
    return false;
  }
}

export default function Rescue() {
  const navigate = useNavigate();
  const { profile } = useCreator();
  const [selectedDuration, setSelectedDuration] = useState(5);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState("breathing");
  const [timeLeft, setTimeLeft] = useState(60);
  const [paused, setPaused] = useState(false);
  const [feelAfter, setFeelAfter] = useState(3);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState("Breathe in");
  const [riskLevelBefore, setRiskLevelBefore] = useState("Medium");
  const [latestMood, setLatestMood] = useState("Neutral");
  const [factorInfo, setFactorInfo] = useState({
    top_factor: null,
    plan_key: "generic",
    message: "",
  });
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalText, setJournalText] = useState("");
  const [journalMood, setJournalMood] = useState("Neutral");
  const [journalMessage, setJournalMessage] = useState("");
  const [journalSaving, setJournalSaving] = useState(false);
  const audioContextRef = useRef(null);
  const speechTimerRef = useRef(null);
  const savedSessionRef = useRef(null);

  const currentField = profile?.field || "writer";
  const warmupIdeas = useMemo(() => {
    if (WARMUP_LIBRARY[currentField]) return WARMUP_LIBRARY[currentField];
    return [
      "Write three rough ideas, then pick the oddest one.",
      "Make one small, imperfect object from what is near you.",
      "Give yourself a 10-minute challenge to create something playful.",
    ];
  }, [currentField]);

  const stepDurations = useMemo(() => {
    const ratio = selectedDuration / 5;
    return {
      breathing: Math.max(15, Math.round(60 * ratio)),
      warmup: Math.max(30, Math.round(120 * ratio)),
      reset: Math.max(30, Math.round(120 * ratio)),
    };
  }, [selectedDuration]);

  const plan = PLAN_COPY[factorInfo.plan_key] || PLAN_COPY.generic;

  const stopAllAudio = () => {
    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
  };

  const speakCue = (text) => {
    if (!audioEnabled) return;
    if (!("speechSynthesis" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch {
      // ignore speech errors
    }
  };

  const playTone = (frequency = 440) => {
    if (!audioEnabled) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    try {
      const ctx = audioContextRef.current || new AudioCtor();
      audioContextRef.current = ctx;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.0001;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      oscillator.start(now);
      gain.gain.exponentialRampToValueAtTime(0.02, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      oscillator.stop(now + 0.4);
    } catch {
      // ignore audio errors
    }
  };

  useEffect(() => {
    try {
      const stored = readStoredAudioPreference();
      setAudioEnabled(stored);
    } catch {
      setAudioEnabled(false);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("cbp_rescue_audio", audioEnabled ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [audioEnabled]);

  useEffect(() => {
    let active = true;
    const loadLatestContext = async () => {
      try {
        const [historyRes, factorRes] = await Promise.all([
          client.get("/history"),
          client.get("/rescue/factors"),
        ]);
        if (!active) return;
        const latest = historyRes.data && historyRes.data[0] ? historyRes.data[0] : null;
        if (latest) {
          setRiskLevelBefore(latest.risk_level || "Medium");
          setLatestMood(latest.mood || "Neutral");
          setJournalMood(latest.mood || "Neutral");
          setSelectedDuration(getRiskBasedDefaultDuration(latest.risk_level || "Medium"));
        } else {
          setSelectedDuration(2);
        }
        setFactorInfo(factorRes.data || { top_factor: null, plan_key: "generic", message: "" });
      } catch {
        setFactorInfo({ top_factor: null, plan_key: "generic", message: "" });
      }
    };
    loadLatestContext();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!started) return undefined;
    if (step === "summary") return undefined;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (step === "breathing") {
            setStep("warmup");
            setBreathingPhase("Breathe in");
            return stepDurations.warmup;
          }
          if (step === "warmup") {
            setStep("reset");
            return stepDurations.reset;
          }
          setStep("summary");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [started, step, stepDurations]);

  useEffect(() => {
    if (!started || paused || step === "summary") return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (step === "breathing") {
      if (!prefersReduced) {
        const phaseTimer = setInterval(() => {
          setBreathingPhase((current) => (current === "Breathe in" ? "Breathe out" : "Breathe in"));
        }, 3500);
        playTone(440);
        speakCue("Breathe in slowly. Exhale gently.");
        return () => clearInterval(phaseTimer);
      }
      speakCue("Breathe slowly and gently.");
      return undefined;
    }

    if (step === "warmup") {
      speakCue("Begin your warm-up.");
      playTone(520);
      return undefined;
    }

    speakCue("Take a tiny reset action.");
    playTone(390);
    return undefined;
  }, [step, started, paused]);

  useEffect(() => {
    if (!started) {
      setStep("breathing");
      setTimeLeft(stepDurations.breathing);
      setBreathingPhase("Breathe in");
    }
  }, [started, stepDurations]);

  useEffect(() => () => stopAllAudio(), []);

  const progress = useMemo(() => {
    const duration = step === "breathing" ? stepDurations.breathing : step === "warmup" ? stepDurations.warmup : step === "reset" ? stepDurations.reset : 0;
    if (!duration) return 0;
    return Math.max(0, (1 - timeLeft / duration) * 100);
  }, [step, stepDurations, timeLeft]);

  const saveSession = async (finalized = true) => {
    if (sessionSaved) return;
    setSessionSaved(true);
    try {
      const payload = {
        started_at: new Date().toISOString(),
        completed: finalized,
        risk_level_before: riskLevelBefore,
        feel_after: finalized ? feelAfter : null,
        creative_field: profile?.field || null,
        duration_seconds: selectedDuration * 60,
      };
      const response = await client.post("/rescue-sessions", payload);
      savedSessionRef.current = response.data;
    } catch {
      // Keep rescue flow working even if the server confirms the save late.
    }
  };

  const handleStart = () => {
    setStarted(true);
    setPaused(false);
    setCompleted(false);
    setStep("breathing");
    setBreathingPhase("Breathe in");
    setTimeLeft(stepDurations.breathing);
  };

  const handlePauseToggle = () => {
    if (step === "summary") return;
    stopAllAudio();
    setPaused((current) => !current);
  };

  const handleSkip = () => {
    stopAllAudio();
    if (step === "breathing") {
      setStep("warmup");
      setTimeLeft(stepDurations.warmup);
    } else if (step === "warmup") {
      setStep("reset");
      setTimeLeft(stepDurations.reset);
    } else if (step === "reset") {
      setStep("summary");
      setTimeLeft(0);
    }
  };

  const handleExit = async () => {
    stopAllAudio();
    await saveSession(false);
    navigate("/dashboard");
  };

  const handleFinish = async () => {
    await saveSession(true);
    setCompleted(true);
    toast.success("Rescue mode complete — take a breath and return to your day.");
  };

  const handleSaveJournal = async () => {
    const text = journalText.trim();
    if (!text || text.length > 300) {
      setJournalMessage("Write one line between 1 and 300 characters.");
      return;
    }
    setJournalSaving(true);
    setJournalMessage("");
    try {
      await client.post("/journal", {
        mood: journalMood || latestMood || "Neutral",
        text,
        entry_date: new Date().toISOString(),
      });
      setJournalOpen(false);
      setJournalText("");
      toast.success("Saved to your mood journal.");
    } catch (error) {
      setJournalMessage(error.response?.data?.detail || "Could not save this journal entry right now.");
    } finally {
      setJournalSaving(false);
    }
  };

  const isBreathingStep = step === "breathing";
  const isSummaryStep = step === "summary";
  const factorHeadline = factorInfo.top_factor
    ? `Your biggest risk factor today: ${factorInfo.top_factor}. Your rescue plan is adjusted for it.`
    : "Your rescue plan is adjusted for a gentle reset.";

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-violet-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4 py-6">
      <div className="mx-auto max-w-3xl rounded-3xl border border-primary-100 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 shadow-xl p-5 md:p-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary-600 dark:text-primary-300">Rescue mode</p>
            <h1 className="font-display text-3xl font-bold">Adaptive reset</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              onClick={() => setAudioEnabled((current) => !current)}
            >
              {audioEnabled ? "Sound: On" : "Sound: Off"}
            </button>
            <button
              onClick={handleExit}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
            >
              <X size={16} /> Exit
            </button>
          </div>
        </div>

        {!started && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-primary-100 bg-primary-50 p-4 text-sm text-primary-900 dark:border-primary-800 dark:bg-primary-950/30 dark:text-primary-100">
              {factorHeadline}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
              <div className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Choose duration</div>
              <div className="grid grid-cols-3 gap-2">
                {DURATION_OPTIONS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setSelectedDuration(minutes)}
                    className={`rounded-xl border px-3 py-3 text-sm font-medium ${
                      selectedDuration === minutes
                        ? "border-primary-500 bg-primary-500 text-white"
                        : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                    }`}
                  >
                    {minutes} min
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">{plan.title}</div>
              <p className="text-sm text-gray-600 dark:text-gray-300">{plan.summary}</p>
            </div>

            <div className="flex justify-end">
              <button onClick={handleStart} className="btn-primary rounded-xl px-4 py-2 text-white">Start rescue</button>
            </div>
          </div>
        )}

        {started && !isSummaryStep && (
          <>
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{step === "breathing" ? "Breathing" : step === "warmup" ? "Creative warm-up" : "Reset"}</span>
                <span>{formatSeconds(timeLeft)}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  style={{ width: `${progress}%` }}
                  className="h-full rounded-full bg-gradient-to-r from-primary-500 to-violet-500 transition-all"
                />
              </div>
            </div>

            <div className="mb-5 rounded-2xl border border-primary-100 bg-primary-50 p-4 text-sm text-primary-900 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-100">
              {factorHeadline}
            </div>

            {isBreathingStep && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div
                  className="flex items-center justify-center rounded-full border border-primary-200 bg-primary-50 transition-all duration-[3500ms] ease-in-out dark:border-primary-800 dark:bg-primary-950/30"
                  style={{
                    width: breathingPhase === "Breathe in" ? 200 : 150,
                    height: breathingPhase === "Breathe in" ? 200 : 150,
                  }}
                >
                  <span className="text-xl font-semibold text-primary-700 dark:text-primary-200">{breathingPhase}</span>
                </div>
                <p className="mt-6 max-w-md text-sm text-gray-600 dark:text-gray-300">
                  {plan.summary}
                </p>
              </div>
            )}

            {step === "warmup" && (
              <div className="space-y-4">
                <p className="text-lg font-semibold">Creative warm-up</p>
                <ul className="space-y-3">
                  {warmupIdeas.map((idea, index) => (
                    <li key={idea} className="flex gap-3 rounded-xl border border-gray-200 p-3 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-200">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-200">{index + 1}</span>
                      <span>{idea}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {step === "reset" && (
              <div className="space-y-4 py-8 text-center">
                <p className="text-lg font-semibold">Tiny next action</p>
                <div className="rounded-2xl bg-primary-50 p-5 text-primary-800 dark:bg-primary-900/20 dark:text-primary-100">
                  {plan.summary}
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePauseToggle}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  {paused ? <Play size={16} /> : <Pause size={16} />}
                  {paused ? "Resume" : "Pause"}
                </button>
                <button
                  onClick={handleSkip}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  <SkipForward size={16} /> Skip
                </button>
              </div>
            </div>
          </>
        )}

        {started && isSummaryStep && !completed && (
          <div className="space-y-5 py-6">
            <div>
              <p className="text-lg font-semibold">How do you feel now?</p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">This is a creativity warm-up, not therapy or medical treatment.</p>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setFeelAfter(score)}
                  className={`rounded-xl border px-3 py-4 text-center font-semibold ${
                    feelAfter === score
                      ? "border-primary-500 bg-primary-500 text-white"
                      : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/12 dark:text-amber-200">
              If you feel unwell or overwhelmed, please talk to someone you trust or a professional.
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button onClick={handleFinish} className="btn-primary rounded-xl px-4 py-2 text-white">Finish</button>
              <button onClick={() => setJournalOpen((current) => !current)} className="rounded-xl border border-gray-200 px-4 py-2 dark:border-gray-700">Write one line about this</button>
            </div>

            {journalOpen && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Mood</label>
                <select
                  value={journalMood}
                  onChange={(event) => setJournalMood(event.target.value)}
                  className="mb-3 w-full rounded-xl border border-gray-200 bg-white p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  {['Happy', 'Neutral', 'Motivated', 'Tired', 'Sad', 'Frustrated'].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">One line</label>
                <textarea
                  value={journalText}
                  onChange={(event) => setJournalText(event.target.value.slice(0, 300))}
                  maxLength={300}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                  placeholder="I need a lighter day and a shorter to-do list."
                />
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{journalText.length}/300</span>
                  <span>{journalMessage}</span>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => setJournalOpen(false)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">Cancel</button>
                  <button
                    onClick={handleSaveJournal}
                    disabled={journalSaving}
                    className="rounded-xl bg-primary-600 px-3 py-2 text-sm text-white disabled:opacity-60"
                  >
                    {journalSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {completed && (
          <div className="space-y-4 py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-2xl dark:bg-primary-900/30">
              <Sparkles className="text-primary-600 dark:text-primary-200" />
            </div>
            <h2 className="text-2xl font-bold">Rescue complete</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">You took a brief pause and gave yourself a cleaner reset before the next task.</p>
            <button onClick={() => navigate("/dashboard")} className="btn-primary rounded-xl px-4 py-2 text-white">Back to dashboard</button>
          </div>
        )}
      </div>
    </div>
  );
}
