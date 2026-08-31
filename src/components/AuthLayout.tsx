import type { ReactNode } from "react";
import { HardHat, Lock, Shield } from "lucide-react";

/**
 * Shared split-pane chrome for public auth screens (sign-in, forgot / reset password).
 * Matches the Sign-in layout so all auth routes stay visually consistent.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  icon: Icon = Lock,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  icon?: typeof Lock;
}) {
  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-background">
      <aside className="hidden lg:flex relative bg-sidebar text-sidebar-foreground flex-col justify-between p-10 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_oklch,var(--accent)_28%,transparent),transparent_55%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,color-mix(in_oklch,var(--accent)_18%,transparent),transparent_50%)]"
        />

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-accent text-accent-foreground shadow-[0_0_24px_color-mix(in_oklch,var(--accent)_45%,transparent)]">
            <HardHat className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-semibold">SCHORE</div>
            <div className="text-[11px] text-sidebar-foreground/60 tracking-wide">
              Workforce & Payroll
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="font-display text-3xl font-semibold tracking-tight leading-tight">
            Digitised workforce, daily programme and weekly pay — in one place
            <span className="text-accent">.</span>
          </h2>
          <div className="mt-5 h-0.5 w-12 rounded-full bg-accent" aria-hidden />
          <p className="mt-5 text-sm text-sidebar-foreground/70 leading-relaxed">
            Replace your spreadsheets with a real-time view of every operative, property and
            payment.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-1.5 text-[11px] text-sidebar-foreground/50">
          <Shield className="h-3.5 w-3.5 text-accent/70 shrink-0" aria-hidden />
          <span>© {new Date().getFullYear()} Schore Limited. All rights reserved.</span>
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full border border-accent/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full border border-accent/10"
        />
      </aside>

      <div className="flex items-center justify-center p-4 sm:p-8 lg:p-10">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden mb-6 flex items-center justify-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
              <HardHat className="h-5 w-5" />
            </div>
            <div className="font-display font-semibold">SCHORE</div>
          </div>

          <div className="card-elevated p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-accent/15 text-accent ring-1 ring-accent/20 mb-4">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              {subtitle != null && (
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-sm">
                  {subtitle}
                </p>
              )}
            </div>

            <div className="mt-6 sm:mt-8">{children}</div>

            {footer != null && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center" aria-hidden>
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-wide">
                    <span className="bg-card px-3 text-muted-foreground">or</span>
                  </div>
                </div>
                <div>{footer}</div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
