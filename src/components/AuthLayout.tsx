import type { ReactNode } from "react";
import { HardHat } from "lucide-react";

/**
 * Shared split-pane chrome for public auth screens (sign-in, forgot / reset password).
 * Matches the Sign-in layout so all auth routes stay visually consistent.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-background">
      <aside className="hidden lg:flex relative bg-sidebar text-sidebar-foreground flex-col justify-between p-10 overflow-hidden">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-accent text-accent-foreground">
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
            Digitised workforce, daily programme and weekly pay — in one place.
          </h2>
          <p className="mt-4 text-sm text-sidebar-foreground/70">
            Replace your spreadsheets with a real-time view of every operative, property and
            payment.
          </p>
        </div>

        <div className="text-[11px] text-sidebar-foreground/50">
          © {new Date().getFullYear()} Schore Limited. All rights reserved.
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-accent/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-info/15 blur-3xl"
        />
      </aside>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
              <HardHat className="h-5 w-5" />
            </div>
            <div className="font-display font-semibold">SCHORE</div>
          </div>

          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle != null && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}

          <div className="mt-6">{children}</div>

          {footer != null && <div className="mt-6">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
