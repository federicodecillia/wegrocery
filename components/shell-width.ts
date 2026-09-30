export type ShellWidth = "member" | "admin";

// Member pages stay a readable column; only Admin widens on desktop, so the
// card resizes only when entering or leaving Admin. Used by AppShell and by
// the loading.tsx skeletons, which must match it.
export const SHELL_WIDTH: Record<ShellWidth, string> = {
  member: "max-w-[480px] md:max-w-[640px]",
  admin: "max-w-[480px] md:max-w-[640px] lg:max-w-[960px]",
};
