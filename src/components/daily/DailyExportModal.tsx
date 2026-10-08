import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Modal, Field, inputCls } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
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
import type { SearchableSelectOption } from "@/components/form";
import { cn } from "@/lib/utils";

type SelectState = {
  id: string;
  label: string | null;
};

const EMPTY_SELECT: SelectState = { id: "", label: null };

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
    <Field label={label}>
      <div className="flex items-center gap-1">
        <input
          type="date"
          className={cn(inputCls, "min-w-0 flex-1")}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        {value ? (
          <button
            type="button"
            disabled={disabled}
            aria-label={`Clear ${label.toLowerCase()}`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-input text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            onClick={() => onChange("")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </Field>
  );
}

export function DailyExportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
  /** Kept for call-site compatibility; dates start empty (all). */
  defaultDate?: string;
}) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [exportType, setExportType] = useState<DailyExportType>("client");
  const [client, setClient] = useState<SelectState>(EMPTY_SELECT);
  const [site, setSite] = useState<SelectState>(EMPTY_SELECT);
  const [project, setProject] = useState<SelectState>(EMPTY_SELECT);
  const [property, setProperty] = useState<SelectState>(EMPTY_SELECT);
  const [job, setJob] = useState<SelectState>(EMPTY_SELECT);
  const [operative, setOperative] = useState<SelectState>(EMPTY_SELECT);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFromDate("");
    setToDate("");
    setExportType("client");
    setClient(EMPTY_SELECT);
    setSite(EMPTY_SELECT);
    setProject(EMPTY_SELECT);
    setProperty(EMPTY_SELECT);
    setJob(EMPTY_SELECT);
    setOperative(EMPTY_SELECT);
  }, [open]);

  const fetchPropertyOptions = useCallback(
    async (search: string): Promise<SearchableSelectOption[]> => {
      const res = await propertiesService.list({
        page: 1,
        pageSize: DROPDOWN_FETCH_SIZE,
        search,
        ...(client.id ? { customerId: client.id } : {}),
        ...(site.id ? { siteId: site.id } : {}),
        ...(project.id ? { projectId: project.id } : {}),
      });
      return (res.data.items ?? []).map((p) => ({
        value: String(p.id),
        label: p.propertyName?.trim() || `Property ${p.id}`,
      }));
    },
    [client.id, site.id, project.id],
  );

  const fetchJobOptions = useCallback(
    async (search: string): Promise<SearchableSelectOption[]> => {
      const res = await tasksService.list({
        page: 1,
        pageSize: DROPDOWN_FETCH_SIZE,
        search,
        ...(client.id ? { customerId: client.id } : {}),
        ...(site.id ? { siteId: site.id } : {}),
        ...(project.id ? { projectId: project.id } : {}),
        ...(property.id ? { propertyId: property.id } : {}),
      });
      return (res.data.items ?? []).map((t) => ({
        value: String(t.id),
        label: `${t.taskNumber} · ${t.propertyName?.trim() || "Job"}`,
      }));
    },
    [client.id, site.id, project.id, property.id],
  );

  const fetchSites = useCallback(
    (search: string) => fetchSiteOptions(search, client.id || undefined),
    [client.id],
  );

  const fetchProjects = useCallback(
    (search: string) =>
      fetchProjectOptions(search, site.id || undefined, client.id || undefined),
    [site.id, client.id],
  );

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
        ...(client.id ? { customerId: client.id } : {}),
        ...(site.id ? { siteId: site.id } : {}),
        ...(project.id ? { projectId: project.id } : {}),
        ...(property.id ? { propertyId: property.id } : {}),
        ...(job.id ? { taskId: job.id } : {}),
        ...(operative.id ? { operativeId: operative.id } : {}),
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
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <DateField
            label="From date"
            value={fromDate}
            disabled={exporting}
            onChange={setFromDate}
          />
          <DateField label="To date" value={toDate} disabled={exporting} onChange={setToDate} />
        </div>

        <div>
          <span className="text-xs font-medium text-muted-foreground">Export type</span>
          <RadioGroup
            value={exportType}
            onValueChange={(v) => setExportType(v as DailyExportType)}
            disabled={exporting}
            className="mt-2 flex flex-wrap gap-3"
          >
            {(
              [
                { value: "client", label: "Client" },
                { value: "operative", label: "Operative" },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                htmlFor={`export-type-${opt.value}`}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm",
                  exportType === opt.value && "border-accent bg-accent/5",
                )}
              >
                <RadioGroupItem id={`export-type-${opt.value}`} value={opt.value} />
                <Label htmlFor={`export-type-${opt.value}`} className="cursor-pointer font-normal">
                  {opt.label}
                </Label>
              </label>
            ))}
          </RadioGroup>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Client">
            <SearchableSelect
              value={client.id}
              disabled={exporting}
              clearable
              onValueChange={(value) => {
                if (!value) {
                  setClient(EMPTY_SELECT);
                  setSite(EMPTY_SELECT);
                  setProject(EMPTY_SELECT);
                  setProperty(EMPTY_SELECT);
                  setJob(EMPTY_SELECT);
                }
              }}
              onSelect={(option) => {
                if (!option.value) {
                  setClient(EMPTY_SELECT);
                  setSite(EMPTY_SELECT);
                  setProject(EMPTY_SELECT);
                  setProperty(EMPTY_SELECT);
                  setJob(EMPTY_SELECT);
                  return;
                }
                setClient({ id: option.value, label: option.label });
                setSite(EMPTY_SELECT);
                setProject(EMPTY_SELECT);
                setProperty(EMPTY_SELECT);
                setJob(EMPTY_SELECT);
              }}
              placeholder="All clients"
              searchPlaceholder="Search clients…"
              aria-label="Filter by client"
              queryKey={["lookups", "customers", "daily-export"]}
              fetchOptions={fetchCustomerOptions}
              selectedLabel={client.label}
              emptyOption={{ value: "", label: "All clients" }}
            />
          </Field>

          <Field label="Site">
            <SearchableSelect
              value={site.id}
              disabled={exporting}
              clearable
              onValueChange={(value) => {
                if (!value) {
                  setSite(EMPTY_SELECT);
                  setProject(EMPTY_SELECT);
                  setProperty(EMPTY_SELECT);
                  setJob(EMPTY_SELECT);
                }
              }}
              onSelect={(option) => {
                if (!option.value) {
                  setSite(EMPTY_SELECT);
                  setProject(EMPTY_SELECT);
                  setProperty(EMPTY_SELECT);
                  setJob(EMPTY_SELECT);
                  return;
                }
                setSite({ id: option.value, label: option.label });
                setProject(EMPTY_SELECT);
                setProperty(EMPTY_SELECT);
                setJob(EMPTY_SELECT);
              }}
              placeholder="All sites"
              searchPlaceholder="Search sites…"
              aria-label="Filter by site"
              queryKey={["lookups", "sites", "daily-export", client.id]}
              fetchOptions={fetchSites}
              selectedLabel={site.label}
              emptyOption={{ value: "", label: "All sites" }}
            />
          </Field>

          <Field label="Project">
            <SearchableSelect
              value={project.id}
              disabled={exporting}
              clearable
              onValueChange={(value) => {
                if (!value) {
                  setProject(EMPTY_SELECT);
                  setProperty(EMPTY_SELECT);
                  setJob(EMPTY_SELECT);
                }
              }}
              onSelect={(option) => {
                if (!option.value) {
                  setProject(EMPTY_SELECT);
                  setProperty(EMPTY_SELECT);
                  setJob(EMPTY_SELECT);
                  return;
                }
                setProject({ id: option.value, label: option.label });
                setProperty(EMPTY_SELECT);
                setJob(EMPTY_SELECT);
              }}
              placeholder="All projects"
              searchPlaceholder="Search projects…"
              aria-label="Filter by project"
              queryKey={["lookups", "projects", "daily-export", client.id, site.id]}
              fetchOptions={fetchProjects}
              selectedLabel={project.label}
              emptyOption={{ value: "", label: "All projects" }}
            />
          </Field>

          <Field label="Property">
            <SearchableSelect
              value={property.id}
              disabled={exporting}
              clearable
              onValueChange={(value) => {
                if (!value) {
                  setProperty(EMPTY_SELECT);
                  setJob(EMPTY_SELECT);
                }
              }}
              onSelect={(option) => {
                if (!option.value) {
                  setProperty(EMPTY_SELECT);
                  setJob(EMPTY_SELECT);
                  return;
                }
                setProperty({ id: option.value, label: option.label });
                setJob(EMPTY_SELECT);
              }}
              placeholder="All properties"
              searchPlaceholder="Search properties…"
              aria-label="Filter by property"
              queryKey={[
                "lookups",
                "properties",
                "daily-export",
                client.id,
                site.id,
                project.id,
              ]}
              fetchOptions={fetchPropertyOptions}
              selectedLabel={property.label}
              emptyOption={{ value: "", label: "All properties" }}
            />
          </Field>

          <Field label="Job">
            <SearchableSelect
              value={job.id}
              disabled={exporting}
              clearable
              onValueChange={(value) => {
                if (!value) setJob(EMPTY_SELECT);
              }}
              onSelect={(option) => {
                if (!option.value) {
                  setJob(EMPTY_SELECT);
                  return;
                }
                setJob({ id: option.value, label: option.label });
              }}
              placeholder="All jobs"
              searchPlaceholder="Search jobs…"
              aria-label="Filter by job"
              queryKey={[
                "lookups",
                "tasks",
                "daily-export",
                client.id,
                site.id,
                project.id,
                property.id,
              ]}
              fetchOptions={fetchJobOptions}
              selectedLabel={job.label}
              emptyOption={{ value: "", label: "All jobs" }}
            />
          </Field>

          <Field label="Operative">
            <SearchableSelect
              value={operative.id}
              disabled={exporting}
              clearable
              onValueChange={(value) => {
                if (!value) setOperative(EMPTY_SELECT);
              }}
              onSelect={(option) => {
                if (!option.value) {
                  setOperative(EMPTY_SELECT);
                  return;
                }
                setOperative({ id: option.value, label: option.label });
              }}
              placeholder="All operatives"
              searchPlaceholder="Search operatives…"
              aria-label="Filter by operative"
              queryKey={["lookups", "operatives", "daily-export"]}
              fetchOptions={fetchOperativeOptions}
              selectedLabel={operative.label}
              emptyOption={{ value: "", label: "All operatives" }}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
