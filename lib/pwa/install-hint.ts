// Whether the home page invites the member to install the app, and how. Pure:
// the component (components/install-prompt.tsx) reads the browser.

export type InstallHint = "prompt" | "ios" | null;

export type InstallContext = {
  userAgent: string;
  // iPadOS reports a desktop Safari user agent; touch points tell it apart.
  maxTouchPoints: number;
  // Already opened from the home screen.
  standalone: boolean;
  dismissed: boolean;
  // The browser offered its own install dialog (beforeinstallprompt).
  canPrompt: boolean;
};

export function isIOS(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

export function isPhoneOrTablet(userAgent: string, maxTouchPoints: number): boolean {
  return /Android|Mobi/.test(userAgent) || isIOS(userAgent, maxTouchPoints);
}

export function installHint(c: InstallContext): InstallHint {
  if (c.standalone || c.dismissed || !isPhoneOrTablet(c.userAgent, c.maxTouchPoints)) return null;
  if (c.canPrompt) return "prompt";
  // Safari has no install dialog: the member adds the page from the share sheet.
  return isIOS(c.userAgent, c.maxTouchPoints) ? "ios" : null;
}
