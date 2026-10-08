import { SHELL_WIDTH, type ShellWidth } from "@/components/shell-width";

// Mirror AppShell's wrapper (same max-widths, frame padding, card chrome and
// header height) so the streamed page doesn't shift when it replaces this.
export function ShellSkeleton({ width = "member" }: { width?: ShellWidth }) {
  return (
    <div className="min-h-screen bg-brand-frame sm:p-6">
      <div
        className={`mx-auto flex min-h-screen w-full flex-col bg-brand-warm-white sm:min-h-[calc(100vh-3rem)] sm:overflow-hidden sm:rounded-xl sm:border sm:border-brand-border sm:shadow-sm ${SHELL_WIDTH[width]}`}
      >
        <div className="border-b border-brand-border px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="h-[26px] w-28 animate-pulse rounded-md bg-black/[0.05]" />
            <div className="h-8 w-20 animate-pulse rounded-full bg-black/[0.04]" />
          </div>
          <div className="mt-3 hidden h-9 w-80 animate-pulse rounded-full bg-black/[0.04] lg:block" />
        </div>
        <div className="flex-1 px-5 py-4 pb-[calc(var(--spacing-nav-h)+1rem)] lg:pb-4">
          <div className="space-y-[14px]">
            <div className="h-[140px] animate-pulse rounded-card bg-black/[0.05]" />
            <div className="h-[100px] animate-pulse rounded-card bg-black/[0.04]" />
            <div className="h-[80px] animate-pulse rounded-card bg-black/[0.03]" />
          </div>
        </div>
      </div>
    </div>
  );
}
