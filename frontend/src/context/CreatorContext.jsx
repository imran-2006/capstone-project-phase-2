import { createContext, useContext, useState, useEffect, useCallback } from "react";
import client from "../api/client";
import { useAuth } from "./AuthContext";

const CreatorContext = createContext(null);

const EMPTY_PERSONALIZATION = { recovery_tips: [], warmup: "", daily_prompt: "" };

export function CreatorProvider({ children }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null); // null until loaded
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error

  const email = user?.email;

  const skipKey = email ? `cbp_creator_skip_${email}` : null;
  const wasSkipped = () => {
    try { return !!skipKey && localStorage.getItem(skipKey) === "1"; } catch { return false; }
  };

  useEffect(() => {
    if (!email) {
      setProfile(null);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    client
      .get("/creator-profile")
      .then((res) => {
        if (cancelled) return;
        setProfile(res.data);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setProfile(null);
        setStatus("error"); // never block the app if this fails
      });
    return () => { cancelled = true; };
  }, [email]);

  const saveField = useCallback(async (field, customField) => {
    const res = await client.put("/creator-profile", {
      field,
      custom_field: field === "other" ? customField : null,
    });
    setProfile(res.data);
    setStatus("ready");
    return res.data;
  }, []);

  const skip = useCallback(() => {
    try { if (skipKey) localStorage.setItem(skipKey, "1"); } catch { /* ignore */ }
    setStatus((s) => (s === "ready" ? "skipped" : s));
  }, [skipKey]);

  // Show onboarding only when we KNOW the user has no field and has not skipped.
  const needsOnboarding =
    (status === "ready") && !profile?.field && !wasSkipped();

  const value = {
    profile,
    status,
    field: profile?.field || null,
    label: profile?.label || null,
    personalization: profile?.personalization || EMPTY_PERSONALIZATION,
    needsOnboarding,
    saveField,
    skip,
  };

  return <CreatorContext.Provider value={value}>{children}</CreatorContext.Provider>;
}

export function useCreator() {
  const ctx = useContext(CreatorContext);
  if (!ctx) throw new Error("useCreator must be used within CreatorProvider");
  return ctx;
}
