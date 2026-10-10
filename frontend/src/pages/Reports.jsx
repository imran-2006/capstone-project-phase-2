import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, Download, Calendar } from "lucide-react";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import client from "../api/client";
import RiskBadge from "../components/RiskBadge";

const RANGES = [
  { key: "week", label: "Weekly Report" },
  { key: "month", label: "Monthly Report" },
  { key: "year", label: "Yearly Report" },
];

export default function Reports() {
  const [range, setRange] = useState("week");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async (r) => {
    setRange(r);
    setLoading(true);
    setData(null);
    try {
      const res = await client.get(`/reports?range=${r}`);
      setData(res.data);
    } catch {
      toast.error("Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Creative Block Predictor - ${RANGES.find((r) => r.key === range).label}`, 14, 15);

    doc.setFontSize(10);
    doc.text(`Total Check-ins: ${data.total_checkins}`, 14, 25);
    doc.text(`Avg Sleep: ${data.avg_sleep}h   Avg Work: ${data.avg_work_hours}h   Avg Energy: ${data.avg_energy}   Avg Focus: ${data.avg_focus}`, 14, 31);
    doc.text(`Most Common Mood: ${data.most_common_mood || "N/A"}`, 14, 37);

    autoTable(doc, {
      startY: 44,
      head: [["Date", "Risk Level", "Confidence", "Mood"]],
      body: data.checkins.map((c) => [c.date, c.risk_level, `${c.confidence}%`, c.mood]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });

    doc.save(`creative_block_${range}_report.pdf`);
  };

  // auto-load the default range on first render
  useEffect(() => {
    fetchReport("week");
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Reports</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        Generate and download summary reports of your creative wellbeing.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => fetchReport(r.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              range === r.key
                ? "bg-primary-600 text-white"
                : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            <Calendar size={15} />
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-primary-600" size={28} />
        </div>
      ) : !data || data.total_checkins === 0 ? (
        <div className="card p-16 text-center text-gray-400 text-sm">
          No check-ins found for this period yet.
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-lg">{RANGES.find((r) => r.key === range).label}</h2>
            <button
              onClick={downloadPDF}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Download size={15} /> Download PDF
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-xs text-gray-400">Total Check-ins</p>
              <p className="text-xl font-bold">{data.total_checkins}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Avg Sleep</p>
              <p className="text-xl font-bold">{data.avg_sleep}h</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Avg Work Hours</p>
              <p className="text-xl font-bold">{data.avg_work_hours}h</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Most Common Mood</p>
              <p className="text-xl font-bold">{data.most_common_mood || "—"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {Object.entries(data.risk_distribution).map(([risk, count]) => (
              <div key={risk} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-gray-50 dark:bg-gray-800">
                <RiskBadge level={risk} size="sm" /> <span className="text-gray-500 dark:text-gray-400">×{count}</span>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Risk Level</th>
                  <th className="py-2 pr-4 font-medium">Confidence</th>
                  <th className="py-2 pr-4 font-medium">Mood</th>
                </tr>
              </thead>
              <tbody>
                {data.checkins.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-800/60">
                    <td className="py-2 pr-4">{c.date}</td>
                    <td className="py-2 pr-4"><RiskBadge level={c.risk_level} size="sm" /></td>
                    <td className="py-2 pr-4">{c.confidence}%</td>
                    <td className="py-2 pr-4">{c.mood}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
