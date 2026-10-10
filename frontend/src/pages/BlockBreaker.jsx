import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Clock3, Eraser, Gamepad2, Pause, Play, RotateCcw, Sparkles, Volume2 } from "lucide-react";
import toast from "react-hot-toast";
import client from "../api/client";
import { useCreator } from "../context/CreatorContext";

const GAME_LIBRARY = [
  { id: "color-palette", title: "Color Palette Challenge", field: "artist", mode: "palette", prompt: "Build a five-color palette for an idea, feeling, or place." },
  { id: "blind-sketch", title: "Blind Sketching", field: "artist", mode: "sketch", prompt: "Keep your eyes on the subject, not the canvas. Draw for three minutes without lifting the pen." },
  { id: "random-story", title: "Random Story Challenge", field: "writer", mode: "story", prompt: "Use all three words in a tiny story. Follow the surprising connection." },
  { id: "word-association", title: "Word Association", field: "writer", mode: "words", prompt: "Write a chain of associations. Let each word lead somewhere unexpected." },
  { id: "rhythm-challenge", title: "Rhythm Challenge", field: "musician", mode: "rhythm", prompt: "Tap a short rhythm, then make a variation that changes its feel." },
  { id: "sound-mixing", title: "Sound Mixing", field: "musician", mode: "mix", prompt: "Balance the layers into a scene you can almost hear." },
  { id: "scene-remix", title: "Scene Remix", field: "filmmaker", mode: "text", prompt: "Remix an ordinary moment with a new genre, point of view, and final reveal." },
  { id: "storyboard", title: "Storyboard Challenge", field: "filmmaker", mode: "text", prompt: "Describe three shots: an establishing frame, a surprising detail, and a final image." },
  { id: "visual-observation", title: "Visual Observation", field: "photographer", mode: "text", prompt: "Notice five details nearby. Turn one overlooked detail into the subject of a photo." },
  { id: "composition-challenge", title: "Composition Challenge", field: "photographer", mode: "text", prompt: "Compose an imaginary photograph using foreground, background, and one deliberate point of focus." },
  { id: "shape-remix", title: "Shape Remix", field: "designer", mode: "text", prompt: "Choose a basic shape and transform it into three useful or surprising objects." },
  { id: "logic-puzzle", title: "Logic Puzzle", field: "developer", mode: "logic", prompt: "Find the missing number in the sequence, then explain the rule." },
  { id: "creative-coding", title: "Creative Coding Challenge", field: "developer", mode: "text", prompt: "Sketch a tiny interactive idea in pseudocode. Make one constraint part of the fun." },
  { id: "character-design", title: "Character Design", field: "game_creator", mode: "text", prompt: "Invent a character with one unusual ability, one limitation, and one memorable silhouette." },
  { id: "game-idea", title: "Game Idea Challenge", field: "game_creator", mode: "text", prompt: "Combine a familiar activity with an unlikely rule to invent a tiny game." },
  { id: "caption-challenge", title: "Caption Challenge", field: "content_creator", mode: "text", prompt: "Write three captions for one imaginary image: curious, funny, and heartfelt." },
  { id: "content-hook", title: "Content Hook Challenge", field: "content_creator", mode: "text", prompt: "Write a one-line opening that makes someone want to hear what comes next." },
  { id: "brainstorming", title: "Brainstorming Sprint", field: "student", mode: "text", prompt: "List several ways to explain a topic you are learning without using its usual definition." },
  { id: "mind-mapping", title: "Mind Mapping", field: "student", mode: "text", prompt: "Start with one question. Add connected ideas, examples, and a surprising cross-link." },
  { id: "improvisation", title: "Improvisation Challenge", field: "performer", mode: "text", prompt: "Begin with an ordinary action, then change the setting, status, and stakes." },
  { id: "emotion-prompt", title: "Emotion Prompt", field: "performer", mode: "text", prompt: "Show one emotion without naming it. Describe the gesture, rhythm, and voice that reveal it." },
  { id: "creative-spark", title: "One-Object Remix", field: "other", mode: "text", prompt: "Pick an object nearby. Give it a new purpose, a new backstory, and a new audience." },
  { id: "constraint-creator", title: "Constraint Creator", field: "other", mode: "text", prompt: "Make a tiny idea using only what is already around you and one playful limitation." },
];

const FIELD_GAME_IDS = {
  artist: ["color-palette", "blind-sketch"], writer: ["random-story", "word-association"],
  musician: ["rhythm-challenge", "sound-mixing"], filmmaker: ["scene-remix", "storyboard"],
  photographer: ["visual-observation", "composition-challenge"], designer: ["color-palette", "shape-remix"],
  developer: ["logic-puzzle", "creative-coding"], game_creator: ["character-design", "game-idea"],
  content_creator: ["caption-challenge", "content-hook"], student: ["brainstorming", "mind-mapping"],
  performer: ["improvisation", "emotion-prompt"], other: ["creative-spark", "constraint-creator"],
};

const WORDS = ["lantern", "orbit", "velvet", "thunder", "ticket", "moss", "echo", "peach", "window", "comet", "thread", "museum", "pocket", "copper", "drift"];
const MOODS = ["Happy", "Neutral", "Motivated", "Tired", "Sad", "Frustrated"];
const LOGIC_ANSWER = 32;
const INITIAL_COLORS = ["#E85D4A", "#F2B544", "#6C9B78", "#3C7585", "#273C58"];

function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function makeWords() {
  return [...WORDS].sort(() => Math.random() - 0.5).slice(0, 3);
}

function moodBoost(game, mood) {
  if (["Tired", "Sad", "Frustrated"].includes(mood)) {
    return ["color-palette", "visual-observation", "random-story", "mind-mapping"].includes(game.id) ? 2 : 0;
  }
  if (["Happy", "Motivated"].includes(mood)) {
    return ["rhythm-challenge", "improvisation", "shape-remix", "game-idea"].includes(game.id) ? 2 : 0;
  }
  return 0;
}

export default function BlockBreaker() {
  const { profile } = useCreator();
  const navigate = useNavigate();
  const [context, setContext] = useState({ sessions: [], stats: {}, field: null, latest_mood: null });
  const [contextLoading, setContextLoading] = useState(true);
  const [mood, setMood] = useState("");
  const [view, setView] = useState("recommended");
  const [activeGame, setActiveGame] = useState(null);
  const [status, setStatus] = useState("ready");
  const [timeLeft, setTimeLeft] = useState(180);
  const [colors, setColors] = useState(INITIAL_COLORS);
  const [words, setWords] = useState(makeWords);
  const [text, setText] = useState("");
  const [rhythm, setRhythm] = useState([]);
  const [mix, setMix] = useState([50, 50, 50]);
  const [logicAnswer, setLogicAnswer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [returnPrompt, setReturnPrompt] = useState(false);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);

  const field = profile?.field || context.field || "other";
  const currentMood = mood || context.latest_mood || "";
  const fieldGameIds = FIELD_GAME_IDS[field] || FIELD_GAME_IDS.other;
  const playedCounts = useMemo(() => context.sessions.reduce((counts, session) => {
    counts[session.game_key] = (counts[session.game_key] || 0) + 1;
    return counts;
  }, {}), [context.sessions]);
  const recommendedGames = useMemo(() => GAME_LIBRARY
    .map((game) => ({
      ...game,
      score: (fieldGameIds.includes(game.id) ? 10 : 0) + moodBoost(game, currentMood) - (playedCounts[game.id] || 0) * 2,
    }))
    .sort((first, second) => second.score - first.score)
    .slice(0, 6), [fieldGameIds, currentMood, playedCounts]);
  const visibleGames = view === "recommended" ? recommendedGames : GAME_LIBRARY;

  useEffect(() => {
    let mounted = true;
    client.get("/blockbreaker/context")
      .then(({ data }) => {
        if (!mounted) return;
        setContext(data);
        setMood(data.latest_mood || "");
      })
      .catch(() => toast.error("Could not load your BlockBreaker history."))
      .finally(() => { if (mounted) setContextLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (status !== "playing") return undefined;
    const timer = window.setInterval(() => {
      setTimeLeft((remaining) => {
        if (remaining <= 1) {
          window.clearInterval(timer);
          setStatus("finished");
          return 0;
        }
        return remaining - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  const resetCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context2d = canvas.getContext("2d");
    context2d.clearRect(0, 0, canvas.width, canvas.height);
    context2d.fillStyle = "#ffffff";
    context2d.fillRect(0, 0, canvas.width, canvas.height);
  };

  const resetGame = () => {
    setStatus("ready");
    setTimeLeft(180);
    setColors(INITIAL_COLORS);
    setWords(makeWords());
    setText("");
    setRhythm([]);
    setMix([50, 50, 50]);
    setLogicAnswer(null);
    setReturnPrompt(false);
    window.setTimeout(resetCanvas, 0);
  };

  const chooseGame = (game) => {
    setActiveGame(game);
    resetGame();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pointerPosition = (event) => {
    const canvas = canvasRef.current;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
    };
  };

  const startStroke = (event) => {
    if (status !== "playing") return;
    const canvas = canvasRef.current;
    const context2d = canvas.getContext("2d");
    const point = pointerPosition(event);
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    context2d.beginPath();
    context2d.moveTo(point.x, point.y);
  };

  const drawStroke = (event) => {
    if (!drawingRef.current || !canvasRef.current) return;
    const context2d = canvasRef.current.getContext("2d");
    const point = pointerPosition(event);
    context2d.lineWidth = 5;
    context2d.lineCap = "round";
    context2d.lineJoin = "round";
    context2d.strokeStyle = "#252d36";
    context2d.lineTo(point.x, point.y);
    context2d.stroke();
  };

  const stopStroke = () => { drawingRef.current = false; };

  const playRhythm = () => {
    if (!rhythm.length) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const audio = new AudioContextClass();
      rhythm.forEach((beat, index) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.frequency.value = [220, 277, 330, 392][beat];
        gain.gain.value = 0.08;
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start(audio.currentTime + index * 0.32);
        oscillator.stop(audio.currentTime + index * 0.32 + 0.16);
      });
      window.setTimeout(() => audio.close(), rhythm.length * 320 + 300);
    } catch {
      toast.error("Audio playback is unavailable in this browser.");
    }
  };

  const buildOutput = () => {
    if (!activeGame) return "";
    if (activeGame.mode === "palette") return `Palette: ${colors.join(", ")}`;
    if (activeGame.mode === "sketch") return canvasRef.current?.toDataURL("image/png") || "";
    if (activeGame.mode === "story") return `Words: ${words.join(", ")}\n\n${text}`;
    if (activeGame.mode === "rhythm") return `Rhythm: ${rhythm.map((beat) => ["Kick", "Clap", "Hat", "Rim"][beat]).join(" - ")}`;
    if (activeGame.mode === "mix") return `Layer balance: ${mix.join(" / ")}`;
    if (activeGame.mode === "logic") return `Sequence: 2, 4, 8, 16, ?\nAnswer: ${logicAnswer ?? "Not answered"}`;
    return text;
  };

  const finishGame = async () => {
    if (saving || !activeGame) return;
    setSaving(true);
    setStatus("finished");
    const duration = 180 - timeLeft;
    try {
      const { data } = await client.post("/blockbreaker/sessions", {
        game_key: activeGame.id,
        game_title: activeGame.title,
        creative_field: profile?.field || context.field || "other",
        mood: currentMood || null,
        output: buildOutput(),
        completed: true,
        duration_seconds: duration,
      });
      setContext((previous) => ({
        ...previous,
        sessions: [data, ...previous.sessions.filter((session) => session.id !== data.id)].slice(0, 30),
        stats: {
          ...previous.stats,
          total_sessions: (previous.stats?.total_sessions || 0) + 1,
          completed_sessions: (previous.stats?.completed_sessions || 0) + 1,
          minutes_played: (previous.stats?.minutes_played || 0) + Math.round(duration / 60),
        },
      }));
      setReturnPrompt(true);
      toast.success("Your creative session is saved.");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Could not save this session.");
    } finally {
      setSaving(false);
    }
  };

  const progressPercent = ((180 - timeLeft) / 180) * 100;
  const playCount = context.stats?.completed_sessions || 0;
  const favoriteGame = Object.entries(playedCounts).sort((first, second) => second[1] - first[1])[0]?.[0];
  const favoriteTitle = GAME_LIBRARY.find((game) => game.id === favoriteGame)?.title || "Start a game";

  return (
    <div className="space-y-7 pb-10">
      <header className="flex flex-col gap-5 border-b border-gray-200/80 pb-6 dark:border-gray-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-primary-600 dark:text-primary-300"><Gamepad2 size={17} /> THREE-MINUTE CREATIVE RESET</p>
          <h1 className="font-display text-4xl font-bold">BlockBreaker</h1>
          <p className="mt-2 max-w-2xl text-gray-600 dark:text-gray-300">Trade the scroll for a tiny creative detour. Make something small, then return with a little momentum.</p>
        </div>
        <div className="flex items-center gap-3 self-start rounded-xl border border-gray-200 bg-white/80 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/70 sm:self-auto">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"><Clock3 size={20} /></span>
          <div><p className="text-xs text-gray-500 dark:text-gray-400">PLAY SPRINT</p><p className="font-display text-xl font-bold">03:00</p></div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Your BlockBreaker progress">
        <div className="flex items-center justify-between border-b border-gray-200 py-3 dark:border-gray-800 sm:border-b-0 sm:border-r sm:pr-5"><span className="text-sm text-gray-500 dark:text-gray-400">Completed sprints</span><strong className="font-display text-2xl">{contextLoading ? "..." : playCount}</strong></div>
        <div className="flex items-center justify-between border-b border-gray-200 py-3 dark:border-gray-800 sm:border-b-0 sm:border-r sm:px-5"><span className="text-sm text-gray-500 dark:text-gray-400">Minutes making</span><strong className="font-display text-2xl">{contextLoading ? "..." : context.stats?.minutes_played || 0}</strong></div>
        <div className="flex items-center justify-between py-3 sm:pl-5"><span className="text-sm text-gray-500 dark:text-gray-400">Most played</span><strong className="max-w-[55%] truncate text-right text-sm">{contextLoading ? "..." : favoriteTitle}</strong></div>
      </section>

      {activeGame ? (
        <section className="card overflow-hidden" aria-label={`${activeGame.title} game`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800 sm:px-7">
            <button type="button" onClick={() => { setActiveGame(null); setStatus("ready"); }} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-primary-700 dark:text-gray-300 dark:hover:text-primary-300"><ArrowLeft size={17} /> Game library</button>
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 font-mono text-lg font-bold tabular-nums text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><Clock3 size={17} /> {formatTime(timeLeft)}</span>
          </div>
          <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_250px]">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-primary-600 dark:text-primary-300">{activeGame.field === "other" ? "Open field" : activeGame.field.replaceAll("_", " ")}</p>
              <h2 className="mt-1 font-display text-2xl font-bold">{activeGame.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">{activeGame.prompt}</p>

              <div className="mt-6 min-h-52 rounded-lg border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-950/40 sm:p-5">
                {activeGame.mode === "palette" && (
                  <div>
                    <div className="mb-4 grid grid-cols-5 gap-2 sm:gap-3">{colors.map((color, index) => <label key={index} className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-black/10 shadow-sm" style={{ backgroundColor: color }} title={`Choose color ${index + 1}`}><input aria-label={`Palette color ${index + 1}`} type="color" value={color} onChange={(event) => setColors((previous) => previous.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" /><span className="absolute inset-x-0 bottom-0 bg-black/45 py-1 text-center font-mono text-[9px] text-white sm:text-[10px]">{color.toUpperCase()}</span></label>)}</div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Choose each swatch to shape your palette. Your colors are saved with the session.</p>
                  </div>
                )}

                {activeGame.mode === "sketch" && (
                  <div><canvas ref={canvasRef} width="900" height="420" onPointerDown={startStroke} onPointerMove={drawStroke} onPointerUp={stopStroke} onPointerCancel={stopStroke} className={`h-56 w-full rounded-md border border-gray-200 bg-white touch-none ${status === "playing" ? "cursor-crosshair" : "cursor-not-allowed"}`} aria-label="Blind sketch drawing canvas" /><div className="mt-3 flex justify-end"><button type="button" onClick={resetCanvas} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700"><Eraser size={15} /> Clear canvas</button></div><p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Canvas input is enabled while the timer is running. Touch and mouse are supported.</p></div>
                )}

                {activeGame.mode === "story" && (
                  <div><div className="mb-4 flex flex-wrap items-center gap-2">{words.map((word) => <span key={word} className="rounded-md bg-amber-100 px-3 py-1.5 font-display font-semibold text-amber-950 dark:bg-amber-900/40 dark:text-amber-100">{word}</span>)}<button type="button" onClick={() => setWords(makeWords())} className="rounded-md p-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800" aria-label="Generate three new random words" title="New words"><RotateCcw size={16} /></button></div><textarea value={text} onChange={(event) => setText(event.target.value.slice(0, 3000))} disabled={status !== "playing"} rows={7} maxLength={3000} placeholder="Let the first line be a little strange..." className="w-full resize-y rounded-lg border border-gray-200 bg-white p-3 text-sm leading-6 dark:border-gray-700 dark:bg-gray-900" /><p className="mt-1 text-right text-xs text-gray-500">{text.length}/3000</p></div>
                )}

                {activeGame.mode === "rhythm" && (
                  <div><div className="grid grid-cols-4 gap-2">{["Kick", "Clap", "Hat", "Rim"].map((label, index) => <button key={label} type="button" disabled={status !== "playing"} onClick={() => setRhythm((previous) => [...previous.slice(-15), index])} className={`min-h-20 rounded-lg border-2 font-display font-bold transition-colors disabled:opacity-50 ${rhythm.at(-1) === index ? "border-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-100" : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"}`}>{label}<span className="mt-1 block text-xs font-normal text-gray-500">Tap beat</span></button>)}</div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-1" aria-label="Recorded rhythm">{rhythm.map((beat, index) => <span key={`${beat}-${index}`} className="flex h-7 w-7 items-center justify-center rounded bg-gray-200 text-xs dark:bg-gray-700">{["K", "C", "H", "R"][beat]}</span>)}</div><div className="flex gap-2"><button type="button" onClick={() => setRhythm([])} className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700">Clear</button><button type="button" onClick={playRhythm} disabled={!rhythm.length} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-gray-900"><Volume2 size={15} /> Play back</button></div></div></div>
                )}

                {activeGame.mode === "mix" && (
                  <div className="space-y-5">{["Pulse", "Texture", "Melody"].map((name, index) => <label key={name} className="grid grid-cols-[80px_1fr_38px] items-center gap-3 text-sm"><span>{name}</span><input aria-label={`${name} sound level`} type="range" min="0" max="100" value={mix[index]} onChange={(event) => setMix((previous) => previous.map((value, itemIndex) => itemIndex === index ? Number(event.target.value) : value))} style={{ "--val": `${mix[index]}%` }} /><span className="text-right tabular-nums text-gray-500">{mix[index]}</span></label>)}</div>
                )}

                {activeGame.mode === "logic" && (
                  <div><p className="mb-4 font-display text-xl font-bold">2, 4, 8, 16, ?</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[24, 30, 32, 36].map((answer) => <button key={answer} type="button" disabled={status !== "playing"} onClick={() => setLogicAnswer(answer)} className={`rounded-lg border px-4 py-3 font-semibold disabled:opacity-50 ${logicAnswer === answer ? answer === LOGIC_ANSWER ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200" : "border-red-400 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200" : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"}`}>{answer}</button>)}</div><p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{logicAnswer === LOGIC_ANSWER ? "Exactly. The number doubles each time." : logicAnswer ? "Not quite. Look for a repeating operation." : "Choose the next number in the sequence."}</p></div>
                )}

                {activeGame.mode === "text" && <div><label htmlFor="game-output" className="mb-2 block text-sm font-semibold">Your quick draft</label><textarea id="game-output" value={text} onChange={(event) => setText(event.target.value.slice(0, 5000))} disabled={status !== "playing"} rows={7} maxLength={5000} placeholder="Start anywhere. The first draft can be rough." className="w-full resize-y rounded-lg border border-gray-200 bg-white p-3 text-sm leading-6 dark:border-gray-700 dark:bg-gray-900" /><p className="mt-1 text-right text-xs text-gray-500">{text.length}/5000</p></div>}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {status === "ready" && <button type="button" onClick={() => setStatus("playing")} className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"><Play size={16} /> Start 3-minute game</button>}
                {status === "playing" && <button type="button" onClick={() => setStatus("paused")} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-gray-900"><Pause size={16} /> Pause</button>}
                {status === "paused" && <button type="button" onClick={() => setStatus("playing")} className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"><Play size={16} /> Resume</button>}
                {(status === "playing" || status === "paused" || status === "finished") && <button type="button" onClick={resetGame} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium dark:border-gray-700"><RotateCcw size={16} /> Restart</button>}
                {status === "finished" && !returnPrompt && <button type="button" onClick={finishGame} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Check size={16} /> {saving ? "Saving..." : "Save & finish"}</button>}
              </div>
              {(status === "playing" || status === "paused") && <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"><div className="h-full rounded-full bg-amber-500 transition-[width] duration-1000" style={{ width: `${progressPercent}%` }} /></div>}
              {status === "ready" && <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Start when you are ready. The timer begins with your first tap.</p>}
              {status === "finished" && !returnPrompt && <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">Sprint complete. Save your output to add it to your BlockBreaker history.</p>}
              {returnPrompt && <div className="mt-5 border-t border-gray-200 pt-5 dark:border-gray-800"><p className="font-display text-lg font-bold">Want to return to your original work?</p><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Your {activeGame.title.toLowerCase()} is saved in your game history.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => navigate("/dashboard")} className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold text-white">Return to my work</button><button type="button" onClick={() => { setActiveGame(null); setStatus("ready"); setReturnPrompt(false); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">Choose another game</button></div></div>}
            </div>

            <aside className="border-t border-gray-200 pt-5 dark:border-gray-800 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
              <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Personalize your picks</p>
              <label htmlFor="game-mood" className="mt-3 block text-sm font-medium">Current mood <span className="font-normal text-gray-500">(optional)</span></label>
              <select id="game-mood" value={mood} onChange={(event) => setMood(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"><option value="">No mood selected</option>{MOODS.map((option) => <option key={option}>{option}</option>)}</select>
              <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">Recommendations use your field, mood, and games you have played less often.</p>
              <div className="mt-5 rounded-lg bg-primary-50 p-3 dark:bg-primary-950/30"><p className="text-xs font-semibold uppercase text-primary-700 dark:text-primary-200">Your field</p><p className="mt-1 capitalize text-sm font-medium">{field.replaceAll("_", " ")}</p></div>
            </aside>
          </div>
        </section>
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-display text-2xl font-bold">Pick your next three minutes</h2><p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Made for {field.replaceAll("_", " ")}s, open to every curious mind.</p></div>
            <div className="inline-flex w-fit rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900" role="tablist" aria-label="Game selection"><button type="button" role="tab" aria-selected={view === "recommended"} onClick={() => setView("recommended")} className={`rounded-md px-3 py-2 text-sm ${view === "recommended" ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "text-gray-600 dark:text-gray-300"}`}>For you</button><button type="button" role="tab" aria-selected={view === "all"} onClick={() => setView("all")} className={`rounded-md px-3 py-2 text-sm ${view === "all" ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "text-gray-600 dark:text-gray-300"}`}>Explore all</button></div>
          </div>

          <section className="grid grid-cols-1 gap-x-5 gap-y-0 md:grid-cols-2 xl:grid-cols-3" aria-label={view === "recommended" ? "Recommended games" : "All games"}>
            {visibleGames.map((game) => {
              const recommended = fieldGameIds.includes(game.id);
              return <article key={game.id} className="group flex min-h-40 flex-col border-t border-gray-200 py-5 dark:border-gray-800">
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{game.field === "other" ? "Open field" : game.field.replaceAll("_", " ")}{recommended && view === "all" ? " · FOR YOU" : ""}</p><h3 className="mt-1 font-display text-lg font-bold">{game.title}</h3></div><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-900/35 dark:text-amber-200"><Sparkles size={17} /></span></div>
                <p className="mt-2 flex-1 text-sm leading-5 text-gray-600 dark:text-gray-400">{game.prompt}</p>
                <div className="mt-4 flex items-center justify-between"><span className="text-xs text-gray-500">3 min{playedCounts[game.id] ? ` · played ${playedCounts[game.id]}×` : " · fresh start"}</span><button type="button" onClick={() => chooseGame(game)} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold transition-colors hover:border-primary-500 hover:text-primary-700 dark:border-gray-700 dark:hover:text-primary-300">Play <Play size={14} /></button></div>
              </article>;
            })}
          </section>

          {context.sessions.length > 0 && <section className="border-t border-gray-200 pt-6 dark:border-gray-800"><h2 className="font-display text-xl font-bold">Recent sessions</h2><div className="mt-3 divide-y divide-gray-200 dark:divide-gray-800">{context.sessions.slice(0, 5).map((session) => <div key={session.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"><div><p className="text-sm font-semibold">{session.game_title}</p><p className="mt-0.5 text-xs text-gray-500">{new Date(session.created_at).toLocaleString()} · {Math.max(1, Math.round(session.duration_seconds / 60))} min</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">Saved</span></div>)}</div></section>}
        </>
      )}
    </div>
  );
}