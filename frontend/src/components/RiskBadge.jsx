const RISK_STYLES = {
  Low: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  Medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  High: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  Critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

export default function RiskBadge({ level, size = "md" }) {
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";
  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${sizeClasses} ${RISK_STYLES[level] || RISK_STYLES.Medium}`}>
      {level}
    </span>
  );
}

export { RISK_STYLES };
