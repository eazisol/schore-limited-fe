import type { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type TooltipSide = "top" | "right" | "bottom" | "left";

/**
 * Reusable hover tooltip for any trigger (buttons, readonly fields, icons, etc.).
 * Wraps Radix tooltip with shared project styling.
 */
export function AppTooltip({
  content,
  children,
  side = "top",
  align = "center",
  delayDuration = 200,
  className,
  contentClassName,
  disabled = false,
  asChild = false,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  align?: "start" | "center" | "end";
  delayDuration?: number;
  className?: string;
  contentClassName?: string;
  /** When true, renders children without a tooltip. */
  disabled?: boolean;
  /** When true, merges trigger props onto the child element (for links/buttons). */
  asChild?: boolean;
}) {
  if (disabled || content == null || content === "") {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>
          {asChild ? (
            children
          ) : (
            <span className={cn("inline-flex max-w-full cursor-default", className)}>
              {children}
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className={cn(
            "max-w-xs border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-md",
            contentClassName,
          )}
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
