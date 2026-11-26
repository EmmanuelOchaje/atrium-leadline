"use client";

import { create } from "zustand";

export { DEMO_ROLES, demoPrivateKey, type DemoRole } from "@leadline/sdk";
import type { DemoRole } from "@leadline/sdk";

type DemoState = {
  /** Demo mode is on by default on the local chain — no wallet pop-ups on stage (§11.7). */
  demoMode: boolean;
  role: DemoRole;
  autopilot: boolean;
  drawerOpen: boolean;
  setRole: (role: DemoRole) => void;
  setDemoMode: (on: boolean) => void;
  toggleAutopilot: () => void;
  setDrawerOpen: (open: boolean) => void;
};

export const useDemoStore = create<DemoState>((set) => ({
  demoMode: true,
  role: "marketMaker",
  autopilot: false,
  drawerOpen: false,
  setRole: (role) => set({ role }),
  setDemoMode: (on) => set({ demoMode: on }),
  toggleAutopilot: () => set((s) => ({ autopilot: !s.autopilot })),
  setDrawerOpen: (open) => set({ drawerOpen: open }),
}));
