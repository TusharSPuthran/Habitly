

const STORAGE_KEY = "habitly-local-v1";

const starterHabits = [
  { id: "water", name: "Drink 8 glasses of water", emoji: "💧", color: "#68a9f5", createdAt: "2026-01-01", completions: [] },
  { id: "read", name: "Read for 20 minutes", emoji: "📚", color: "#9b8af7", createdAt: "2026-01-01", completions: [] },
  { id: "move", name: "Move your body", emoji: "🏃", color: "#f2a46f", createdAt: "2026-01-01", completions: [] },
  { id: "journal", name: "Journal or reflect", emoji: "✍️", color: "#e88bb0", createdAt: "2026-01-01", completions: [] }
];

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.habits) && Array.isArray(parsed.moods)) return parsed;
    }
  } catch {
    // Invalid or unavailable local storage: fall back to a fresh local state.
  }
  return { habits: starterHabits, moods: [] };
}

export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    console.warn("Could not save Habitly data to local storage.");
  }
}

export function exportData(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `habitly-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function importData(file) {
  return file.text().then((text) => {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.habits) || !Array.isArray(parsed.moods)) {
      throw new Error("That file is not a valid Habitly backup.");
    }
    return parsed;
  });
}
