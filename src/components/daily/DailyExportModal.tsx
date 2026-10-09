import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { Modal, inputCls } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { SearchableMultiSelect, type SearchableSelectOption } from "@/components/form";
import { toast } from "sonner";
import { notifyApiError } from "@/lib/api/axios";
import {
  dailyProgrammeService,
  type DailyExportType,
} from "@/lib/api/services/daily-programme";
import { downloadDailyProgrammeExportXlsx } from "@/lib/daily-export-xlsx";
import { fetchCustomerOptions, fetchOperativeOptions } from "@/lib/user-dropdowns";
import { fetchSiteOptions } from "@/lib/site-dropdowns";
import { fetchProjectOptions } from "@/lib/project-dropdowns";
import { propertiesService } from "@/lib/api/services/properties";
import { tasksService } from "@/lib/api/services/tasks";
import { DROPDOWN_FETCH_SIZE } from "@/lib/dropdown-fetch";
import { cn } from "@/lib/utils";

type MultiFilter = {
  ids: string[];
  labels: Record<string, string>;
};

const EMPTY_MULTI: MultiFilter = { ids: [], labels: {} };

function CompactField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="block min-w-0">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function DateField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <CompactField label={label}>
      <div className="flex items-center gap-1">
        <input
          type="date"
          className={cn(inputCls, "h-8 min-w-0 flex-1 px-2 text-sm")}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        {value ? (
          <button
            type="button"
            disabled={disabled}
            aria-label={`Clear ${label.toLowerCase()}`}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-input text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            onClick={() => onChange("")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </CompactField>
  );
}

function setMulti(
  prev: MultiFilter,
  ids: string[],
  nextLabels?: Record<string, string>,
): MultiFilter {
  const labels: Record<string, string> = {};
  for (const id of ids) {
    labels[id] = nextLabels?.[id] ?? prev.labels[id] ?? id;
  }
  return { ids, labels };
}

export function DailyExportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
  defaultDate?: string;
}) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [exportType, setExportType] = useState<DailyExportType>("client");
  const [clients, setClients] = useState<MultiFilter>(EMPTY_MULTI);
  const [sites, setSites] = useState<MultiFilter>(EMPTY_MULTI);
  const [projects, setProjects] = useState<MultiFilter>(EMPTY_MULTI);
  const [properties, setProperties] = useState<MultiFilter>(EMPTY_MULTI);
  const [jobs, setJobs] = useState<MultiFilter>(EMPTY_MULTI);
  const [operatives, setOperatives] = useState<MultiFilter>(EMPTY_MULTI);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFromDate("");
    setToDate("");
    setExportType("client");
    setClients(EMPTY_MULTI);
    setSites(EMPTY_MULTI);
    setProjects(EMPTY_MULTI);
    setProperties(EMPTY_MULTI);
    setJobs(EMPTY_MULTI);
    setOperatives(EMPTY_MULTI);
  }, [open]);

  const singleClientId = clients.ids.length === 1 ? clients.ids[0] : undefined;
  const singleSiteId = sites.ids.length === 1 ? sites.ids[0] : undefined;
  const singleProjectId = projects.ids.length === 1 ? projects.ids[0] : undefined;
  const singlePropertyId = properties.ids.length === 1 ? properties.ids[0] : undefined;

  const fetchSites = useCallback(
    (search: string) => fetchSiteOptions(search, singleClientId),
    [singleClientId],
  );

  const fetchProjects = useCallback(
    (search: string) => fetchProjectOptions(search, singleSiteId, singleClientId),
    [singleSiteId, singleClientId],
  );

  const fetchPropertyOptions = useCallback(
    async (search: string): Promise<SearchableSelectOption[]> => {
      const res = await propertiesService.list({
        page: 1,
        pageSize: DROPDOWN_FETCH_SIZE,
        search,
        ...(singleClientId ? { customerId: singleClientId } : {}),
        ...(singleSiteId ? { siteId: singleSiteId } : {}),
        ...(singleProjectId ? { projectId: singleProjectId } : {}),
      });
      return (res.data.items ?? []).map((p) => ({
        value: String(p.id),
        label: p.propertyName?.trim() || `Property ${p.id}`,
      }));
    },
    [singleClientId, singleSiteId, singleProjectId],
  );

  const fetchJobOptions = useCallback(
    async (search: string): Promise<SearchableSelectOption[]> => {
      const res = await tasksService.list({
        page: 1,
        pageSize: DROPDOWN_FETCH_SIZE,
        search,
        ...(singleClientId ? { customerId: singleClientId } : {}),
        ...(singleSiteId ? { siteId: singleSiteId } : {}),
        ...(singleProjectId ? { projectId: singleProjectId } : {}),
        ...(singlePropertyId ? { propertyId: singlePropertyId } : {}),
      });
      return (res.data.items ?? []).map((t) => ({
        value: String(t.id),
        label: `${t.taskNumber} · ${t.propertyName?.trim() || "Job"}`,
      }));
    },
    [singleClientId, singleSiteId, singleProjectId, singlePropertyId],
  );

  const clientKey = useMemo(() => clients.ids.join(","), [clients.ids]);
  const siteKey = useMemo(() => sites.ids.join(","), [sites.ids]);
  const projectKey = useMemo(() => projects.ids.join(","), [projects.ids]);
  const propertyKey = useMemo(() => properties.ids.join(","), [properties.ids]);

  async function handleDownload() {
    if (exporting) return;
    if ((fromDate && !toDate) || (!fromDate && toDate)) {
      toast.warning("Set both From and To dates, or leave both empty for all");
      return;
    }
    if (fromDate && toDate && fromDate > toDate) {
      toast.warning("From date must be on or before to date");
      return;
    }

    setExporting(true);
    try {
      const res = await dailyProgrammeService.exportProgramme({
        exportType,
        ...(fromDate ? { fromDate } : {}),
        ...(toDate ? { toDate } : {}),
        ...(clients.ids.length ? { customerIds: clients.ids } : {}),
        ...(sites.ids.length ? { siteIds: sites.ids } : {}),
        ...(projects.ids.length ? { projectIds: projects.ids } : {}),
        ...(properties.ids.length ? { propertyIds: properties.ids } : {}),
        ...(jobs.ids.length ? { filterTaskIds: jobs.ids } : {}),
        ...(operatives.ids.length ? { operativeIds: operatives.ids } : {}),
      });
      const data = res.data;
      if (!data?.sheets?.length) {
        toast.warning("No data matched the selected filters");
        return;
      }
      await downloadDailyProgrammeExportXlsx(data);
      toast.success(
        `Exported ${data.sheets.length} day${data.sheets.length === 1 ? "" : "s"} (${exportType})`,
      );
      onClose();
    } catch (err) {
      notifyApiError(err, "Unable to export daily programme");
    } finally {
      setExporting(false);
    }
  }

  const multiTriggerClass = "h-auto min-h-8 py-1 text-sm";

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!exporting) onClose();
      }}
      title="Export daily programme"
      subtitle="Empty filters and dates include all. Select to narrow."
      size="md"
      showCloseButton={!exporting}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={exporting} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={exporting} onClick={() => void handleDownload()}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Download
          </Button>
        </div>
      }
    >
      <div className="space-y-2.5">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <DateField
            label="From date"
            value={fromDate}
            disabled={exporting}
            onChange={setFromDate}
          />
          <DateField label="To date" value={toDate} disabled={exporting} onChange={setToDate} />
          <CompactField label="Export type">
            <div
              role="radiogroup"
              aria-label="Export type"
              className="flex h-8 items-center gap-3"
            >
              {(
                [
                  { value: "client", label: "Client" },
                  { value: "operative", label: "Operative" },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className="inline-flex cursor-pointer items-center gap-1.5 text-sm"
                >
                  <input
                    type="radio"
                    name="daily-export-type"
                    value={opt.value}
                    checked={exportType === opt.value}
                    disabled={exporting}
                    onChange={() => setExportType(opt.value)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </CompactField>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <CompactField label="Client">
            <SearchableMultiSelect
              value={clients.ids}
              disabled={exporting}
              onValueChange={(ids) => {
                setClients((prev) => setMulti(prev, ids));
                setSites(EMPTY_MULTI);
                setProjects(EMPTY_MULTI);
                setProperties(EMPTY_MULTI);
                setJobs(EMPTY_MULTI);
              }}
              placeholder="All clients"
              searchPlaceholder="Search clients…"
              aria-label="Filter by client"
              queryKey={["lookups", "customers", "daily-export-multi"]}
              fetchOptions={fetchCustomerOptions}
              selectedLabels={clients.labels}
              triggerClassName={multiTriggerClass}
            />
          </CompactField>

          <CompactField label="Site">
            <SearchableMultiSelect
              value={sites.ids}
              disabled={exporting}
              onValueChange={(ids) => {
                setSites((prev) => setMulti(prev, ids));
                setProjects(EMPTY_MULTI);
                setProperties(EMPTY_MULTI);
                setJobs(EMPTY_MULTI);
              }}
              placeholder="All sites"
              searchPlaceholder="Search sites…"
              aria-label="Filter by site"
              queryKey={["lookups", "sites", "daily-export-multi", clientKey]}
              fetchOptions={fetchSites}
              selectedLabels={sites.labels}
              triggerClassName={multiTriggerClass}
            />
          </CompactField>

          <CompactField label="Project">
            <SearchableMultiSelect
              value={projects.ids}
              disabled={exporting}
              onValueChange={(ids) => {
                setProjects((prev) => setMulti(prev, ids));
                setProperties(EMPTY_MULTI);
                setJobs(EMPTY_MULTI);
              }}
              placeholder="All projects"
              searchPlaceholder="Search projects…"
              aria-label="Filter by project"
              queryKey={["lookups", "projects", "daily-export-multi", clientKey, siteKey]}
              fetchOptions={fetchProjects}
              selectedLabels={projects.labels}
              triggerClassName={multiTriggerClass}
            />
          </CompactField>

          <CompactField label="Property">
            <SearchableMultiSelect
              value={properties.ids}
              disabled={exporting}
              onValueChange={(ids) => {
                setProperties((prev) => setMulti(prev, ids));
                setJobs(EMPTY_MULTI);
              }}
              placeholder="All properties"
              searchPlaceholder="Search properties…"
              aria-label="Filter by property"
              queryKey={[
                "lookups",
                "properties",
                "daily-export-multi",
                clientKey,
                siteKey,
                projectKey,
              ]}
              fetchOptions={fetchPropertyOptions}
              selectedLabels={properties.labels}
              triggerClassName={multiTriggerClass}
            />
          </CompactField>

          <CompactField label="Job">
            <SearchableMultiSelect
              value={jobs.ids}
              disabled={exporting}
              onValueChange={(ids) => setJobs((prev) => setMulti(prev, ids))}
              placeholder="All jobs"
              searchPlaceholder="Search jobs…"
              aria-label="Filter by job"
              queryKey={[
                "lookups",
                "tasks",
                "daily-export-multi",
                clientKey,
                siteKey,
                projectKey,
                propertyKey,
              ]}
              fetchOptions={fetchJobOptions}
              selectedLabels={jobs.labels}
              triggerClassName={multiTriggerClass}
            />
          </CompactField>

          <CompactField label="Operative">
            <SearchableMultiSelect
              value={operatives.ids}
              disabled={exporting}
              onValueChange={(ids) => setOperatives((prev) => setMulti(prev, ids))}
              placeholder="All operatives"
              searchPlaceholder="Search operatives…"
              aria-label="Filter by operative"
              queryKey={["lookups", "operatives", "daily-export-multi"]}
              fetchOptions={fetchOperativeOptions}
              selectedLabels={operatives.labels}
              triggerClassName={multiTriggerClass}
            />
          </CompactField>
        </div>
      </div>
    </Modal>
  );
}
