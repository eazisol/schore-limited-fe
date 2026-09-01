import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Calendar, CalendarCheck, Mail, MapPin, Phone, ScrollText, User } from "lucide-react";
import { AppTooltip } from "@/components/AppTooltip";
import { TableImagePreview } from "@/components/TableImagePreview";
import { cn } from "@/lib/utils";

export type DetailProfileHighlight = {
  label: string;
  value: ReactNode;
  /** Span both columns in the highlights grid (e.g. address block). */
  wide?: boolean;
};

function resolveNameText(name: ReactNode, imageAlt?: string): string {
  if (typeof name === "string") return name;
  return imageAlt?.trim() ?? "";
}

function profileInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function DetailProfileHero({
  title,
  backLabel,
  backTo,
  onBack,
  headerActions,
  leading,
  name,
  subtitle,
  imageUrl,
  imageAlt,
  status,
  email,
  phone,
  dateOfBirth,
  joiningDate,
  location,
  description,
  highlights,
  children,
  className,
}: {
  title?: string;
  backLabel?: string;
  backTo?: string;
  onBack?: { label: string; onClick: () => void };
  headerActions?: ReactNode;
  /** Custom leading visual (e.g. property icon). Replaces profile avatar when set. */
  leading?: ReactNode;
  name: ReactNode;
  subtitle?: string;
  imageUrl?: string;
  imageAlt?: string;
  status?: ReactNode;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  joiningDate?: string | null;
  /** Multi-line address shown below contact details with a map pin icon. */
  location?: string | null;
  /** Multi-line description shown below contact details. */
  description?: string | null;
  highlights?: DetailProfileHighlight[];
  children?: ReactNode;
  className?: string;
}) {
  const nameText = resolveNameText(name, imageAlt);
  const initials = profileInitials(nameText);
  const trimmedEmail = email?.trim();
  const trimmedPhone = phone?.trim();
  const trimmedDob = dateOfBirth?.trim();
  const trimmedJoiningDate = joiningDate?.trim();
  const trimmedLocation = location?.trim();
  const trimmedDescription = description?.trim();
  const hasContact = Boolean(trimmedEmail || trimmedPhone || trimmedDob || trimmedJoiningDate);
  const hasHighlights = Boolean(highlights?.length);
  const hasToolbar = Boolean(title || backTo || onBack || headerActions);

  const backControl = onBack ? (
    <AppTooltip content={onBack.label} asChild>
      <button
        type="button"
        onClick={onBack.onClick}
        aria-label={onBack.label}
        className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
    </AppTooltip>
  ) : backTo && backLabel ? (
    <AppTooltip content={backLabel} asChild>
      <Link
        to={backTo}
        aria-label={backLabel}
        className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
    </AppTooltip>
  ) : null;

  return (
    <div className={cn("card-elevated overflow-hidden", className)}>
      {hasToolbar ? (
        <div className="flex flex-col gap-2 border-b border-border px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            {backControl}
            {title ? (
              <h1 className="font-display text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
            ) : null}
          </div>
          {headerActions ? (
            <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
          ) : null}
        </div>
      ) : null}
      <div
        className={cn(
          "bg-muted/25 px-4 py-2 sm:px-5",
          children ? "border-b border-border" : undefined,
        )}
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-2.5">
            {leading ?? (
              <TableImagePreview
                src={imageUrl ?? ""}
                alt={imageAlt ?? nameText}
                tooltip="View profile photo"
                className="h-11 w-11 rounded-full border-2 border-background shadow-sm sm:h-12 sm:w-12"
                fallback={
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-background bg-accent/90 text-sm font-semibold text-accent-foreground shadow-sm sm:h-12 sm:w-12">
                    {initials || <User className="h-5 w-5" aria-hidden />}
                  </span>
                }
              />
            )}

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                <h2 className="font-display text-lg font-semibold tracking-tight sm:text-xl">
                  {name}
                </h2>
                {status}
              </div>
              {subtitle ? (
                <p className="mt-0.5 break-words text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
              ) : null}
              {hasContact ? (
                <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 sm:justify-start">
                  {trimmedEmail ? (
                    <span className="inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                      <span className="break-all leading-none">{trimmedEmail}</span>
                    </span>
                  ) : null}
                  {trimmedPhone ? (
                    <span className="inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                      <span className="break-all leading-none">{trimmedPhone}</span>
                    </span>
                  ) : null}
                  {trimmedDob ? (
                    <span className="inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                      <span className="leading-none">{trimmedDob}</span>
                    </span>
                  ) : null}
                  {trimmedJoiningDate ? (
                    <span className="inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
                      <CalendarCheck className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                      <span className="leading-none">Joined {trimmedJoiningDate}</span>
                    </span>
                  ) : null}
                </div>
              ) : null}
              {trimmedLocation ? (
                <div className="mt-1 flex items-start justify-center gap-1.5 text-xs text-muted-foreground sm:justify-start sm:text-sm">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                  <span className="break-words whitespace-pre-line leading-relaxed">{trimmedLocation}</span>
                </div>
              ) : null}
              {trimmedDescription ? (
                <div className="mt-1 flex items-start justify-center gap-1.5 text-xs text-muted-foreground sm:justify-start sm:text-sm">
                  <ScrollText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                  <span className="break-words whitespace-pre-line leading-relaxed">{trimmedDescription}</span>
                </div>
              ) : null}
            </div>
          </div>

          {hasHighlights ? (
            <dl
              className={cn(
                "flex w-full flex-wrap justify-end gap-2 sm:w-auto",
                "lg:ml-auto lg:shrink-0 lg:border-l lg:border-border lg:pl-4",
              )}
            >
              {highlights!.map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "min-w-[6.5rem] rounded-md border border-border/80 bg-card px-2.5 py-1.5 sm:min-w-[7rem]",
                    item.wide && "w-full sm:w-auto sm:min-w-[14rem]",
                  )}
                >
                  <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd
                    className={cn(
                      "mt-0.5 break-words text-xs font-semibold text-foreground",
                      item.wide && "whitespace-pre-line font-normal leading-relaxed text-muted-foreground",
                    )}
                  >
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
      {children ? <div className="space-y-4 p-4 sm:p-5">{children}</div> : null}
    </div>
  );
}
