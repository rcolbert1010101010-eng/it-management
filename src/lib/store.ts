import { create } from "zustand";

interface AppState {
  performedBy: string;
  setPerformedBy: (name: string) => void;
}

const stored = typeof window !== "undefined" ? localStorage.getItem("performedBy") : null;

export const useAppStore = create<AppState>((set) => ({
  performedBy: stored || "system",
  setPerformedBy: (name: string) => {
    localStorage.setItem("performedBy", name);
    set({ performedBy: name });
  },
}));
