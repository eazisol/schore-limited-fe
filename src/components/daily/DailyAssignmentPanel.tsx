import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/form";
import { AppTooltip } from "@/components/AppTooltip";
import { Modal } from "@/components/Modal";
import { RemoveItemReasonModal } from "@/components/tasks/RemoveItemReasonModal";
import {
  dailyProgrammeService,
  formatResolvedRate,
  type ApiDailyAssignedItemLine,
  type ApiDailyAssignedOperative,
  type ApiDailyProgramme,
  type ApiDailyRow,
} from "@/lib/api/services/daily-programme";
import { tasksService } from "@/lib/api/services/tasks";
import { usersService } from "@/lib/api/services/users";
import { dailyQueryKey } from "@/routes/daily";
import { usePermissions } from "@/contexts/PermissionContext";
import { CAPABILITY_CODES } from "@/lib/access";
import { tasksQueryKey } from "@/routes/tasks.index";
import {
  filterAssignedGroupsWithoutOpenApprovals,
  filterUnassignedAddOns,
  filterUnassignedPackages,
} from "@/lib/daily-packages";
import { resolveDailyItemAddBlockReason } from "@/lib/daily";
import { fetchOperativeOptions, fetchTimeSlotOptions } from "@/lib/task-dropdowns";
import {
  findCertificationWarningsForWorkDates,
  formatCertificationWarningSubtitle,
  type CertificationAssignWarning,
} from "@/lib/operative-certifications";
import { toYmd } from "@/lib/week-ending";
import { notifyApiError } from "@/lib/api/axios";
import { fmtGBP } from "@/lib/data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  RateCapReasonModal,
  type RateCapReasonContext,
} from "@/components/rates/RateCapReasonModal";
import { isRateCapReasonRequiredError } from "@/components/rates/useRateCapReasonGate";
import {
  TaskRateApprovalSections,
  type RateApprovalQueueLine,
} from "@/components/rates/TaskRateApprovalSections";
import {
  TaskRepeatApprovalSections,
  type RepeatApprovalQueueLine,
} from "@/components/rates/TaskRepeatApprovalSections";
import { getCatalogueCap } from "@/lib/rate-overrides";
import {
  isRateApprovalPending,
  isRateApprovalRejected,
} from "@/lib/rate-approval";
import {
  isRepeatApprovalPending,
  isRepeatApprovalRejected,
  isRepeatPackageKind,
} from "@/lib/repeat-approval";

type UnassignedKind = "package" | "addon";

type AssignPick = { id: string; label: string };

type PendingCertAssign =
  | {
    source: "catalog";
    kind: UnassignedKind;
    catalogId: string;
    operativeId: string;
    operativeLabel: string;
    warnings: CertificationAssignWarning[];
    rateCapReason?: string | null;
  }
  | {
    source: "existing";
    kind: UnassignedKind;
    catalogId: string;
    operativeId: string;
    operativeLabel: string;
    pickKey: string;
    quantity: number;
    timeSlotId: string | null;
    warnings: CertificationAssignWarning[];
    rateCapReason?: string | null;
  };

function mergeRowInCache(
  qc: ReturnType<typeof useQueryClient>,
  taskId: string | number,
  updatedRow: ApiDailyRow,
) {
  const id = String(taskId);
  qc.setQueriesData<ApiDailyProgramme>({ queryKey: dailyQueryKey }, (existing) => {
    if (!existing?.rows) return existing;
    return {
      ...existing,
      rows: existing.rows.map((entry) =>
        String(entry.taskId) === id ? { ...entry, ...updatedRow } : entry,
      ),
    };
  });
}

function invalidateAfterChange(qc: ReturnType<typeof useQueryClient>, taskId: string | number) {
  void qc.invalidateQueries({ queryKey: dailyQueryKey });
  void qc.invalidateQueries({ queryKey: ["daily-programme", "cost-budget"] });
  void qc.invalidateQueries({ queryKey: tasksQueryKey });
  void qc.invalidateQueries({ queryKey: ["tasks", String(taskId)] });
  void qc.invalidateQueries({ queryKey: ["tasks", String(taskId), "timeline"] });
}

function operativeInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function flattenAssignedLines(groups: ApiDailyAssignedOperative[]): ApiDailyAssignedItemLine[] {
  return groups.flatMap((op) =>
    [...op.packages.flatMap((pkg) => pkg.items), ...op.addOns].map((item) => ({
      ...item,
      operativeId: item.operativeId ?? op.operativeId,
      operativeName: item.operativeName || op.operativeName,
    })),
  );
}

function toRateApprovalQueueLine(item: ApiDailyAssignedItemLine): RateApprovalQueueLine {
  return {
    itemId: item.itemId,
    productName: item.productName,
    quantity: item.quantity,
    timeSlotName: item.timeSlotName,
    rate: item.rate,
    proposedRate: item.proposedRate ?? null,
    rateReviewReason: item.rateReviewReason ?? null,
    operativeName: item.operativeName ?? null,
  };
}

function toRepeatApprovalQueueLine(
  item: NonNullable<ApiDailyRow["repeatApprovals"]>[number],
): RepeatApprovalQueueLine {
  return {
    id: item.id,
    kind: item.kind,
    tradeGroupId: item.tradeGroupId,
    productId: item.productId,
    itemLabel: item.itemLabel,
    operativeId: item.operativeId,
    operativeName: item.operativeName,
    workDate: item.workDate,
    rate: item.rate,
    quantity: item.quantity,
    timeSlotId: item.timeSlotId,
    timeSlotName: item.timeSlotName,
    applyRatePermanently: item.applyRatePermanently,
    reason: item.reason,
    rateReason: item.rateReason,
    statusCode: item.statusCode,
    reviewReason: item.reviewReason,
  };
}

type DailyAssignmentPanelProps = {
  row: ApiDailyRow;
  date: string;
  disabled?: boolean;
  className?: string;
  /** Compact height for popover; taller for modal. */
  compact?: boolean;
  onRowUpdated?: (row: ApiDailyRow) => void;
};

/** Shared Daily Programmer assign / complete / remove panel (popover or modal). */
export function DailyAssignmentPanel({
  row,
  date,
  disabled = false,
  className,
  compact = false,
  onRowUpdated,
}: DailyAssignmentPanelProps) {
  const qc = useQueryClient();
  const { hasCapability } = usePermissions();
  const canSeeRates = hasCapability(CAPABILITY_CODES.seeRates);
  const canSelectRateItems = hasCapability(CAPABILITY_CODES.selectRateItems);
  const [unassignedSearch, setUnassignedSearch] = useState("");
  const [selectedKind, setSelectedKind] = useState<UnassignedKind | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignOperativeId, setAssignOperativeId] = useState("");
  const [assignOperativeLabel, setAssignOperativeLabel] = useState("");
  const [assignRate, setAssignRate] = useState("");
  const [assignQty, setAssignQty] = useState("1");
  const [assignTimeSlotId, setAssignTimeSlotId] = useState("");
  const [assignTimeSlotLabel, setAssignTimeSlotLabel] = useState("");
  const [existingAssignPick, setExistingAssignPick] = useState<Record<string, AssignPick>>({});
  const [certPrompt, setCertPrompt] = useState<PendingCertAssign | null>(null);
  const [certChecking, setCertChecking] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<{
    itemId: string;
    label: string;
  } | null>(null);
  const [capPrompt, setCapPrompt] = useState<RateCapReasonContext | null>(null);
  const [capReasonAccepted, setCapReasonAccepted] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [repeatPromptOpen, setRepeatPromptOpen] = useState(false);
  const [repeatReasonDraft, setRepeatReasonDraft] = useState("");
  const [resubmittingRepeatId, setResubmittingRepeatId] = useState<string | null>(null);
  const pendingRepeatAssignRef = useRef<{
    kind: UnassignedKind;
    catalogId: string;
    operativeId: string;
    rateCapReason?: string | null;
  } | null>(null);
  const rateTouchedRef = useRef(false);
  const rateCapReasonRef = useRef("");
  /** Continues assign after the user enters an over-cap reason (reason is passed in). */
  const pendingAfterCapRef = useRef<((reason: string) => void) | null>(null);
  /** Retry payload when the API returns ReasonRequired without a prior client-side prompt. */
  const pendingCapRetryRef = useRef<{
    kind: UnassignedKind;
    catalogId: string;
    operativeId: string;
  } | null>(null);

  const assignedByOperative = row.assignedByOperative ?? [];
  const unassignedPackages = row.unassignedPackages ?? [];
  const unassignedAddOns = row.unassignedAddOns ?? [];
  const todayYmd = toYmd(new Date());
  const isPast = date < todayYmd;
  /** Past-day view: new assigns go to today; lock is evaluated for today on the API/row. */
  const assignWorkDate = isPast ? todayYmd : date;
  const addBlockReason = resolveDailyItemAddBlockReason({
    canModify: !disabled,
    canSelectRateItems,
    isLocked: row.isLocked,
  });
  const cellDisabled = Boolean(addBlockReason);
  const completeDisabled = disabled || isPast;

  const allAssignedLines = useMemo(
    () => flattenAssignedLines(assignedByOperative),
    [assignedByOperative],
  );
  const pendingApprovalLines = useMemo(
    () =>
      allAssignedLines
        .filter((item) => isRateApprovalPending(item.rateApprovalStatus))
        .map(toRateApprovalQueueLine),
    [allAssignedLines],
  );
  const rejectedApprovalLines = useMemo(
    () =>
      allAssignedLines
        .filter((item) => isRateApprovalRejected(item.rateApprovalStatus))
        .map(toRateApprovalQueueLine),
    [allAssignedLines],
  );
  const pendingRepeatLines = useMemo(
    () =>
      (row.repeatApprovals ?? [])
        .filter((item) => isRepeatApprovalPending(item.statusCode))
        .map(toRepeatApprovalQueueLine),
    [row.repeatApprovals],
  );
  const rejectedRepeatLines = useMemo(
    () =>
      (row.repeatApprovals ?? [])
        .filter((item) => isRepeatApprovalRejected(item.statusCode))
        .map(toRepeatApprovalQueueLine),
    [row.repeatApprovals],
  );
  const assignedForTree = useMemo(
    () => filterAssignedGroupsWithoutOpenApprovals(assignedByOperative),
    [assignedByOperative],
  );
  const lineById = useMemo(() => {
    const map = new Map<string, ApiDailyAssignedItemLine>();
    for (const line of allAssignedLines) map.set(line.itemId, line);
    return map;
  }, [allAssignedLines]);

  const timeSlotsQuery = useQuery({
    queryKey: ["tasks", "time-slots"],
    queryFn: async () => (await tasksService.timeSlots()).data ?? [],
    staleTime: 60_000,
  });

  const filteredPackages = useMemo(
    () => filterUnassignedPackages(unassignedPackages, unassignedSearch),
    [unassignedPackages, unassignedSearch],
  );
  const filteredAddOns = useMemo(
    () => filterUnassignedAddOns(unassignedAddOns, unassignedSearch),
    [unassignedAddOns, unassignedSearch],
  );

  useEffect(() => {
    setSelectedKind(null);
    setSelectedId(null);
    setUnassignedSearch("");
    setAssignOperativeId("");
    setAssignOperativeLabel("");
    setAssignRate("");
    setAssignQty("1");
    setAssignTimeSlotId("");
    setAssignTimeSlotLabel("");
    setExistingAssignPick({});
    setCertPrompt(null);
    setCapPrompt(null);
    setCapReasonAccepted(false);
    pendingAfterCapRef.current = null;
    pendingCapRetryRef.current = null;
    rateTouchedRef.current = false;
    rateCapReasonRef.current = "";
  }, [date, row.taskId]);

  useEffect(() => {
    if (!cellDisabled) return;
    setSelectedKind(null);
    setSelectedId(null);
    setAssignOperativeId("");
    setAssignOperativeLabel("");
    setAssignRate("");
    setAssignQty("1");
    setIsRepeat(false);
    rateTouchedRef.current = false;
  }, [cellDisabled]);

  useEffect(() => {
    setCapReasonAccepted(false);
    rateCapReasonRef.current = "";
  }, [assignRate, selectedKind, selectedId]);

  const resolvedRateQuery = useQuery({
    queryKey: [
      "daily-programme",
      "resolve-rate",
      row.taskId,
      assignWorkDate,
      selectedKind,
      selectedId,
      assignOperativeId || null,
    ],
    enabled: canSeeRates && selectedKind != null && selectedId != null,
    queryFn: async () => {
      const res = await dailyProgrammeService.resolveRate(row.taskId, {
        date: assignWorkDate,
        productId: selectedKind === "addon" ? selectedId ?? undefined : undefined,
        tradeGroupId: selectedKind === "package" ? selectedId ?? undefined : undefined,
        operativeId: assignOperativeId || undefined,
      });
      return res.data;
    },
    staleTime: 15_000,
    retry: 1,
  });

  useEffect(() => {
    if (rateTouchedRef.current || resolvedRateQuery.data == null) return;
    setAssignRate(formatResolvedRate(resolvedRateQuery.data.rate));
  }, [resolvedRateQuery.data]);

  useEffect(() => {
    if (assignTimeSlotId || !timeSlotsQuery.data?.length) return;
    const first = timeSlotsQuery.data.find((t) => t.isActive !== false) ?? timeSlotsQuery.data[0];
    if (first) {
      setAssignTimeSlotId(String(first.id));
      setAssignTimeSlotLabel(first.name);
    }
  }, [assignTimeSlotId, timeSlotsQuery.data]);

  const applyUpdatedRow = (
    updatedRow: ApiDailyRow | null | undefined,
    message: string,
    options?: { assignedOnDate?: string },
  ) => {
    const assignedOn = options?.assignedOnDate ?? date;
    const assignedToOtherDay = assignedOn !== date;
    // Past-day assign returns today's row — do not merge into the past programme cache.
    if (updatedRow && !assignedToOtherDay) {
      mergeRowInCache(qc, row.taskId, updatedRow);
      onRowUpdated?.(updatedRow);
    }
    invalidateAfterChange(qc, row.taskId);
    setSelectedKind(null);
    setSelectedId(null);
    setAssignOperativeId("");
    setAssignOperativeLabel("");
    setAssignRate("");
    setAssignQty("1");
    rateTouchedRef.current = false;
    toast.success(
      assignedToOtherDay ? `${message} (for today)` : message,
    );
  };

  const assignPackageMutation = useMutation({
    mutationFn: (payload: {
      tradeGroupId: string;
      operativeId: string;
      rate: number;
      quantity: number;
      timeSlotId?: string | null;
      reason?: string | null;
      isRepeat?: boolean;
      repeatReason?: string | null;
    }) =>
      dailyProgrammeService.assignPackage(row.taskId, {
        date: assignWorkDate,
        tradeGroupId: payload.tradeGroupId,
        operativeId: payload.operativeId,
        rate: payload.rate,
        quantity: payload.quantity,
        timeSlotId: payload.timeSlotId,
        reason: payload.reason,
        isRepeat: payload.isRepeat,
        repeatReason: payload.repeatReason,
      }),
    onSuccess: (res) => {
      if (res.data?.repeatApprovalPending) {
        applyUpdatedRow(
          res.data.row,
          res.message || "Repeat task submitted for approval",
          { assignedOnDate: assignWorkDate },
        );
        setIsRepeat(false);
        setRepeatReasonDraft("");
        return;
      }
      applyUpdatedRow(
        res.data?.row,
        rateCapReasonRef.current.trim()
          ? "Package assigned — rate submitted for approval"
          : "Package assigned",
        { assignedOnDate: assignWorkDate },
      );
      setIsRepeat(false);
      setRepeatReasonDraft("");
    },
    onError: (err, variables) => {
      if (isRateCapReasonRequiredError(err) && !variables.reason?.trim()) {
        pendingCapRetryRef.current = {
          kind: "package",
          catalogId: variables.tradeGroupId,
          operativeId: variables.operativeId,
        };
        const productName =
          unassignedPackages.find((p) => p.tradeGroupId === variables.tradeGroupId)
            ?.tradeGroupName || "Package";
        const cap = Number(
          resolvedRateQuery.data?.cap ?? resolvedRateQuery.data?.rate ?? variables.rate,
        );
        setCapPrompt({
          productName,
          rate: variables.rate,
          cap: Number.isFinite(cap) ? cap : variables.rate,
        });
        return;
      }
      notifyApiError(err, "Unable to assign package");
    },
  });

  const assignAddOnMutation = useMutation({
    mutationFn: (payload: {
      productId: string;
      operativeId: string;
      rate: number;
      quantity: number;
      timeSlotId?: string | null;
      reason?: string | null;
      isRepeat?: boolean;
      repeatReason?: string | null;
    }) =>
      dailyProgrammeService.assignAddOn(row.taskId, {
        date: assignWorkDate,
        productId: payload.productId,
        operativeId: payload.operativeId,
        rate: payload.rate,
        quantity: payload.quantity,
        timeSlotId: payload.timeSlotId,
        reason: payload.reason,
        isRepeat: payload.isRepeat,
        repeatReason: payload.repeatReason,
      }),
    onSuccess: (res) => {
      if (res.data?.repeatApprovalPending) {
        applyUpdatedRow(
          res.data.row,
          res.message || "Repeat task submitted for approval",
          { assignedOnDate: assignWorkDate },
        );
        setIsRepeat(false);
        setRepeatReasonDraft("");
        return;
      }
      applyUpdatedRow(
        res.data?.row,
        rateCapReasonRef.current.trim()
          ? "Add-on assigned — rate submitted for approval"
          : "Add-on assigned",
        { assignedOnDate: assignWorkDate },
      );
      setIsRepeat(false);
      setRepeatReasonDraft("");
    },
    onError: (err, variables) => {
      if (isRateCapReasonRequiredError(err) && !variables.reason?.trim()) {
        pendingCapRetryRef.current = {
          kind: "addon",
          catalogId: variables.productId,
          operativeId: variables.operativeId,
        };
        const productName =
          unassignedAddOns.find((a) => a.productId === variables.productId)?.productName ||
          "Add-on";
        const cap = Number(
          resolvedRateQuery.data?.cap ?? resolvedRateQuery.data?.rate ?? variables.rate,
        );
        setCapPrompt({
          productName,
          rate: variables.rate,
          cap: Number.isFinite(cap) ? cap : variables.rate,
        });
        return;
      }
      notifyApiError(err, "Unable to assign add-on");
    },
  });

  const unassignPackageMutation = useMutation({
    mutationFn: (tradeGroupId: string) =>
      dailyProgrammeService.unassignPackage(row.taskId, {
        date,
        tradeGroupId,
      }),
    onSuccess: (res) => applyUpdatedRow(res.data, "Package unassigned"),
    onError: (err) => notifyApiError(err, "Unable to unassign package"),
  });

  const unassignAddOnMutation = useMutation({
    mutationFn: (productId: string) =>
      dailyProgrammeService.unassignAddOn(row.taskId, {
        date,
        productId,
      }),
    onSuccess: (res) => applyUpdatedRow(res.data, "Add-on unassigned"),
    onError: (err) => notifyApiError(err, "Unable to unassign add-on"),
  });

  const completeMutation = useMutation({
    mutationFn: (itemId: string) => dailyProgrammeService.completeItem(itemId, date),
    onSuccess: (res) => {
      if (res.data) {
        mergeRowInCache(qc, row.taskId, res.data);
        onRowUpdated?.(res.data);
      }
      invalidateAfterChange(qc, row.taskId);
      toast.success("Item completed");
    },
    onError: (err) => notifyApiError(err, "Unable to complete item"),
  });

  const removeMutation = useMutation({
    mutationFn: ({ itemId, reason }: { itemId: string; reason: string }) =>
      dailyProgrammeService.removeItem(itemId, date, reason),
    onSuccess: (res) => {
      if (res.data) {
        mergeRowInCache(qc, row.taskId, res.data);
        onRowUpdated?.(res.data);
      }
      invalidateAfterChange(qc, row.taskId);
      setPendingRemove(null);
      toast.success("Item removed");
    },
    onError: (err) => notifyApiError(err, "Unable to remove item"),
  });

  const resubmitRateMutation = useMutation({
    mutationFn: (payload: {
      itemId: string;
      operativeId: string;
      rate: number;
      quantity: number;
      timeSlotId?: string | null;
      reason?: string | null;
    }) =>
      dailyProgrammeService.updateItem(payload.itemId, {
        date,
        operativeId: payload.operativeId,
        rate: payload.rate,
        quantity: payload.quantity,
        timeSlotId: payload.timeSlotId,
        reason: payload.reason,
      }),
    onSuccess: (res, variables) => {
      if (res.data) {
        mergeRowInCache(qc, row.taskId, res.data);
        onRowUpdated?.(res.data);
      }
      invalidateAfterChange(qc, row.taskId);
      toast.success(
        variables.reason?.trim()
          ? "Rate resubmitted for approval"
          : "Rate updated",
      );
    },
    onError: (err) => notifyApiError(err, "Unable to update rate"),
  });

  const pending =
    assignPackageMutation.isPending ||
    assignAddOnMutation.isPending ||
    unassignPackageMutation.isPending ||
    unassignAddOnMutation.isPending ||
    completeMutation.isPending ||
    removeMutation.isPending ||
    resubmitRateMutation.isPending ||
    certChecking;

  async function checkCertificates(
    operativeId: string,
    workDates: string[],
  ): Promise<CertificationAssignWarning[] | null> {
    setCertChecking(true);
    try {
      const certifications =
        (await usersService.getAssignCertifications(operativeId)).data ?? [];
      return findCertificationWarningsForWorkDates(certifications, workDates);
    } catch (err) {
      notifyApiError(err, "Unable to check operative certificates");
      return null;
    } finally {
      setCertChecking(false);
    }
  }

  function runCatalogAssign(
    kind: UnassignedKind,
    catalogId: string,
    operativeId: string,
    reason?: string | null,
    repeatReason?: string | null,
  ) {
    const trimmedReason = (reason ?? rateCapReasonRef.current).trim() || null;
    if (trimmedReason) {
      rateCapReasonRef.current = trimmedReason;
    }
    const requiresRepeat =
      kind === "package"
        ? Boolean(
            unassignedPackages.find((p) => p.tradeGroupId === catalogId)?.requiresRepeat,
          )
        : Boolean(unassignedAddOns.find((a) => a.productId === catalogId)?.requiresRepeat);
    const base = {
      operativeId,
      rate: rateTouchedRef.current ? Number(assignRate) || 0 : 0,
      quantity: Number(assignQty) || 1,
      timeSlotId: assignTimeSlotId || null,
      reason: trimmedReason,
      isRepeat: requiresRepeat && isRepeat,
      repeatReason: requiresRepeat && isRepeat ? (repeatReason ?? "").trim() || null : null,
    };
    if (kind === "package") {
      assignPackageMutation.mutate({ tradeGroupId: catalogId, ...base });
    } else {
      assignAddOnMutation.mutate({ productId: catalogId, ...base });
    }
  }

  async function ensureAssignRateCap(then: (reason: string) => void) {
    if (!rateTouchedRef.current || !canSeeRates) {
      then(rateCapReasonRef.current.trim());
      return;
    }
    const rate = Number(assignRate);
    if (!Number.isFinite(rate) || rate < 0) {
      then(rateCapReasonRef.current.trim());
      return;
    }

    let cap =
      resolvedRateQuery.data?.cap != null
        ? Number(resolvedRateQuery.data.cap)
        : resolvedRateQuery.data?.rate != null
          ? Number(resolvedRateQuery.data.rate)
          : null;

    if (cap == null && selectedKind === "addon" && selectedId) {
      cap = await getCatalogueCap(selectedId);
    }

    if (cap != null && rate > cap && !capReasonAccepted) {
      const productName =
        selectedKind === "package"
          ? unassignedPackages.find((p) => p.tradeGroupId === selectedId)?.tradeGroupName ||
            "Package"
          : unassignedAddOns.find((a) => a.productId === selectedId)?.productName || "Add-on";
      pendingAfterCapRef.current = then;
      setCapPrompt({ productName, rate, cap });
      return;
    }

    then(rateCapReasonRef.current.trim());
  }

  async function handleResubmitRejected(line: RateApprovalQueueLine, nextRate: number) {
    const source = lineById.get(line.itemId);
    if (!source?.operativeId) {
      toast.warning("Assign an operative before updating the rate.");
      return;
    }

    const run = (reason: string) => {
      resubmitRateMutation.mutate({
        itemId: line.itemId,
        operativeId: source.operativeId!,
        rate: nextRate,
        quantity: source.quantity,
        timeSlotId: source.timeSlotId,
        reason: reason || null,
      });
    };

    if (!canSeeRates) {
      run("");
      return;
    }

    let cap: number | null = null;
    try {
      const resolved = await dailyProgrammeService.resolveRate(row.taskId, {
        date,
        productId: source.productId ?? undefined,
        operativeId: source.operativeId ?? undefined,
      });
      cap =
        resolved.data?.cap != null
          ? Number(resolved.data.cap)
          : resolved.data?.rate != null
            ? Number(resolved.data.rate)
            : null;
    } catch {
      if (source.productId) {
        cap = await getCatalogueCap(source.productId);
      }
    }

    if (cap != null && nextRate > cap) {
      pendingAfterCapRef.current = run;
      setCapPrompt({
        productName: line.productName,
        rate: nextRate,
        cap,
      });
      return;
    }

    run("");
  }

  function handleResubmitRejectedRepeat(line: RepeatApprovalQueueLine, reason: string) {
    setResubmittingRepeatId(line.id);
    const clear = () => setResubmittingRepeatId(null);

    if (isRepeatPackageKind(line.kind)) {
      if (!line.tradeGroupId) {
        toast.warning("Package is missing for this repeat request.");
        clear();
        return;
      }
      assignPackageMutation.mutate(
        {
          tradeGroupId: line.tradeGroupId,
          operativeId: line.operativeId,
          rate: line.rate,
          quantity: line.quantity,
          timeSlotId: line.timeSlotId,
          reason: line.rateReason ?? null,
          isRepeat: true,
          repeatReason: reason,
        },
        { onSettled: clear },
      );
      return;
    }

    if (!line.productId) {
      toast.warning("Add-on is missing for this repeat request.");
      clear();
      return;
    }
    assignAddOnMutation.mutate(
      {
        productId: line.productId,
        operativeId: line.operativeId,
        rate: line.rate,
        quantity: line.quantity,
        timeSlotId: line.timeSlotId,
        reason: line.rateReason ?? null,
        isRepeat: true,
        repeatReason: reason,
      },
      { onSettled: clear },
    );
  }

  function runExistingAssign(
    kind: UnassignedKind,
    catalogId: string,
    operativeId: string,
    quantity: number,
    timeSlotId: string | null,
    pickKey: string,
  ) {
    const clearPick = () =>
      setExistingAssignPick((prev) => {
        const next = { ...prev };
        delete next[pickKey];
        return next;
      });

    if (kind === "package") {
      assignPackageMutation.mutate(
        {
          tradeGroupId: catalogId,
          operativeId,
          rate: 0,
          quantity,
          timeSlotId,
        },
        { onSuccess: () => clearPick() },
      );
    } else {
      assignAddOnMutation.mutate(
        {
          productId: catalogId,
          operativeId,
          rate: 0,
          quantity,
          timeSlotId,
        },
        { onSuccess: () => clearPick() },
      );
    }
  }

  function clearAssignSelection() {
    setSelectedKind(null);
    setSelectedId(null);
    setAssignOperativeId("");
    setAssignOperativeLabel("");
    setAssignRate("");
    setAssignQty("1");
    setIsRepeat(false);
    rateTouchedRef.current = false;
  }

  function selectUnassigned(kind: UnassignedKind, id: string) {
    if (cellDisabled || pending) return;
    setSelectedKind(kind);
    setSelectedId(id);
    setAssignRate("");
    setAssignQty("1");
    setIsRepeat(false);
    rateTouchedRef.current = false;
  }

  async function handleAssign() {
    if (cellDisabled || pending) return;
    if (!selectedKind || selectedId == null) {
      toast.warning("Select a package or add-on first.");
      return;
    }
    if (!assignOperativeId) {
      toast.warning("Select an operative.");
      return;
    }
    if (!assignTimeSlotId) {
      toast.warning("Select a time slot.");
      return;
    }
    const qty = Number(assignQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.warning("Enter a valid quantity.");
      return;
    }

    const requiresRepeat =
      selectedKind === "package"
        ? Boolean(
            unassignedPackages.find((p) => p.tradeGroupId === selectedId)?.requiresRepeat,
          )
        : Boolean(
            unassignedAddOns.find((a) => a.productId === selectedId)?.requiresRepeat,
          );
    if (requiresRepeat && !isRepeat) {
      toast.warning("This item was already used on this job. Check Repeat Task to continue.");
      return;
    }

    await ensureAssignRateCap(async (reason) => {
      const warnings = await checkCertificates(assignOperativeId, [assignWorkDate]);
      if (warnings == null) return;
      if (warnings.length > 0) {
        if (reason) rateCapReasonRef.current = reason;
        setCertPrompt({
          source: "catalog",
          kind: selectedKind,
          catalogId: selectedId,
          operativeId: assignOperativeId,
          operativeLabel: assignOperativeLabel,
          warnings,
          rateCapReason: reason || null,
        });
        return;
      }

      if (requiresRepeat && isRepeat) {
        pendingRepeatAssignRef.current = {
          kind: selectedKind,
          catalogId: selectedId,
          operativeId: assignOperativeId,
          rateCapReason: reason || null,
        };
        setRepeatReasonDraft("");
        setRepeatPromptOpen(true);
        return;
      }

      runCatalogAssign(selectedKind, selectedId, assignOperativeId, reason);
    });
  }

  async function handleExistingAssign(
    kind: UnassignedKind,
    catalogId: string,
    pickKey: string,
    items: ApiDailyAssignedItemLine[],
    operativeId?: string,
    operativeLabel?: string,
  ) {
    if (cellDisabled || pending) return;
    const opId = operativeId || existingAssignPick[pickKey]?.id;
    const opLabel = operativeLabel || existingAssignPick[pickKey]?.label || "";
    if (!opId) {
      toast.warning("Select an operative.");
      return;
    }

    const first = items[0];
    const quantity = first?.quantity && first.quantity > 0 ? first.quantity : 1;
    const timeSlotId = first?.timeSlotId ?? (assignTimeSlotId || null);
    const workDates = items.map((i) => i.workDate || date);

    const warnings = await checkCertificates(opId, workDates);
    if (warnings == null) {
      setExistingAssignPick((prev) => {
        const next = { ...prev };
        delete next[pickKey];
        return next;
      });
      return;
    }
    if (warnings.length > 0) {
      setCertPrompt({
        source: "existing",
        kind,
        catalogId,
        operativeId: opId,
        operativeLabel: opLabel,
        pickKey,
        quantity,
        timeSlotId,
        warnings,
      });
      return;
    }

    runExistingAssign(kind, catalogId, opId, quantity, timeSlotId, pickKey);
  }

  function confirmCertAssign() {
    if (!certPrompt) return;
    const pendingAssign = certPrompt;
    setCertPrompt(null);
    const reason =
      (pendingAssign.rateCapReason ?? rateCapReasonRef.current).trim() || null;
    if (reason) rateCapReasonRef.current = reason;
    if (pendingAssign.source === "catalog") {
      const requiresRepeat =
        pendingAssign.kind === "package"
          ? Boolean(
              unassignedPackages.find((p) => p.tradeGroupId === pendingAssign.catalogId)
                ?.requiresRepeat,
            )
          : Boolean(
              unassignedAddOns.find((a) => a.productId === pendingAssign.catalogId)
                ?.requiresRepeat,
            );
      if (requiresRepeat && isRepeat) {
        pendingRepeatAssignRef.current = {
          kind: pendingAssign.kind,
          catalogId: pendingAssign.catalogId,
          operativeId: pendingAssign.operativeId,
          rateCapReason: reason,
        };
        setRepeatReasonDraft("");
        setRepeatPromptOpen(true);
        return;
      }
      runCatalogAssign(
        pendingAssign.kind,
        pendingAssign.catalogId,
        pendingAssign.operativeId,
        reason,
      );
      return;
    }
    runExistingAssign(
      pendingAssign.kind,
      pendingAssign.catalogId,
      pendingAssign.operativeId,
      pendingAssign.quantity,
      pendingAssign.timeSlotId,
      pendingAssign.pickKey,
    );
  }

  function cancelCertAssign() {
    if (certPrompt?.source === "existing") {
      const pickKey = certPrompt.pickKey;
      setExistingAssignPick((prev) => {
        const next = { ...prev };
        delete next[pickKey];
        return next;
      });
    }
    setCertPrompt(null);
  }

  const selectedLabel =
    selectedKind === "package"
      ? unassignedPackages.find((p) => p.tradeGroupId === selectedId)?.tradeGroupName
      : selectedKind === "addon"
        ? unassignedAddOns.find((a) => a.productId === selectedId)?.productName
        : null;

  const selectedRequiresRepeat =
    selectedKind === "package"
      ? Boolean(
          unassignedPackages.find((p) => p.tradeGroupId === selectedId)?.requiresRepeat,
        )
      : selectedKind === "addon"
        ? Boolean(unassignedAddOns.find((a) => a.productId === selectedId)?.requiresRepeat)
        : false;

  return (
    <>
      <div
        className={cn(
          "grid overflow-hidden rounded-lg border border-border bg-card",
          compact
            ? "max-h-[min(32rem,70vh)] sm:grid-cols-2"
            : "min-h-[22rem] sm:min-h-[26rem] sm:grid-cols-2",
          className,
        )}
      >
        <div className="flex min-h-0 flex-col border-b border-border sm:border-b-0 sm:border-r">
          <div className="shrink-0 border-b border-border px-3 py-2">
            {addBlockReason ? (
              <AppTooltip content={addBlockReason} asChild>
                <p className="mb-1.5 flex cursor-default items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0">{addBlockReason}</span>
                </p>
              </AppTooltip>
            ) : isPast ? (
              <p className="mb-1.5 text-[11px] text-muted-foreground">
                Viewing a past day — new assignments are added for today.
              </p>
            ) : null}
            <Input
              value={unassignedSearch}
              onChange={(e) => setUnassignedSearch(e.target.value)}
              placeholder="Search packages & add-ons…"
              className="mt-1.5 h-8 text-xs"
              disabled={cellDisabled}
              aria-label="Search unassigned items"
            />
          </div>
          {selectedLabel ? (
            <div className="shrink-0 space-y-2 border-b border-border bg-muted/30 px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-xs font-medium">
                  {selectedKind === "addon" ? "Add-on: " : "Package: "}
                  {selectedLabel}
                </p>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  onClick={clearAssignSelection}
                  disabled={cellDisabled || pending}
                  aria-label="Close assignment form"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Operative</label>
                <SearchableSelect
                  value={assignOperativeId}
                  onValueChange={setAssignOperativeId}
                  onSelect={(opt) => setAssignOperativeLabel(opt.label)}
                  placeholder="Select operative"
                  searchPlaceholder="Search operatives…"
                  queryKey={["lookups", "operatives", "daily-assign", row.taskId]}
                  fetchOptions={fetchOperativeOptions}
                  selectedLabel={assignOperativeLabel || null}
                  disabled={cellDisabled || pending}
                  triggerClassName="h-8 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Qty</label>
                  <Input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={assignQty}
                    onChange={(e) => setAssignQty(e.target.value)}
                    className="h-8 text-xs"
                    disabled={cellDisabled || pending}
                    aria-label="Quantity"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Time</label>
                  <SearchableSelect
                    value={assignTimeSlotId}
                    onValueChange={setAssignTimeSlotId}
                    onSelect={(opt) => setAssignTimeSlotLabel(opt.label)}
                    placeholder="Time"
                    searchPlaceholder="Search…"
                    queryKey={["lookups", "time-slots", "daily-assign"]}
                    fetchOptions={fetchTimeSlotOptions}
                    selectedLabel={assignTimeSlotLabel || null}
                    disabled={cellDisabled || pending}
                    triggerClassName="h-8 text-xs"
                  />
                </div>
              </div>
              {canSeeRates ? (
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Rate (£)</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={assignRate}
                    onChange={(e) => {
                      rateTouchedRef.current = true;
                      setAssignRate(e.target.value);
                    }}
                    placeholder={resolvedRateQuery.isFetching ? "…" : "Auto"}
                    className="h-8 text-xs"
                    disabled={cellDisabled || pending}
                    aria-label="Rate"
                  />
                </div>
              ) : null}
              {selectedRequiresRepeat ? (
                <label className="flex items-start gap-2 text-xs">
                  <Checkbox
                    checked={isRepeat}
                    onCheckedChange={(v) => setIsRepeat(v === true)}
                    disabled={cellDisabled || pending}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">Repeat task</span>
                    <span className="block text-muted-foreground">
                      Already used on this job — submit for approval to add again.
                    </span>
                  </span>
                </label>
              ) : null}
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={cellDisabled || pending}
                onClick={() => void handleAssign()}
              >
                {assignPackageMutation.isPending ||
                  assignAddOnMutation.isPending ||
                  certChecking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isRepeat && selectedRequiresRepeat ? (
                  "Submit for approval"
                ) : (
                  "Assign to roll"
                )}
              </Button>
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {filteredPackages.length > 0 ? (
              <div>
                <p className="px-3 py-1 text-[10px] font-medium uppercase text-muted-foreground">
                  Packages
                </p>
                <ul>
                  {filteredPackages.map((pkg) => {
                    const rowButton = (
                      <button
                        type="button"
                        className={cn(
                          "w-full px-3 py-2 text-left text-sm hover:bg-accent/10",
                          selectedKind === "package" &&
                            selectedId === pkg.tradeGroupId &&
                            "bg-accent/10",
                          cellDisabled && "cursor-not-allowed opacity-50",
                        )}
                        disabled={cellDisabled || pending}
                        onClick={() => selectUnassigned("package", pkg.tradeGroupId)}
                      >
                        <span className="block truncate font-medium">{pkg.tradeGroupName}</span>
                        {pkg.tradeName ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {pkg.tradeName}
                          </span>
                        ) : null}
                      </button>
                    );
                    return (
                      <li key={`pkg-${pkg.tradeGroupId}`}>
                        {addBlockReason ? (
                          <AppTooltip content={addBlockReason} asChild>
                            <span className="block w-full [&_button]:pointer-events-none">
                              {rowButton}
                            </span>
                          </AppTooltip>
                        ) : (
                          rowButton
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            {filteredAddOns.length > 0 ? (
              <div>
                <p className="px-3 py-1 text-[10px] font-medium uppercase text-muted-foreground">
                  Add-ons
                </p>
                <ul>
                  {filteredAddOns.map((addOn) => {
                    const rowButton = (
                      <button
                        type="button"
                        className={cn(
                          "w-full px-3 py-2 text-left text-sm hover:bg-accent/10",
                          selectedKind === "addon" &&
                            selectedId === addOn.productId &&
                            "bg-accent/10",
                          cellDisabled && "cursor-not-allowed opacity-50",
                        )}
                        disabled={cellDisabled || pending}
                        onClick={() => selectUnassigned("addon", addOn.productId)}
                      >
                        <span className="block truncate font-medium">{addOn.productName}</span>
                        <span className="block truncate text-xs text-muted-foreground">Add-on</span>
                      </button>
                    );
                    return (
                      <li key={`addon-${addOn.productId}`}>
                        {addBlockReason ? (
                          <AppTooltip content={addBlockReason} asChild>
                            <span className="block w-full [&_button]:pointer-events-none">
                              {rowButton}
                            </span>
                          </AppTooltip>
                        ) : (
                          rowButton
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            {filteredPackages.length === 0 && filteredAddOns.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">
                {unassignedPackages.length === 0 && unassignedAddOns.length === 0
                  ? "Nothing available to assign"
                  : "No matches"}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {canSeeRates ? (
            <TaskRateApprovalSections
              pending={pendingApprovalLines}
              rejected={rejectedApprovalLines}
              disabled={cellDisabled || pending}
              updatingItemId={
                resubmitRateMutation.isPending
                  ? resubmitRateMutation.variables?.itemId
                  : null
              }
              onResubmitRejected={(line, nextRate) => {
                void handleResubmitRejected(line, nextRate);
              }}
            />
          ) : null}
          <TaskRepeatApprovalSections
            pending={pendingRepeatLines}
            rejected={rejectedRepeatLines}
            disabled={cellDisabled || pending}
            updatingId={resubmittingRepeatId}
            onResubmitRejected={(line, reason) => {
              handleResubmitRejectedRepeat(line, reason);
            }}
          />
          <AssignedTree
            groups={assignedForTree}
            taskId={row.taskId}
            disabled={cellDisabled || pending}
            completeDisabled={completeDisabled || pending}
            assigning={
              assignPackageMutation.isPending || assignAddOnMutation.isPending || certChecking
            }
            assignPick={existingAssignPick}
            onAssignPickChange={(pickKey, pick) =>
              setExistingAssignPick((prev) => ({ ...prev, [pickKey]: pick }))
            }
            onAssignExisting={(kind, catalogId, pickKey, items, opId, opLabel) =>
              void handleExistingAssign(kind, catalogId, pickKey, items, opId, opLabel)
            }
            completingItemId={
              completeMutation.isPending ? completeMutation.variables : undefined
            }
            removingItemId={
              removeMutation.isPending ? removeMutation.variables?.itemId : undefined
            }
            unassigningPackageId={
              unassignPackageMutation.isPending ? unassignPackageMutation.variables : undefined
            }
            unassigningAddOnId={
              unassignAddOnMutation.isPending ? unassignAddOnMutation.variables : undefined
            }
            onComplete={(itemId) => completeMutation.mutate(itemId)}
            onRemove={(itemId, label) => setPendingRemove({ itemId, label })}
            onUnassignPackage={(tradeGroupId) => unassignPackageMutation.mutate(tradeGroupId)}
            onUnassignAddOn={(productId) => unassignAddOnMutation.mutate(productId)}
          />
        </div>
      </div>

      <RemoveItemReasonModal
        open={Boolean(pendingRemove)}
        pending={removeMutation.isPending}
        itemLabel={pendingRemove?.label}
        onCancel={() => {
          if (!removeMutation.isPending) setPendingRemove(null);
        }}
        onConfirm={(reason) => {
          if (!pendingRemove) return;
          removeMutation.mutate({ itemId: pendingRemove.itemId, reason });
        }}
      />

      <Modal
        open={repeatPromptOpen}
        onClose={() => {
          if (assignPackageMutation.isPending || assignAddOnMutation.isPending) return;
          setRepeatPromptOpen(false);
          pendingRepeatAssignRef.current = null;
          setRepeatReasonDraft("");
        }}
        title="Repeat task approval"
        subtitle="Explain why this item needs to be added again. Assignment happens only after approval."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={assignPackageMutation.isPending || assignAddOnMutation.isPending}
              onClick={() => {
                setRepeatPromptOpen(false);
                pendingRepeatAssignRef.current = null;
                setRepeatReasonDraft("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={
                assignPackageMutation.isPending ||
                assignAddOnMutation.isPending ||
                !repeatReasonDraft.trim()
              }
              onClick={() => {
                const pending = pendingRepeatAssignRef.current;
                if (!pending || !repeatReasonDraft.trim()) {
                  toast.warning("Enter a reason for the repeat task.");
                  return;
                }
                setRepeatPromptOpen(false);
                pendingRepeatAssignRef.current = null;
                runCatalogAssign(
                  pending.kind,
                  pending.catalogId,
                  pending.operativeId,
                  pending.rateCapReason,
                  repeatReasonDraft.trim(),
                );
                setRepeatReasonDraft("");
              }}
            >
              {assignPackageMutation.isPending || assignAddOnMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Submit for approval"
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="repeat-reason">
            Reason
          </label>
          <Textarea
            id="repeat-reason"
            value={repeatReasonDraft}
            onChange={(e) => setRepeatReasonDraft(e.target.value)}
            placeholder="Why does this task need to be repeated?"
            rows={3}
            maxLength={500}
          />
        </div>
      </Modal>

      <RateCapReasonModal
        open={Boolean(capPrompt)}
        context={capPrompt}
        onCancel={() => {
          setCapPrompt(null);
          pendingAfterCapRef.current = null;
          pendingCapRetryRef.current = null;
          rateCapReasonRef.current = "";
          setCapReasonAccepted(false);
        }}
        onConfirm={(reason) => {
          rateCapReasonRef.current = reason;
          setCapReasonAccepted(true);
          setCapPrompt(null);

          const retry = pendingCapRetryRef.current;
          pendingCapRetryRef.current = null;
          if (retry) {
            pendingAfterCapRef.current = null;
            const requiresRepeat =
              retry.kind === "package"
                ? Boolean(
                    unassignedPackages.find((p) => p.tradeGroupId === retry.catalogId)
                      ?.requiresRepeat,
                  )
                : Boolean(
                    unassignedAddOns.find((a) => a.productId === retry.catalogId)
                      ?.requiresRepeat,
                  );
            if (requiresRepeat && isRepeat) {
              pendingRepeatAssignRef.current = {
                kind: retry.kind,
                catalogId: retry.catalogId,
                operativeId: retry.operativeId,
                rateCapReason: reason,
              };
              setRepeatReasonDraft("");
              setRepeatPromptOpen(true);
              return;
            }
            runCatalogAssign(retry.kind, retry.catalogId, retry.operativeId, reason);
            return;
          }

          const next = pendingAfterCapRef.current;
          pendingAfterCapRef.current = null;
          next?.(reason);
        }}
      />

      {certPrompt ? (
        <Modal
          open
          onClose={cancelCertAssign}
          title="Certificate expiry warning"
          subtitle={formatCertificationWarningSubtitle(
            certPrompt.operativeLabel,
            certPrompt.warnings,
          )}
          size="sm"
          showCloseButton={false}
        >
          <div className="space-y-3">
            <ul className="space-y-1.5 text-sm">
              {certPrompt.warnings.map((w) => (
                <li
                  key={`${w.name}-${w.expiryDate}`}
                  className="flex items-baseline justify-between gap-3 border-b border-border/40 pb-1.5 last:border-0 last:pb-0"
                >
                  <span className="min-w-0 font-medium text-foreground">{w.name}</span>
                  <span
                    className={cn(
                      "shrink-0 tabular-nums text-xs font-medium",
                      w.isExpired
                        ? "text-destructive"
                        : "text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {w.statusLabel || (w.isExpired ? `Expired ${w.displayExpiry}` : `Expires ${w.displayExpiry}`)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={cancelCertAssign}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={confirmCertAssign}>
                Confirm assign
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function AssignedTree({
  groups,
  taskId,
  disabled,
  completeDisabled,
  assigning,
  assignPick,
  onAssignPickChange,
  onAssignExisting,
  completingItemId,
  removingItemId,
  unassigningPackageId,
  unassigningAddOnId,
  onComplete,
  onRemove,
  onUnassignPackage,
  onUnassignAddOn,
}: {
  groups: ApiDailyAssignedOperative[];
  taskId: string;
  disabled: boolean;
  completeDisabled: boolean;
  assigning: boolean;
  assignPick: Record<string, AssignPick>;
  onAssignPickChange: (pickKey: string, pick: AssignPick) => void;
  onAssignExisting: (
    kind: UnassignedKind,
    catalogId: string,
    pickKey: string,
    items: ApiDailyAssignedItemLine[],
    operativeId?: string,
    operativeLabel?: string,
  ) => void;
  completingItemId: string | undefined;
  removingItemId: string | undefined;
  unassigningPackageId: string | undefined;
  unassigningAddOnId: string | undefined;
  onComplete: (itemId: string) => void;
  onRemove: (itemId: string, label: string) => void;
  onUnassignPackage: (tradeGroupId: string) => void;
  onUnassignAddOn: (productId: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Assigned
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {groups.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">
            No assigned items — pick a package on the left
          </p>
        ) : (
          groups.map((operative) => {
            const isUnassignedGroup = !operative.operativeId;
            return (
              <div
                key={operative.operativeId ?? `unassigned-${operative.operativeName}`}
                className="border-b border-border/60 px-3 py-2 last:border-b-0"
              >
                {isUnassignedGroup ? (
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    Unassigned
                  </span>
                ) : (
                  <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">
                    <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-accent/25 text-[10px] font-bold">
                      {operativeInitials(operative.operativeName)}
                    </span>
                    <span className="truncate">{operative.operativeName}</span>
                  </span>
                )}
                {operative.packages.map((pkg) => {
                  const pickKey = `pkg-${pkg.tradeGroupId}`;
                  const pick = assignPick[pickKey] ?? { id: "", label: "" };
                  const isPkgCompleted =
                    pkg.items.length > 0 && pkg.items.every((i) => Boolean(i.isTicked));
                  return (
                    <div key={pkg.tradeGroupId} className="mt-2 pl-2">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          Package: {pkg.tradeGroupName}
                        </p>
                        {!isUnassignedGroup && !isPkgCompleted ? (
                          <AppTooltip content="Unassign package" asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-[11px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              disabled={disabled || unassigningPackageId === pkg.tradeGroupId}
                              onClick={() => onUnassignPackage(pkg.tradeGroupId)}
                            >
                              {unassigningPackageId === pkg.tradeGroupId ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <Undo2 className="mr-1 h-3 w-3" />
                                  Unassign
                                </>
                              )}
                            </Button>
                          </AppTooltip>
                        ) : null}
                      </div>
                      {isUnassignedGroup ? (
                        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                          <div className="w-[175px] shrink-0">
                            <SearchableSelect
                              value={pick.id}
                              onValueChange={(value) =>
                                onAssignPickChange(pickKey, {
                                  id: value,
                                  label: pick.label,
                                })
                              }
                              onSelect={(opt) => {
                                onAssignPickChange(pickKey, {
                                  id: opt.value,
                                  label: opt.label,
                                });
                                if (opt.value) {
                                  onAssignExisting(
                                    "package",
                                    pkg.tradeGroupId,
                                    pickKey,
                                    pkg.items,
                                    opt.value,
                                    opt.label,
                                  );
                                }
                              }}
                              placeholder="Select operative"
                              searchPlaceholder="Search operatives…"
                              queryKey={[
                                "lookups",
                                "operatives",
                                "daily-existing",
                                taskId,
                                pickKey,
                              ]}
                              fetchOptions={fetchOperativeOptions}
                              selectedLabel={pick.label || null}
                              disabled={disabled || assigning}
                              triggerClassName="h-8 text-xs"
                            />
                          </div>
                        </div>
                      ) : null}
                      <ul className="mt-1 space-y-1">
                        {pkg.items.map((item) => (
                          <AssignedItemLine
                            key={item.itemId}
                            item={item}
                            disabled={disabled}
                            completeDisabled={completeDisabled}
                            completing={completingItemId === item.itemId}
                            removing={removingItemId === item.itemId}
                            onComplete={() => onComplete(item.itemId)}
                            onRemove={() => onRemove(item.itemId, item.productName || "Item")}
                          />
                        ))}
                      </ul>
                    </div>
                  );
                })}
                {operative.addOns.length > 0 ? (
                  <div className="mt-2 pl-2">
                    <p className="text-xs font-medium text-muted-foreground">Add-ons</p>
                    <ul className="mt-1 space-y-1">
                      {operative.addOns.map((item) => {
                        const productId = item.productId ?? "";
                        const pickKey = `addon-${item.itemId}`;
                        const pick = assignPick[pickKey] ?? { id: "", label: "" };
                        return (
                          <li key={item.itemId} className="space-y-1">
                            {isUnassignedGroup && productId ? (
                              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                <div className="w-[175px] shrink-0">
                                  <SearchableSelect
                                    value={pick.id}
                                    onValueChange={(value) =>
                                      onAssignPickChange(pickKey, {
                                        id: value,
                                        label: pick.label,
                                      })
                                    }
                                    onSelect={(opt) => {
                                      onAssignPickChange(pickKey, {
                                        id: opt.value,
                                        label: opt.label,
                                      });
                                      if (opt.value) {
                                        onAssignExisting(
                                          "addon",
                                          productId,
                                          pickKey,
                                          [item],
                                          opt.value,
                                          opt.label,
                                        );
                                      }
                                    }}
                                    placeholder="Select operative"
                                    searchPlaceholder="Search operatives…"
                                    queryKey={[
                                      "lookups",
                                      "operatives",
                                      "daily-existing",
                                      taskId,
                                      pickKey,
                                    ]}
                                    fetchOptions={fetchOperativeOptions}
                                    selectedLabel={pick.label || null}
                                    disabled={disabled || assigning}
                                    triggerClassName="h-8 text-xs"
                                  />
                                </div>
                              </div>
                            ) : null}
                            <AssignedItemLine
                              item={item}
                              disabled={disabled}
                              completeDisabled={completeDisabled}
                              completing={completingItemId === item.itemId}
                              removing={removingItemId === item.itemId}
                              unassigning={Boolean(productId && unassigningAddOnId === productId)}
                              onComplete={() => onComplete(item.itemId)}
                              onRemove={() => onRemove(item.itemId, item.productName || "Item")}
                              onUnassign={
                                !isUnassignedGroup && productId
                                  ? () => onUnassignAddOn(productId)
                                  : undefined
                              }
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function AssignedItemLine({
  item,
  disabled,
  completeDisabled,
  completing,
  removing,
  unassigning = false,
  onComplete,
  onRemove,
  onUnassign,
}: {
  item: ApiDailyAssignedItemLine;
  disabled: boolean;
  completeDisabled: boolean;
  completing: boolean;
  removing: boolean;
  unassigning?: boolean;
  onComplete: () => void;
  onRemove: () => void;
  onUnassign?: () => void;
}) {
  const { hasCapability } = usePermissions();
  const canSeeRates = hasCapability(CAPABILITY_CODES.seeRates);
  const lineBusy = completing || removing || unassigning;
  const isCompleted = Boolean(item.isTicked);
  const meta = [
    `Qty ${item.quantity}`,
    item.timeSlotName ?? "—",
    canSeeRates ? fmtGBP(item.rate) : null,
    !item.isToday ? "carry-over" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex items-start gap-2 rounded-md bg-muted/20 px-2 py-1.5">
      <AppTooltip content="Mark completed" asChild>
        <span className="mt-0.5 inline-flex shrink-0">
          {completing ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Checkbox
              checked={isCompleted}
              disabled={completeDisabled || lineBusy || isCompleted}
              onCheckedChange={(checked) => {
                if (checked === true) onComplete();
              }}
              aria-label={`Complete ${item.productName}`}
            />
          )}
        </span>
      </AppTooltip>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{item.productName}</span>
          {item.isRepeat ? (
            <span className="shrink-0 rounded border border-red-200 bg-red-50 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-red-700">
              Repeat
            </span>
          ) : null}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">{meta}</p>
        {isCompleted ? (
          <p className="text-[10px] font-medium text-success">Completed</p>
        ) : null}
      </div>
      {!isCompleted ? (
        <div className="flex shrink-0 items-center gap-0.5">
          {onUnassign ? (
            <AppTooltip content="Unassign operative" asChild>
              <button
                type="button"
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
                disabled={disabled || lineBusy}
                onClick={onUnassign}
                aria-label={`Unassign ${item.productName}`}
              >
                {unassigning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Undo2 className="h-3.5 w-3.5" />
                )}
              </button>
            </AppTooltip>
          ) : null}
          <AppTooltip content="Remove from assignment" asChild>
            <button
              type="button"
              className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
              disabled={disabled || lineBusy}
              onClick={onRemove}
              aria-label={`Remove ${item.productName}`}
            >
              {removing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
            </button>
          </AppTooltip>
        </div>
      ) : null}
    </li>
  );
}
