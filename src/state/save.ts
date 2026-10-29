/** Save/load: localStorage persistence + JSON export/import. */
import type { GameSave } from "./game";

const KEY = "ccm.save.v1";

export function saveToLocal(save: GameSave): void {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* storage unavailable */ }
}
export function loadFromLocal(): GameSave | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GameSave) : null;
  } catch { return null; }
}
export function clearLocal(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
export function exportSave(save: GameSave): void {
  const blob = new Blob([JSON.stringify(save, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ccm-${save.playerId}-${save.year}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
export function importSave(file: File): Promise<GameSave> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(String(reader.result)) as GameSave); }
      catch (e) { reject(e); }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
