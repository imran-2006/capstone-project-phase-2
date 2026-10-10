"""
Static (offline) library for the Creator Profile personalization layer.

Canonical field keys are always English (e.g. "writer"). Only the *display*
text is ever translated, and nothing in here is ever sent to the ML model.
Works without Gemini: this is the curated fallback content.
"""

import re
import unicodedata
from datetime import date

FIELD_KEYS = [
    "artist", "writer", "musician", "filmmaker", "photographer", "designer",
    "game_creator", "content_creator", "student", "developer", "performer", "other",
]

LABELS = {
    "artist": "Artist",
    "writer": "Writer",
    "musician": "Musician",
    "filmmaker": "Filmmaker / Video Creator",
    "photographer": "Photographer",
    "designer": "Designer",
    "game_creator": "Game Creator",
    "content_creator": "Content Creator",
    "student": "Student / Academic Creator",
    "developer": "Developer / Programmer",
    "performer": "Performer",
    "other": "Other",
}

# tips: field-specific recovery ideas, warmup: tiny rescue-style starter,
# prompts: rotated daily.
LIBRARY = {
    "artist": {
        "tips": [
            "Make a rough sketch without worrying about quality.",
            "Create a 10-minute sketch using only simple shapes.",
        ],
        "warmup": "Draw three simple shapes and turn each into an object.",
        "prompts": [
            "Paint or sketch the first thing you see out of your window, in only two colors.",
            "Draw the same object five times in under a minute each.",
        ],
    },
    "writer": {
        "tips": [
            "Write freely for 5 minutes without editing.",
            "Write a 100-word story with an unexpected ending.",
        ],
        "warmup": "Write three random sentences about anything around you.",
        "prompts": [
            "Start a story with the line: 'The door was never supposed to be open.'",
            "Write a short poem about the last thing you ate.",
        ],
    },
    "musician": {
        "tips": [
            "Play or create a simple rhythm for 5 minutes.",
            "Create a short melody using only three notes.",
        ],
        "warmup": "Tap out a simple rhythm and repeat it ten times.",
        "prompts": [
            "Hum a melody for 2 minutes, then write down the part you liked best.",
            "Take a song you know and change just its tempo or mood.",
        ],
    },
    "filmmaker": {
        "tips": [
            "Storyboard one 30-second scene with six rough frames.",
            "Film a 15-second clip of something ordinary from an unusual angle.",
        ],
        "warmup": "Sketch three stick-figure frames of a tiny scene.",
        "prompts": [
            "Plan a one-minute video that tells a story without any dialogue.",
            "Re-edit an old clip to give it a completely different mood.",
        ],
    },
    "photographer": {
        "tips": [
            "Take a photo focusing on unusual composition.",
            "Shoot five frames of one object from five different angles.",
        ],
        "warmup": "Take three quick photos using the rule of thirds.",
        "prompts": [
            "Find a subject in your home and shoot it using only natural light.",
            "Photograph something that shows contrast: light vs shadow or old vs new.",
        ],
    },
    "designer": {
        "tips": [
            "Redesign one small everyday thing, like a button or a label, in 15 minutes.",
            "Make three quick thumbnail layouts before opening your design tool.",
        ],
        "warmup": "Sketch three different logo shapes for a made-up brand.",
        "prompts": [
            "Design a poster for an imaginary event using only two fonts.",
            "Pick an app you use and sketch one screen the way you would improve it.",
        ],
    },
    "game_creator": {
        "tips": [
            "Design one tiny game mechanic you could explain in a single sentence.",
            "Sketch a single level on paper with just a start, an obstacle and a goal.",
        ],
        "warmup": "List three verbs a player could do and pick the most fun one.",
        "prompts": [
            "Invent a game that can be played with only one button.",
            "Take a simple classic game and add one surprising rule.",
        ],
    },
    "content_creator": {
        "tips": [
            "Write down five content ideas in 5 minutes, no filtering.",
            "Plan one short reel or post you can finish in 20 minutes.",
        ],
        "warmup": "Write three possible hooks for a post, one line each.",
        "prompts": [
            "Turn one thing you learned this week into a 30-second video idea.",
            "Plan a three-post mini series around a single topic.",
        ],
    },
    "student": {
        "tips": [
            "Break your current assignment into one 15-minute step and do just that.",
            "Explain your topic out loud as if teaching a friend.",
        ],
        "warmup": "Write one question about your topic that you are curious about.",
        "prompts": [
            "Turn your assignment into a question you would genuinely like answered.",
            "Sketch a one-slide summary of what you know so far.",
        ],
    },
    "developer": {
        "tips": [
            "Break the current task into one 10-minute coding step.",
            "Build a tiny feature you can finish in 20 minutes.",
        ],
        "warmup": "Write a tiny piece of code or pseudocode for any small idea.",
        "prompts": [
            "Solve a small problem you faced today with a ten-line script.",
            "Refactor one small function you wrote earlier, just for fun.",
        ],
    },
    "performer": {
        "tips": [
            "Do a 5-minute physical and voice warm-up before anything else.",
            "Improvise a 1-minute scene or movement from a random object.",
        ],
        "warmup": "Perform a single emotion using only your face for 30 seconds.",
        "prompts": [
            "Act out a short monologue in three very different moods.",
            "Create 16 counts of movement inspired by your favorite song.",
        ],
    },
}

GENERIC = {
    "tips": [
        "Set a 10-minute timer and make something small and imperfect.",
        "Change your environment for a short while to spark new ideas.",
    ],
    "warmup": "Make three quick, rough ideas and pick your favorite one.",
    "prompts": [
        "Create something in 10 minutes using only what is within reach.",
        "Combine two unrelated ideas into one new concept.",
    ],
}

MAX_CUSTOM_LEN = 40
MIN_CUSTOM_LEN = 2
_FORBIDDEN = set("<>{}[]\\`$|^~;")


def clean_custom_field(value):
    """Return a safe, normalised custom field string or raise ValueError."""
    if value is None:
        raise ValueError("Please tell us your creative field.")
    text = unicodedata.normalize("NFC", str(value))
    # drop control / invisible format characters, collapse whitespace
    text = "".join(ch for ch in text if unicodedata.category(ch) not in ("Cc", "Cf"))
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) < MIN_CUSTOM_LEN:
        raise ValueError("Please enter at least 2 characters for your creative field.")
    if len(text) > MAX_CUSTOM_LEN:
        raise ValueError(f"Creative field must be {MAX_CUSTOM_LEN} characters or fewer.")
    if any(ch in _FORBIDDEN for ch in text):
        raise ValueError("Creative field contains characters that are not allowed.")
    return text


def display_label(field, custom_field=None):
    if field == "other" and custom_field:
        return custom_field
    return LABELS.get(field, "")


def build_personalization(field, custom_field=None):
    """Field-specific content. Never raises; falls back to generic content."""
    entry = LIBRARY.get(field) if field else None
    day = date.today().toordinal()
    if entry is None:
        entry = GENERIC
        if field == "other" and custom_field:
            tips = [
                f"Set a 10-minute timer and make one small, imperfect piece of {custom_field} work.",
                GENERIC["tips"][1],
            ]
            entry = {**GENERIC, "tips": tips}
    prompts = entry["prompts"]
    return {
        "recovery_tips": list(entry["tips"]),
        "warmup": entry["warmup"],
        "daily_prompt": prompts[day % len(prompts)],
    }
