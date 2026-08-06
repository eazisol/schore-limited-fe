import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Lock, ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  dailyProgrammeService,
  type ApiDailyRow,
} from "@/lib/api/services/daily-programme";
import { notifyApiError, type ApiError } from "@/lib/api/axios";
import { Can, usePermission } from "@/components/Permission";
import { DAILY_ROUTE } from "@/lib/daily";

export const Route = createFileRoute("/daily")({
  head: () => ({ meta: [{ title: "Daily Programme | Schore" }] }),
  component: Daily,
});

const dailyQueryKey = ["daily-programme"] as const;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatLongDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Daily() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canModifyDaily = usePermission({ route: DAILY_ROUTE, action: "modify" });
  const [date, setDate] = useState(todayIso);
  const [showHO, setShowHO] = useState(false);
  const [confirmRoll, setConfirmRoll] = useState(false);

  function openTaskEdit(taskId: number) {
    navigate({
      to: "/tasks/$id",
      params: { id: String(taskId) },
      search: { mode: canModifyDaily ? "edit" : "view", from: "daily" },
    });
  }

  const query = useQuery({
    queryKey: [...dailyQueryKey, date, showHO],
    queryFn: async () => (await dailyProgrammeService.get(date, showHO)).data,
  });

  const rollMutation = useMutation({
    mutationFn: () => dailyProgrammeService.rollForward(date),
    onSuccess: (res) => {
      toast.success(res.message || "Rolled forward");
      setConfirmRoll(false);
      const next = res.data?.nextDate?.slice(0, 10);
      if (next) setDate(next);
      void qc.invalidateQueries({ queryKey: dailyQueryKey });
    },
    onError: (err) => notifyApiError(err, "Unable to roll forward"),
  });

  const data = query.data;
  const rows = data?.rows ?? [];

  const kpis = useMemo(
    () => [
      { label: "In Progress", value: data?.inProgressCount ?? 0, tone: "info" as const },
      { label: "On Hold", value: data?.onHoldCount ?? 0, tone: "warn" as const },
      { label: "On roll", value: rows.length, tone: "ok" as const },
      {
        label: "Operatives on Site",
        value: data?.operativesOnSiteCount ?? 0,
        tone: "ok" as const,
      },
    ],
    [data, rows.length],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Programme"
        subtitle="Auto-generated from the Master · carry-forward replaces copy-tab"
        actions={
          <>
            <div className="flex items-center gap-1 rounded-md border border-input bg-card">
              <button
                type="button"
                className="grid h-9 w-9 place-items-center hover:bg-accent/10"
                onClick={() => setDate((d) => shiftDate(d, -1))}
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 border-x border-input bg-transparent px-2 text-sm outline-none"
              />
              <button
                type="button"
                className="grid h-9 w-9 place-items-center hover:bg-accent/10"
                onClick={() => setDate((d) => shiftDate(d, 1))}
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <Can route={DAILY_ROUTE} action="modify">
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate({ to: "/tasks/new", search: { from: "daily" } })}
              >
                <Plus className="h-4 w-4" />
                New task
              </Button>
            </Can>
            <Can route={DAILY_ROUTE} action="modify">
              <Button
                size="sm"
                onClick={() => setConfirmRoll(true)}
                disabled={!data?.canRollForward || rollMutation.isPending}
              >
                {data?.canRollForward ? "Roll forward to next day" : "Tick at least one to roll forward"}
              </Button>
            </Can>
          </>
        }
      />

      {data?.lockActive ? (
        <div className="card-elevated flex items-start gap-3 border-warning/30 bg-warning/5 p-4">
          <Lock className="mt-0.5 h-4 w-4 text-warning-foreground" />
          <div className="text-sm">
            <div className="font-medium">Some tasks are locked</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {data.lockMessage ||
                "Tick at least one allocation on the previous working day for each locked task before adding today's work."}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((k) => (
          <Counter key={k.label} label={k.label} value={k.value} tone={k.tone} />
        ))}
      </div>

      <div className="card-elevated">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div>
            <h2 className="font-display font-semibold">Roll for {formatLongDate(date)}</h2>
            <p className="text-xs text-muted-foreground">
              {rows.length} properties on roll ·{" "}
              {rows.reduce((n, r) => n + (r.allocations?.length ?? 0), 0)} allocations
              <span className="ml-2 text-muted-foreground/80">· Double-click a row to edit</span>
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={showHO}
              onChange={(e) => setShowHO(e.target.checked)}
              className="rounded"
            />
            Show handed-over
          </label>
        </div>

        {query.isLoading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading daily programme…
          </div>
        ) : query.isError ? (
          <div className="space-y-2 p-8">
            <p className="text-sm text-destructive">
              {(query.error as unknown as ApiError)?.message || "Failed to load daily programme."}
            </p>
            <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">No.</th>
                  <th className="px-3 py-2.5 text-left font-medium">Property</th>
                  <th className="px-3 py-2.5 text-left font-medium">Contract</th>
                  <th className="px-3 py-2.5 text-left font-medium">Post Code</th>
                  <th className="px-3 py-2.5 text-left font-medium">Type</th>
                  <th className="px-3 py-2.5 text-left font-medium">Starting Date</th>
                  <th className="px-3 py-2.5 text-left font-medium">HO</th>
                  <th className="px-3 py-2.5 text-left font-medium">DAY</th>
                  <th className="px-3 py-2.5 text-left font-medium">Trade / Status</th>
                  <th className="px-3 py-2.5 text-left font-medium">Name</th>
                  <th className="px-3 py-2.5 text-left font-medium">Time</th>
                  <th
                    className="px-3 py-2.5 text-left font-medium"
                    title="Suggested codes for this working day — never auto-applied"
                  >
                    Next Day
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <DailyRow
                    key={row.taskId}
                    row={row}
                    onOpen={() => openTaskEdit(row.taskId)}
                  />
                ))}
              </tbody>
            </table>
            {rows.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                No properties on today&apos;s roll.
              </div>
            ) : null}
          </div>
        )}
      </div>

      {confirmRoll ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border bg-card p-6">
            <h3 className="font-display text-lg font-semibold">Roll forward to next day?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              In-progress properties carry forward. Handed-over properties drop off the default
              board. Next day&apos;s allocations stay empty for the SM to plan.
            </p>
            <div className="mt-4 space-y-1 rounded-md bg-secondary p-3 text-xs">
              <div>
                <span className="text-muted-foreground">In progress carrying forward: </span>
                <strong>{data?.inProgressCount ?? 0}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">On hold: </span>
                <strong>{data?.onHoldCount ?? 0}</strong>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmRoll(false)} disabled={rollMutation.isPending}>
                Cancel
              </Button>
              <Button onClick={() => rollMutation.mutate()} disabled={rollMutation.isPending}>
                {rollMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Confirm roll
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DailyRow({
  row,
  onOpen,
}: {
  row: ApiDailyRow;
  onOpen: () => void;
}) {
  const propertyLine = [row.propertyAddress || row.propertyName, row.accessNotes]
    .filter(Boolean)
    .join(" · ");

  return (
    <tr
      className={`cursor-pointer align-top hover:bg-muted/30 ${row.isLocked ? "bg-warning/5" : ""}`}
      onDoubleClick={onOpen}
      title={row.isLocked ? "Locked — tick previous day before adding today's items" : "Double-click to edit task"}
    >
      <td className="px-4 py-3 tabular-nums text-muted-foreground">{row.no}</td>
      <td className="px-3 py-3">
        <div className="flex items-start gap-1.5">
          {row.isLocked ? (
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-foreground" aria-label="Locked" />
          ) : null}
          <div>
            <div className="font-medium">{row.propertyName}</div>
            <div className="text-[11px] text-muted-foreground">{propertyLine}</div>
            {row.previousDayName ? (
              <div className="mt-1 text-[11px] text-muted-foreground">
                Yesterday: {row.previousDayName}
              </div>
            ) : null}
            {row.isLocked ? (
              <div className="mt-1 text-[11px] font-medium text-warning-foreground">
                Locked — no tick on previous day
              </div>
            ) : null}
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <code className="font-mono text-xs">{row.contract || "—"}</code>
      </td>
      <td className="px-3 py-3 text-muted-foreground">{row.postCode || "—"}</td>
      <td className="px-3 py-3 text-muted-foreground">{row.type || "—"}</td>
      <td className="px-3 py-3 tabular-nums">{row.startingDate?.slice(0, 10) || "—"}</td>
      <td className="px-3 py-3 tabular-nums">{row.handOverDate?.slice(0, 10) || "—"}</td>
      <td className="px-3 py-3 font-mono tabular-nums">
        {row.daysCount}
        {row.heldDaysCount > 0 ? (
          <span className="ml-1 text-[11px] text-muted-foreground">(-{row.heldDaysCount})</span>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">
          {row.tradeOrStatus || "—"}
        </code>
      </td>
      <td className="px-3 py-3">
        {!row.nameDisplay ? (
          <span className="italic text-muted-foreground">No allocation</span>
        ) : (
          <div>
            <div className="font-medium">{row.nameDisplay}</div>
            {row.notesDisplay ? (
              <div className="mt-0.5 text-[11px] text-muted-foreground">{row.notesDisplay}</div>
            ) : null}
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-muted-foreground">{row.timeDisplay || "—"}</td>
      <td
        className="px-3 py-3 text-muted-foreground"
        title={row.nextDay ? "Suggestion only — confirm work, then choose next step" : undefined}
      >
        {row.nextDay || "—"}
      </td>
    </tr>
  );
}

function Counter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "info" | "warn" | "ok" | "destructive";
}) {
  const toneCls =
    tone === "warn"
      ? "text-warning-foreground"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "info"
          ? "text-info"
          : "text-success";
  return (
    <div className="card-elevated p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
    </div>
  );
}
