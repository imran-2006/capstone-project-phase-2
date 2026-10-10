import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useCreator } from "../context/CreatorContext";
import CreatorFieldPicker from "../components/CreatorFieldPicker";
import { validateCustomField, t } from "../data/creatorFields";

export default function Onboarding() {
  const { user, loading: authLoading } = useAuth();
  const { saveField, skip } = useCreator();
  const navigate = useNavigate();
  const [field, setField] = useState("");
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const customError = field === "other" && custom ? validateCustomField(custom) : "";
  const canContinue = !!field && (field !== "other" || !validateCustomField(custom));

  const handleContinue = async () => {
    if (!canContinue) return;
    setSaving(true);
    try {
      await saveField(field, custom.replace(/\s+/g, " ").trim());
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not save your creative field");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    skip();
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="card w-full max-w-3xl p-6 sm:p-10"
      >
        <h1 className="font-display text-3xl sm:text-4xl font-bold">🎨 {t("title")}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2 mb-8">{t("subtitle")}</p>

        <CreatorFieldPicker
          value={field}
          customValue={custom}
          onChange={setField}
          onCustomChange={setCustom}
          error={customError}
        />

        <div className="mt-8 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 underline-offset-4 hover:underline"
          >
            {t("skip")}
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue || saving}
            className="btn-primary text-white font-medium px-6 py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {t("continue")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
