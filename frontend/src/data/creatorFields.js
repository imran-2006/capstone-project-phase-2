// Canonical keys are always English (sent to / stored by the backend).
// Only the display text is translated. Language is read from localStorage
// ("cbp_lang" = "ta" | "en"); anything else falls back to English.

export const CREATOR_FIELDS = [
  { key: "artist", emoji: "🎨", en: "Artist", ta: "ஓவியர்" },
  { key: "writer", emoji: "✍️", en: "Writer", ta: "எழுத்தாளர்" },
  { key: "musician", emoji: "🎵", en: "Musician", ta: "இசைக்கலைஞர்" },
  { key: "filmmaker", emoji: "🎬", en: "Filmmaker / Video Creator", ta: "திரைப்பட / வீடியோ படைப்பாளர்" },
  { key: "photographer", emoji: "📸", en: "Photographer", ta: "புகைப்படக் கலைஞர்" },
  { key: "designer", emoji: "💻", en: "Designer", ta: "வடிவமைப்பாளர்" },
  { key: "game_creator", emoji: "🎮", en: "Game Creator", ta: "விளையாட்டு உருவாக்குநர்" },
  { key: "content_creator", emoji: "💡", en: "Content Creator", ta: "உள்ளடக்கப் படைப்பாளர்" },
  { key: "student", emoji: "📚", en: "Student / Academic Creator", ta: "மாணவர் / கல்விப் படைப்பாளர்" },
  { key: "developer", emoji: "💻", en: "Developer / Programmer", ta: "டெவலப்பர் / நிரலாளர்" },
  { key: "performer", emoji: "🎭", en: "Performer", ta: "நிகழ்த்து கலைஞர்" },
  { key: "other", emoji: "🎤", en: "Other", ta: "மற்றவை" },
];

export const MAX_CUSTOM_LEN = 40;
export const MIN_CUSTOM_LEN = 2;

const TEXT = {
  en: {
    title: "What type of creator are you?",
    subtitle: "Choose your creative field so we can personalize your experience.",
    otherLabel: "Tell us your creative field",
    otherPlaceholder: "e.g. Architect",
    continue: "Continue to Dashboard",
    skip: "Skip for now",
    settingsTitle: "Creative Field",
    current: "Current field",
    notSet: "Not selected yet",
    save: "Save Field",
    saved: "Creative field updated",
  },
  ta: {
    title: "நீங்கள் எந்த வகையான படைப்பாளி?",
    subtitle: "உங்கள் அனுபவத்தைத் தனிப்பயனாக்க உங்கள் படைப்புத் துறையைத் தேர்ந்தெடுக்கவும்.",
    otherLabel: "உங்கள் படைப்புத் துறையைச் சொல்லுங்கள்",
    otherPlaceholder: "எ.கா. கட்டிடக் கலைஞர்",
    continue: "டாஷ்போர்டுக்குச் செல்",
    skip: "இப்போது தவிர்",
    settingsTitle: "படைப்புத் துறை",
    current: "தற்போதைய துறை",
    notSet: "இன்னும் தேர்ந்தெடுக்கவில்லை",
    save: "சேமி",
    saved: "படைப்புத் துறை புதுப்பிக்கப்பட்டது",
  },
};

export function getLang() {
  try {
    return localStorage.getItem("cbp_lang") === "ta" ? "ta" : "en";
  } catch {
    return "en";
  }
}

export const t = (key) => (TEXT[getLang()] || TEXT.en)[key] ?? TEXT.en[key];

export function fieldMeta(key) {
  return CREATOR_FIELDS.find((f) => f.key === key) || null;
}

// Display name for a stored profile: custom text for "other", translated label otherwise.
export function fieldDisplay(profile) {
  if (!profile?.field) return null;
  if (profile.field === "other" && profile.custom_field) return profile.custom_field;
  const meta = fieldMeta(profile.field);
  return meta ? meta[getLang()] || meta.en : null;
}

// Mirrors the backend rules so users get instant feedback.
export function validateCustomField(value) {
  const v = (value || "").replace(/\s+/g, " ").trim();
  if (v.length < MIN_CUSTOM_LEN) return "Please enter at least 2 characters.";
  if (v.length > MAX_CUSTOM_LEN) return `Please keep it under ${MAX_CUSTOM_LEN} characters.`;
  if (/[<>{}[\]\\`$|^~;]/.test(v)) return "Some characters are not allowed.";
  return "";
}
