import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Download, FileText, Trash2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import client from "../api/client";
import RiskBadge from "../components/RiskBadge";

export default function History() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await client.get("/history");
      setRows(res.data);
    } catch (err) {
      toast.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchesSearch =
        search === "" ||
        r.mood.toLowerCase().includes(search.toLowerCase()) ||
        r.risk_level.toLowerCase().includes(search.toLowerCase()) ||
        new Date(r.date).toLocaleDateString().includes(search);
      const matchesRisk = riskFilter === "All" || r.risk_level === riskFilter;
      return matchesSearch && matchesRisk;
    });
  }, [rows, search, riskFilter]);

  const handleClearHistory = async () => {
    if (!confirm("Clear all check-in history? This cannot be undone.")) return;
    try {
      await client.delete("/history");
      toast.success("History cleared");
      fetchHistory();
    } catch {
      toast.error("Failed to clear history");
    }
  };

  const exportCSV = () => {
    const csv = Papa.unparse(
      filtered.map((r) => ({
        Date: new Date(r.date).toLocaleString(),
        "Sleep Hours": r.sleep_hours,
        "Stress Level": r.stress_level,
        "Work Hours": r.work_hours,
        Mood: r.mood,
        Prediction: r.risk_level,
        "Confidence %": r.confidence,
        Suggestions: r.suggestions.join("; "),
      }))
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "creative_block_history.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Creative Block Predictor - History", 14, 15);
    autoTable(doc, {
      startY: 22,
      head: [["Date", "Sleep", "Stress", "Work Hrs", "Mood", "Prediction", "Confidence"]],
      body: filtered.map((r) => [
        new Date(r.date).toLocaleDateString(),
        r.sleep_hours,
        r.stress_level,
        r.work_hours,
        r.mood,
        r.risk_level,
        `${r.confidence}%`,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    doc.save("creative_block_history.pdf");
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">History</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Review your past check-ins and predictions.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <Download size={15} /> CSV
          </button>
          <button onClick={exportPDF} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <FileText size={15} /> PDF
          </button>
          <button onClick={handleClearHistory} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="card p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by date, mood, or risk level..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {["All", "Low", "Medium", "High", "Critical"].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-primary-600" size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            No check-ins found. Head to the Dashboard to log your first entry.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Sleep</th>
                  <th className="px-4 py-3 font-medium">Stress</th>
                  <th className="px-4 py-3 font-medium">Work Hrs</th>
                  <th className="px-4 py-3 font-medium">Mood</th>
                  <th className="px-4 py-3 font-medium">Prediction</th>
                  <th className="px-4 py-3 font-medium">Confidence</th>
                  <th className="px-4 py-3 font-medium">Suggestions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{r.sleep_hours}h</td>
                    <td className="px-4 py-3">{r.stress_level}</td>
                    <td className="px-4 py-3">{r.work_hours}h</td>
                    <td className="px-4 py-3">{r.mood}</td>
                    <td className="px-4 py-3"><RiskBadge level={r.risk_level} size="sm" /></td>
                    <td className="px-4 py-3">{r.confidence}%</td>
                    <td className="px-4 py-3 max-w-xs truncate text-gray-500 dark:text-gray-400" title={r.suggestions.join(", ")}>
                      {r.suggestions.slice(0, 2).join(", ")}{r.suggestions.length > 2 ? "..." : ""}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
