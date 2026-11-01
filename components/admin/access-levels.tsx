"use client";

import { createContext, useContext, type ReactNode } from "react";
import { ACCESS_LEVELS, type AccessLevel } from "@/lib/roles";

// The cycle access levels the person in Admin may give a cycle: every level
// for an admin, only those their own role sees for a "Referente ordini"
// (lib/auth/manager.ts managesCycle checks it again on the server).
const AccessLevels = createContext<readonly AccessLevel[]>(ACCESS_LEVELS);

export function AccessLevelsProvider({ levels, children }: { levels: readonly AccessLevel[]; children: ReactNode }) {
  return <AccessLevels.Provider value={levels}>{children}</AccessLevels.Provider>;
}

export function useAccessLevels(): readonly AccessLevel[] {
  return useContext(AccessLevels);
}
