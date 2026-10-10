import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Moon, Sun, Save, User, Mail } from "lucide-react";
import toast from "react-hot-toast";
import client from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useCreator } from "../context/CreatorContext";
import CreatorFieldPicker from "../components/CreatorFieldPicker";
import { fieldDisplay, validateCustomField, t } from "../data/creatorFields";

export default function Settings() {
  const { user, updateUser } = useAuth();
  const { dark, toggleTheme } = useTheme();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [loading, setLoading] = useState(false);
  const { profile, saveField } = useCreator();
  const [fieldDraft, setFieldDraft] = useState(null); // null = untouched, show saved value
  const [customDraft, setCustomDraft] = useState(null);
  const [fieldSaving, setFieldSaving] = useState(false);

  const pickedField = fieldDraft ?? profile?.field ?? "";
  const pickedCustom = customDraft ?? profile?.custom_field ?? "";
  const customError = pickedField === "other" && pickedCustom ? validateCustomField(pickedCustom) : "";
  const fieldChanged =
    pickedField !== (profile?.field ?? "") ||
    (pickedField === "other" && pickedCustom.trim() !== (profile?.custom_field ?? ""));
  const canSaveField = !!pickedField && fieldChanged && (pickedField !== "other" || !validateCustomField(pickedCustom));

  const handleSaveField = async () => {
    setFieldSaving(true);
    try {
      await saveField(pickedField, pickedCustom.replace(/\s+/g, " ").trim());
      setFieldDraft(null);
      setCustomDraft(null);
      toast.success(t("saved"));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update creative field");
    } finally {
      setFieldSaving(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await client.put("/profile", { name, email });
      updateUser({ name: res.data.name, email: res.data.email });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Settings</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        Manage your profile and app preferences.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <h2 className="font-semibold mb-4">Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
              <div className="relative mt-1">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <div className="relative mt-1">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 btn-primary text-white font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Changes
            </button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-6">
          <h2 className="font-semibold mb-4">Appearance</h2>
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60">
            <div className="flex items-center gap-3">
              {dark ? <Moon size={18} className="text-primary-500" /> : <Sun size={18} className="text-primary-500" />}
              <div>
                <p className="text-sm font-medium">Dark Mode</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {dark ? "Currently enabled" : "Currently disabled"}
                </p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className={`w-12 h-6 rounded-full transition-colors relative ${dark ? "bg-primary-600" : "bg-gray-300"}`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${dark ? "translate-x-6" : "translate-x-0.5"}`}
              />
            </button>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6 lg:col-span-2">
          <h2 className="font-semibold mb-1">{t("settingsTitle")}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {t("current")}: <span className="font-medium text-gray-800 dark:text-gray-100">{fieldDisplay(profile) || t("notSet")}</span>
          </p>
          <CreatorFieldPicker
            value={pickedField}
            customValue={pickedCustom}
            onChange={setFieldDraft}
            onCustomChange={setCustomDraft}
            error={customError}
            compact
          />
          <button
            onClick={handleSaveField}
            disabled={!canSaveField || fieldSaving}
            className="mt-5 flex items-center gap-2 btn-primary text-white font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {fieldSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {t("save")}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
