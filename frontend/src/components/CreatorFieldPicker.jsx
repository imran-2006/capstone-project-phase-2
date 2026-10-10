import {
  CREATOR_FIELDS, MAX_CUSTOM_LEN, getLang, t,
} from "../data/creatorFields";

export default function CreatorFieldPicker({ value, customValue, onChange, onCustomChange, error, compact = false }) {
  const lang = getLang();

  return (
    <div>
      <div
        role="radiogroup"
        aria-label={t("title")}
        className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}
      >
        {CREATOR_FIELDS.map((f) => {
          const active = value === f.key;
          return (
            <button
              key={f.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(f.key)}
              className={`text-left rounded-2xl border px-4 py-3 transition-all flex items-center gap-3 ${
                active
                  ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 ring-2 ring-primary-500/40"
                  : "border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 hover:border-primary-300 hover:-translate-y-0.5"
              }`}
            >
              <span className="text-2xl leading-none" aria-hidden="true">{f.emoji}</span>
              <span className="text-sm font-medium leading-snug">{f[lang] || f.en}</span>
            </button>
          );
        })}
      </div>

      {value === "other" && (
        <div className="mt-4">
          <label htmlFor="custom-field" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("otherLabel")}
          </label>
          <input
            id="custom-field"
            value={customValue}
            maxLength={MAX_CUSTOM_LEN + 20}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder={t("otherPlaceholder")}
            className="mt-1 w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="flex justify-between mt-1 text-xs">
            <span className="text-red-500">{error}</span>
            <span className="text-gray-400">{(customValue || "").trim().length}/{MAX_CUSTOM_LEN}</span>
          </div>
        </div>
      )}
    </div>
  );
}
