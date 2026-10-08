export type ShellLayout = "reading" | "wide";

// The card is the same width on every page (960 px from lg), so it never
// resizes while moving around the app. Each page picks the width of its
// content inside it: a reading column (Guida, Profilo, Notifiche, ...) or the
// whole card (Home's two columns, Admin). Used by AppShell and by the
// loading.tsx skeletons, which must match it.
export const SHELL_WIDTH = "max-w-[480px] md:max-w-[640px] lg:max-w-[960px]";

// Below lg the card is at most 640 px, so the reading column changes nothing there.
export const CONTENT_WIDTH: Record<ShellLayout, string> = {
  reading: "mx-auto w-full max-w-[600px]",
  wide: "w-full",
};
