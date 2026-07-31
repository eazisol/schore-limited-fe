import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  headerActions,
  children,
  size = "md",
  showCloseButton = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  /** When false, hides the header X button (Cancel still closes). Default true. */
  showCloseButton?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const maxW = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-xl";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-4 sm:p-8">
        <div
          className={`card-elevated w-full ${maxW} bg-background shadow-xl`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-4 border-b px-5 py-3">
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-semibold">{title}</h2>
              {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {headerActions}
              {showCloseButton ? (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring";
