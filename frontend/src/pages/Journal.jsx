import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Pencil, Trash2, Sparkles, Search } from "lucide-react";
import client from "../api/client";

const ALLOWED_MOODS = ["Happy", "Neutral", "Motivated", "Tired", "Sad", "Frustrated"];

export default function Journal() {
  const [prompt, setPrompt] = useState("");
  const [entries, setEntries] = useState([]);
  const [mood, setMood] = useState("Neutral");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadEntries = async (query = "") => {
    try {
      const res = await client.get("/journal", { params: { search: query || undefined } });
      setEntries(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not load journal entries.");
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [promptRes, entriesRes] = await Promise.all([
          client.get("/journal/prompt"),
          client.get("/journal"),
        ]);
        setPrompt(promptRes.data?.prompt || "Take ten minutes to notice one small spark of creativity.");
        setEntries(Array.isArray(entriesRes.data) ? entriesRes.data : []);
      } catch (err) {
        toast.error(err.response?.data?.detail || "Unable to load your journal.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const visibleEntries = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return entries;
    return entries.filter((entry) => {
      const haystack = `${entry.mood} ${entry.text}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [entries, search]);

  const resetForm = () => {
    setMood("Neutral");
    setText("");
    setEditingId(null);
  };

  const handleSave = async () => {
    const cleanText = text.trim();
    if (!cleanText) {
      toast.error("Please write a short note before saving.");
      return;
    }
    if (cleanText.length > 1000) {
      toast.error("Your journal entry must be 1000 characters or fewer.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await client.put(`/journal/${editingId}`, { mood, text: cleanText });
        toast.success("Journal entry updated.");
      } else {
        await client.post("/journal", { mood, text: cleanText });
        toast.success("Journal entry saved.");
      }
      resetForm();
      loadEntries(search);
      const promptRes = await client.get("/journal/prompt");
      setPrompt(promptRes.data?.prompt || prompt);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not save your journal entry.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry) => {
    setEditingId(entry.id);
    setMood(entry.mood || "Neutral");
    setText(entry.text || "");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this journal entry?")) return;
    try {
      await client.delete(`/journal/${id}`);
      toast.success("Journal entry deleted.");
      setEntries((current) => current.filter((entry) => entry.id !== id));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Delete failed.");
    }
  };

  if (loading) {
    return <div className="card p-6 text-sm text-gray-600 dark:text-gray-300">Loading your journal…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary-600 dark:text-primary-300">Private reflection</p>
        <h1 className="font-display text-4xl font-bold mt-1">Mood Journal</h1>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2 text-primary-600 dark:text-primary-300">
          <Sparkles size={18} />
          <p className="font-medium">Today’s prompt</p>
        </div>
        <p className="text-gray-700 dark:text-gray-200">{prompt || "Take ten minutes to notice one small spark of creativity."}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-4">{editingId ? "Edit entry" : "Write today’s note"}</h2>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Mood</span>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm"
              >
                {ALLOWED_MOODS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Reflection</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 1000))}
                rows={6}
                placeholder="What felt creative, heavy, or hopeful today?"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm resize-none"
              />
            </label>

            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{text.length}/1000</span>
              <div className="flex gap-2">
                {editingId && (
                  <button
                    onClick={resetForm}
                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary px-4 py-2 rounded-lg text-white disabled:opacity-60"
                >
                  {saving ? "Saving..." : editingId ? "Update entry" : "Save entry"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-4">Search entries</h2>
          <label className="relative block">
            <Search size={16} className="absolute left-3 top-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes or moods"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-9 pr-3 py-2.5 text-sm"
            />
          </label>
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
            {visibleEntries.length} {visibleEntries.length === 1 ? "entry" : "entries"}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-semibold mb-4">Past entries</h2>
        {visibleEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-6 text-sm text-gray-500 dark:text-gray-400 text-center">
            No journal entries yet. Start with a short reflection.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleEntries.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <p className="text-sm font-medium text-primary-600 dark:text-primary-300">{entry.mood}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(entry.entry_date).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(entry)}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                      aria-label="Edit entry"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                      aria-label="Delete entry"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">{entry.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
