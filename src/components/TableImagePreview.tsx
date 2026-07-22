import { useEffect, useState, type ReactNode } from "react";
import { ImageIcon, X } from "lucide-react";
import { AppTooltip } from "@/components/AppTooltip";
import { cn } from "@/lib/utils";

function ImagePreviewModal({
  open,
  onClose,
  src,
  title = "Uploaded image",
}: {
  open: boolean;
  onClose: () => void;
  src: string;
  title?: string;
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-4 sm:p-8">
        <div
          className="w-full max-w-lg rounded-xl border bg-card shadow-xl"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-foreground text-background">
                <ImageIcon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 pt-2">
                <h2 className="font-display text-base font-semibold leading-tight">{title}</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-5 pt-4">
            <img
              src={src}
              alt={title}
              className="max-h-[70vh] w-full rounded-lg border bg-muted/30 object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Table thumbnail: hover shows text tooltip only; click opens full image modal.
 * Use `variant="icon"` for an image-icon trigger (e.g. dedicated Image column).
 */
export function TableImagePreview({
  src,
  alt = "",
  className,
  fallback,
  tooltip = "View image",
  variant = "thumbnail",
}: {
  src: string;
  alt?: string;
  className?: string;
  fallback?: ReactNode;
  tooltip?: string;
  variant?: "thumbnail" | "icon";
}) {
  const [open, setOpen] = useState(false);

  if (!src) {
    return (
      <>
        {fallback ??
          (variant === "icon" ? (
            <span className="inline-grid h-8 w-8 place-items-center text-muted-foreground/40">
              <ImageIcon className="h-4 w-4" aria-hidden />
            </span>
          ) : null)}
      </>
    );
  }

  return (
    <>
      <AppTooltip content={tooltip} side="top" disabled={open} asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          aria-label={tooltip}
          className={cn(
            "shrink-0 cursor-pointer transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            variant === "icon"
              ? "inline-grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              : "overflow-hidden rounded-md border bg-muted/20",
            className,
          )}
        >
          {variant === "icon" ? (
            <ImageIcon className="h-4 w-4" aria-hidden />
          ) : (
            <img src={src} alt={alt} className="h-full w-full object-cover" />
          )}
        </button>
      </AppTooltip>
      <ImagePreviewModal open={open} onClose={() => setOpen(false)} src={src} />
    </>
  );
}
