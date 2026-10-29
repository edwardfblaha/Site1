/** Zustand store wrapping the game controller. The UI reads `save` and calls
 * actions; after each mutation we clone the save (new reference) so React
 * re-renders, and autosave to localStorage. */
import { create } from "zustand";
import * as G from "./game";
import type { GameSave } from "./game";
import type { TrainingChoice, RaceResult } from "../engine";
import { saveToLocal, loadFromLocal, clearLocal } from "./save";

interface Store {
  save: GameSave | null;
  lastResult: RaceResult | null;
  newGame: (seed: number, playerId: string) => void;
  loadExisting: () => boolean;
  importSave: (save: GameSave) => void;
  quitToMenu: () => void;
  train: (choice: TrainingChoice) => void;
  race: (lineupIds: string[]) => void;
  resolveEvent: (choiceIndex: number) => void;
  signRecruit: (recruitId: string) => { signed: boolean; reason: string };
  patchBudget: (patch: Partial<GameSave["programs"][number]["budget"]>) => void;
  nextSeason: () => void;
}

// mutate the live save in place, then publish a shallow clone for React
function commit(set: (p: Partial<Store>) => void, save: GameSave, extra?: Partial<Store>) {
  saveToLocal(save);
  set({ save: { ...save }, ...extra });
}

export const useGame = create<Store>((set, get) => ({
  save: null,
  lastResult: null,

  newGame(seed, playerId) {
    const save = G.newGame(seed, playerId);
    commit(set, save, { lastResult: null });
  },
  loadExisting() {
    const s = loadFromLocal();
    if (s) { set({ save: s, lastResult: null }); return true; }
    return false;
  },
  importSave(save) { commit(set, save, { lastResult: null }); },
  quitToMenu() { clearLocal(); set({ save: null, lastResult: null }); },

  train(choice) {
    const save = get().save; if (!save) return;
    G.trainWeek(save, choice);
    commit(set, save);
  },
  race(lineupIds) {
    const save = get().save; if (!save) return;
    const res = G.raceWeek(save, lineupIds);
    commit(set, save, { lastResult: res });
  },
  resolveEvent(i) {
    const save = get().save; if (!save) return;
    G.resolveEvent(save, i);
    commit(set, save);
  },
  signRecruit(id) {
    const save = get().save; if (!save) return { signed: false, reason: "No game." };
    const r = G.playerSign(save, id);
    commit(set, save);
    return r;
  },
  patchBudget(patch) {
    const save = get().save; if (!save) return;
    const p = G.player(save);
    p.budget = { ...p.budget, ...patch };
    commit(set, save);
  },
  nextSeason() {
    const save = get().save; if (!save) return;
    G.startNextSeason(save);
    commit(set, save, { lastResult: null });
  },
}));
