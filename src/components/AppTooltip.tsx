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
  /** When true, suppresses the tooltip without remounting children. */
  disabled?: boolean;
  /** When true, merges trigger props onto the child element (for links/buttons). */
  asChild?: boolean;
}) {
  // Keep the same wrapper tree when disabled so children (e.g. inputs) are not
  // remounted when content appears — remounting steals focus after the first keystroke.
  const isDisabled = disabled || content == null || content === "";

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip open={isDisabled ? false : undefined}>
        <TooltipTrigger asChild>
          {asChild ? (
            children
          ) : (
            <span className={cn("inline-flex w-fit max-w-full cursor-default", className)}>
              {children}
            </span>
          )}
        </TooltipTrigger>
        {!isDisabled ? (
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
        ) : null}
      </Tooltip>
    </TooltipProvider>
  );
}
