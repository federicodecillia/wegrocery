import { SHELL_WIDTH } from "@/components/shell-width";

// Mirror AppShell's wrapper (same max-widths, frame padding, card chrome and
// header height) so the streamed page doesn't shift when it replaces this.
export function ShellSkeleton() {
  return (
    <div className="min-h-screen bg-brand-frame sm:p-6">
      <div
        className={`mx-auto flex min-h-screen w-full flex-col bg-brand-warm-white sm:min-h-[calc(100vh-3rem)] sm:overflow-clip sm:rounded-xl sm:border sm:border-brand-border sm:shadow-sm ${SHELL_WIDTH}`}
      >
        <div className="border-b border-brand-border px-5 py-4 lg:py-3">
          <div className="flex items-center justify-between gap-3 lg:gap-6">
            <div className="h-[26px] w-28 animate-pulse rounded-md bg-black/[0.05]" />
            {/* The menu, in the same row from lg. */}
            <div className="hidden h-9 w-80 flex-1 animate-pulse rounded-full bg-black/[0.04] lg:block" />
            {/* The bell and the avatar. */}
            <div className="flex gap-3">
              <div className="h-8 w-8 animate-pulse rounded-full bg-black/[0.04]" />
              <div className="h-8 w-8 animate-pulse rounded-full bg-black/[0.05]" />
            </div>
          </div>
        </div>
        <div className="flex-1 px-5 py-4 pb-[calc(var(--spacing-nav-h)+1rem)] lg:pb-4">
          <div className="space-y-[14px]">
            <div className="h-[140px] animate-pulse rounded-card bg-black/[0.05]" />
            <div className="h-[100px] animate-pulse rounded-card bg-black/[0.04]" />
            <div className="h-[80px] animate-pulse rounded-card bg-black/[0.03]" />
          </div>
        </div>
        {/* The bottom bar's strip, without items: with no session yet the
            skeleton cannot know whether there are four or five. */}
        <div className="sticky bottom-0 h-[calc(var(--spacing-nav-h)+env(safe-area-inset-bottom))] border-t border-brand-border bg-brand-warm-white lg:hidden" />
      </div>
    </div>
  );
}
