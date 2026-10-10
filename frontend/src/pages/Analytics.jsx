import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from "chart.js";
import toast from "react-hot-toast";
import client from "../api/client";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const MOOD_SCORE = { Sad: 1, Frustrated: 2, Tired: 3, Neutral: 4, Motivated: 5, Happy: 6 };
const STRESS_SCORE = { Low: 1, Medium: 2, High: 3, "Very High": 4 };
const RISK_SCORE = { Low: 1, Medium: 2, High: 3, Critical: 4 };
const RISK_COLORS = { Low: "#22c55e", Medium: "#eab308", High: "#f97316", Critical: "#ef4444" };

function SummaryCard({ title, summary }) {
  return (
    <div className="card p-5">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">{title}</p>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <p className="text-xs text-gray-400">Avg Sleep</p>
          <p className="text-lg font-bold">{summary.avg_sleep}h</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Avg Work</p>
          <p className="text-lg font-bold">{summary.avg_work_hours}h</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Avg Confidence</p>
          <p className="text-lg font-bold">{summary.avg_confidence}%</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(summary.risk_counts || {}).map(([risk, count]) => (
          <span
            key={risk}
            className="text-xs font-medium px-2 py-1 rounded-full"
            style={{ backgroundColor: `${RISK_COLORS[risk]}20`, color: RISK_COLORS[risk] }}
          >
            {risk}: {count}
          </span>
        ))}
        {Object.keys(summary.risk_counts || {}).length === 0 && (
          <span className="text-xs text-gray-400">No data yet</span>
        )}
      </div>
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get("/analytics")
      .then((res) => setData(res.data))
      .catch(() => toast.error("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-primary-600" size={28} />
      </div>
    );
  }

  if (!data || data.mood_trend.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-1">Analytics</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Trends across your check-ins.</p>
        <div className="card p-16 text-center text-gray-400 text-sm">
          Not enough data yet. Log a few daily check-ins on the Dashboard to see trends here.
        </div>
      </div>
    );
  }

  const labels = data.mood_trend.map((d) => d.date);

  const chartOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: "rgba(148,163,184,0.15)" } },
    },
  };

  const moodChart = {
    labels,
    datasets: [{
      label: "Mood",
      data: data.mood_trend.map((d) => MOOD_SCORE[d.mood] || 3),
      borderColor: "#6339e6",
      backgroundColor: "rgba(99,57,230,0.12)",
      fill: true,
      tension: 0.35,
    }],
  };

  const stressChart = {
    labels,
    datasets: [{
      label: "Stress",
      data: data.stress_trend.map((d) => STRESS_SCORE[d.stress_level] || 2),
      borderColor: "#ef4444",
      backgroundColor: "rgba(239,68,68,0.1)",
      fill: true,
      tension: 0.35,
    }],
  };

  const productivityChart = {
    labels,
    datasets: [
      { label: "Focus", data: data.productivity_trend.map((d) => d.focus_level), backgroundColor: "#6339e6" },
      { label: "Energy", data: data.productivity_trend.map((d) => d.energy_level), backgroundColor: "#b3a0ff" },
    ],
  };

  const riskChart = {
    labels,
    datasets: [{
      label: "Risk",
      data: data.risk_trend.map((d) => RISK_SCORE[d.risk_level] || 1),
      borderColor: "#f97316",
      backgroundColor: "rgba(249,115,22,0.1)",
      fill: true,
      tension: 0.35,
    }],
  };

  const weeklyRiskCounts = data.weekly_summary.risk_counts || {};
  const doughnutData = {
    labels: Object.keys(weeklyRiskCounts),
    datasets: [{
      data: Object.values(weeklyRiskCounts),
      backgroundColor: Object.keys(weeklyRiskCounts).map((r) => RISK_COLORS[r]),
      borderWidth: 0,
    }],
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Analytics</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Trends across your check-ins.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <SummaryCard title="Weekly Summary" summary={data.weekly_summary} />
        <SummaryCard title="Monthly Summary" summary={data.monthly_summary} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
          <p className="text-sm font-medium mb-4">Mood Trend</p>
          <Line data={moodChart} options={chartOptions} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-5">
          <p className="text-sm font-medium mb-4">Stress Trend</p>
          <Line data={stressChart} options={chartOptions} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-5">
          <p className="text-sm font-medium mb-4">Productivity Trend (Focus vs Energy)</p>
          <Bar data={productivityChart} options={{ ...chartOptions, plugins: { legend: { display: true, position: "bottom" } } }} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card p-5">
          <p className="text-sm font-medium mb-4">Creative Block Risk Trend</p>
          <Line data={riskChart} options={chartOptions} />
        </motion.div>
      </div>

      {Object.keys(weeklyRiskCounts).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-5 mt-6 max-w-sm">
          <p className="text-sm font-medium mb-4">This Week's Risk Distribution</p>
          <Doughnut data={doughnutData} options={{ plugins: { legend: { position: "bottom" } } }} />
        </motion.div>
      )}
    </div>
  );
}
