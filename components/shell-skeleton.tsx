import { SHELL_WIDTH } from "@/components/shell-width";

// Mirror AppShell's wrapper (same max-widths, frame padding, card chrome and
// header height) so the streamed page doesn't shift when it replaces this.
export function ShellSkeleton() {
  return (
    <div className="min-h-screen bg-brand-frame sm:p-6 md:flex md:bg-brand-warm-white md:p-0">
      {/* The rail (tablet) or sidebar (PC), without items. */}
      <div className="hidden h-screen w-[88px] shrink-0 border-r border-brand-border md:block lg:w-[248px]" />
      <div
        className={`mx-auto flex min-h-screen w-full flex-col bg-brand-warm-white sm:min-h-[calc(100vh-3rem)] sm:overflow-clip sm:rounded-xl sm:border sm:border-brand-border sm:shadow-sm md:min-h-screen md:min-w-0 md:flex-1 md:rounded-none md:border-0 md:shadow-none ${SHELL_WIDTH}`}
      >
        <div className="border-b border-brand-border px-5 py-4 md:hidden">
          <div className="flex items-center justify-between gap-3 lg:gap-6">
            <div className="h-[26px] w-28 animate-pulse rounded-md bg-tint/[0.05]" />
            {/* The bell and the avatar. */}
            <div className="flex gap-3">
              <div className="h-8 w-8 animate-pulse rounded-full bg-tint/[0.04]" />
              <div className="h-8 w-8 animate-pulse rounded-full bg-tint/[0.05]" />
            </div>
          </div>
        </div>
        <div className="flex-1 px-5 py-4 pb-[calc(var(--spacing-nav-h)+1rem)] md:px-8 md:py-6">
          <div className="space-y-3.5">
            <div className="h-[140px] animate-pulse rounded-card bg-tint/[0.05]" />
            <div className="h-[100px] animate-pulse rounded-card bg-tint/[0.04]" />
            <div className="h-[80px] animate-pulse rounded-card bg-tint/[0.03]" />
          </div>
        </div>
        {/* The bottom bar's strip, without items: with no session yet the
            skeleton cannot know whether there are four or five. */}
        <div className="sticky bottom-0 h-[calc(var(--spacing-nav-h)+env(safe-area-inset-bottom))] border-t border-brand-border bg-brand-warm-white md:hidden" />
      </div>
    </div>
  );
}
