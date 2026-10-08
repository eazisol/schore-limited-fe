import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import {
  ClientEntityForm,
  getHierarchySteps,
  HierarchyStepper,
  JobEntityForm,
  ProjectEntityForm,
  PropertyEntityForm,
  SiteEntityForm,
  type HierarchyStepId,
} from "@/components/hierarchy/HierarchyEntityForms";
import { usePermissions } from "@/contexts/PermissionContext";
import {
  propertyFormDefaults,
  type PropertyFormValues,
} from "@/lib/property-form";
import { emptyProjectFormValues, type ProjectFormValues } from "@/lib/project-form";
import { emptySiteFormValues, type SiteFormValues } from "@/lib/site-form";
import { taskFormDefaults, type TaskFormValues } from "@/lib/task-form";
import { fetchCustomerOptions } from "@/lib/user-dropdowns";
import { fetchSiteOptions } from "@/lib/site-dropdowns";
import { fetchProjectOptions } from "@/lib/project-dropdowns";
import { propertiesService } from "@/lib/api/services/properties";

type HierarchyChain = {
  customerId: string;
  customerLabel: string;
  siteId: string;
  siteLabel: string;
  projectId: string;
  projectLabel: string;
  propertyId: string;
  propertyLabel: string;
};

const emptyChain: HierarchyChain = {
  customerId: "",
  customerLabel: "",
  siteId: "",
  siteLabel: "",
  projectId: "",
  projectLabel: "",
  propertyId: "",
  propertyLabel: "",
};

const SM_PREFILL_STEPS = new Set<HierarchyStepId>([
  "site",
  "project",
  "property",
  "job",
]);

function stepHasRequiredParents(step: HierarchyStepId, chain: HierarchyChain): boolean {
  if (step === "site") return Boolean(chain.customerId);
  if (step === "project") return Boolean(chain.customerId && chain.siteId);
  if (step === "property") {
    return Boolean(chain.customerId && chain.siteId && chain.projectId);
  }
  if (step === "job") return Boolean(chain.propertyId);
  return true;
}

/** Fill missing hierarchy parents with the first scoped option in sequence. */
async function fillFirstScopedChain(
  current: HierarchyChain,
  step: HierarchyStepId,
): Promise<HierarchyChain> {
  let next = { ...current };

  if (!next.customerId) {
    const customers = await fetchCustomerOptions("");
    const first = customers[0];
    if (first?.value) {
      next = {
        ...next,
        customerId: first.value,
        customerLabel: first.label,
      };
    }
  }

  if (step === "site") return next;

  if (next.customerId && !next.siteId) {
    const sites = await fetchSiteOptions("", next.customerId);
    const first = sites[0];
    if (first?.value) {
      next = {
        ...next,
        siteId: first.value,
        siteLabel: first.label,
      };
    }
  }

  if (step === "project") return next;

  if (next.siteId && !next.projectId) {
    const projects = await fetchProjectOptions("", next.siteId, next.customerId);
    const first = projects[0];
    if (first?.value) {
      next = {
        ...next,
        projectId: first.value,
        projectLabel: first.label,
      };
    }
  }

  if (step === "property") return next;

  if (!next.propertyId) {
    const res = await propertiesService.list({
      page: 1,
      pageSize: 1,
      sortBy: "name",
      sortDir: "asc",
      ...(next.projectId ? { projectId: next.projectId } : {}),
      ...(next.siteId ? { siteId: next.siteId } : {}),
      ...(next.customerId ? { customerId: next.customerId } : {}),
    });
    const first = res.data?.items?.[0];
    if (first) {
      next = {
        ...next,
        propertyId: String(first.id),
        propertyLabel: first.propertyName?.trim() || `Property ${first.id}`,
        customerId: next.customerId || String(first.customerId ?? ""),
        customerLabel: next.customerLabel || first.customerName?.trim() || "",
        siteId: next.siteId || String(first.siteId ?? ""),
        siteLabel: next.siteLabel || first.siteName?.trim() || "",
        projectId: next.projectId || String(first.projectId ?? ""),
        projectLabel: next.projectLabel || first.projectName?.trim() || "",
      };
    }
  }

  return next;
}

export function HierarchyCreateWizard({
  onClose,
  customersQueryKey,
  freeNavigation = false,
}: {
  onClose: () => void;
  customersQueryKey: readonly string[];
  /**
   * Daily Programme: all steps clickable; parent fields unlocked; includes Job step.
   * Default false keeps Operational Management sequential 4-step locks.
   */
  freeNavigation?: boolean;
}) {
  const qc = useQueryClient();
  const { access } = usePermissions();
  const isSiteManager = Boolean(access?.isSiteManager);
  const autoSelectFirstChild = freeNavigation && isSiteManager;
  const includeJob = freeNavigation;
  const steps = useMemo(() => getHierarchySteps(includeJob), [includeJob]);
  const [step, setStep] = useState<HierarchyStepId>("client");
  const [chain, setChain] = useState<HierarchyChain>(emptyChain);
  const chainRef = useRef(chain);
  chainRef.current = chain;
  const [smPrefillReady, setSmPrefillReady] = useState(
    () => !freeNavigation || !isSiteManager,
  );
  const lockParents = !freeNavigation;

  const stepIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === step),
  );

  // Site Manager + free-nav: jumping to Site/Project/Property/Job preselects
  // the first scoped parents in sequence. Admin keeps parents empty.
  useEffect(() => {
    if (!freeNavigation || !isSiteManager) {
      setSmPrefillReady(true);
      return;
    }

    if (!SM_PREFILL_STEPS.has(step)) {
      setSmPrefillReady(true);
      return;
    }

    if (stepHasRequiredParents(step, chainRef.current)) {
      setSmPrefillReady(true);
      return;
    }

    let cancelled = false;
    setSmPrefillReady(false);

    void (async () => {
      const filled = await fillFirstScopedChain(chainRef.current, step);
      if (cancelled) return;
      setChain(filled);
      setSmPrefillReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [freeNavigation, isSiteManager, step]);

  function invalidateHierarchy() {
    qc.invalidateQueries({ queryKey: customersQueryKey });
    qc.invalidateQueries({ queryKey: ["users", "customers"] });
    qc.invalidateQueries({ queryKey: ["sites"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["properties"] });
    qc.invalidateQueries({ queryKey: ["lookups"] });
    qc.invalidateQueries({ queryKey: ["hierarchy"] });
    if (includeJob) {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["daily-programme"] });
    }
  }

  function handleClose() {
    invalidateHierarchy();
    onClose();
  }

  const titles = useMemo(
    () =>
      ({
        client: "Add client",
        site: "Add site",
        project: "Add project",
        property: "Add property",
        job: "Add job",
      }) as const,
    [],
  );

  const subtitle = includeJob
    ? "Client → Site → Project → Property → Job"
    : "Client → Site → Project → Property";

  const siteDefaults = useMemo<SiteFormValues>(
    () => ({
      ...emptySiteFormValues,
      customerId: chain.customerId,
    }),
    [chain.customerId],
  );

  const projectDefaults = useMemo<ProjectFormValues>(
    () => ({
      ...emptyProjectFormValues,
      customerId: chain.customerId,
      siteId: chain.siteId,
    }),
    [chain.customerId, chain.siteId],
  );

  const propertyDefaults = useMemo<PropertyFormValues>(
    () => ({
      ...propertyFormDefaults,
      customerId: chain.customerId,
      siteId: chain.siteId,
      projectId: chain.projectId,
    }),
    [chain.customerId, chain.siteId, chain.projectId],
  );

  const jobDefaults = useMemo<Partial<TaskFormValues>>(
    () => ({
      ...taskFormDefaults,
      propertyId: chain.propertyId,
    }),
    [chain.propertyId],
  );

  const smPrefilling =
    autoSelectFirstChild && SM_PREFILL_STEPS.has(step) && !smPrefillReady;

  return (
    <Modal
      open
      onClose={handleClose}
      title={titles[step]}
      subtitle={subtitle}
      size="lg"
      showCloseButton={false}
      headerActions={
        smPrefilling ? (
          <Loader2
            className="h-4 w-4 animate-spin text-primary"
            aria-label="Loading defaults"
          />
        ) : null
      }
    >
      <div className="space-y-3">
        <HierarchyStepper
          currentIndex={stepIndex}
          freeNavigation={freeNavigation}
          steps={steps}
          onStepClick={(_, sId) => setStep(sId)}
        />

        {step === "client" ? (
          <ClientEntityForm
            mode={chain.customerId ? "edit" : "create"}
            customerId={chain.customerId || undefined}
            submitLabel={chain.customerId ? "Save & continue" : "Create Client"}
            allowSaveAndClose
            onCancel={handleClose}
            onNext={freeNavigation ? () => setStep("site") : undefined}
            onSaved={(next, action) => {
              invalidateHierarchy();
              if (action === "close") {
                onClose();
                return;
              }
              setChain((prev) => ({ ...prev, ...next }));
              setStep("site");
            }}
          />
        ) : null}

        {step === "site" ? (
          <SiteEntityForm
            mode={chain.siteId ? "edit" : "create"}
            siteId={chain.siteId || undefined}
            defaultValues={siteDefaults}
            customerSelectedLabel={chain.customerLabel}
            lockCustomer={lockParents}
            allowSaveAndClose
            submitLabel={chain.siteId ? "Save & continue" : "Create Site"}
            onPrevious={() => setStep("client")}
            onNext={freeNavigation ? () => setStep("project") : undefined}
            onCancel={handleClose}
            onSaved={(next, action) => {
              invalidateHierarchy();
              if (action === "close") {
                onClose();
                return;
              }
              setChain((prev) => ({ ...prev, ...next }));
              setStep("project");
            }}
          />
        ) : null}

        {step === "project" ? (
          <ProjectEntityForm
            mode={chain.projectId ? "edit" : "create"}
            projectId={chain.projectId || undefined}
            defaultValues={projectDefaults}
            customerSelectedLabel={chain.customerLabel}
            siteSelectedLabel={chain.siteLabel}
            lockCustomer={lockParents}
            lockSite={lockParents}
            gateChildSelectOnParent={lockParents}
            autoSelectFirstChild={autoSelectFirstChild}
            allowSaveAndClose
            submitLabel={chain.projectId ? "Save & continue" : "Create Project"}
            onPrevious={() => setStep("site")}
            onNext={freeNavigation ? () => setStep("property") : undefined}
            onCancel={handleClose}
            onSaved={(next, action) => {
              invalidateHierarchy();
              if (action === "close") {
                onClose();
                return;
              }
              setChain((prev) => ({ ...prev, ...next }));
              setStep("property");
            }}
          />
        ) : null}

        {step === "property" ? (
          <PropertyEntityForm
            mode="create"
            defaultValues={propertyDefaults}
            customerSelectedLabel={chain.customerLabel}
            siteSelectedLabel={chain.siteLabel}
            projectSelectedLabel={chain.projectLabel}
            lockCustomer={lockParents}
            lockSite={lockParents}
            lockProject={lockParents}
            gateChildSelectOnParent={lockParents}
            autoSelectFirstChild={autoSelectFirstChild}
            allowSaveAndClose={includeJob}
            submitLabel="Create Property"
            onPrevious={() => setStep("project")}
            onNext={
              freeNavigation && includeJob ? () => setStep("job") : undefined
            }
            onCancel={handleClose}
            onSaved={(next, action) => {
              invalidateHierarchy();
              if (!includeJob || action === "close") {
                onClose();
                return;
              }
              setChain((prev) => ({ ...prev, ...next }));
              setStep("job");
            }}
          />
        ) : null}

        {includeJob && step === "job" ? (
          <JobEntityForm
            defaultValues={jobDefaults}
            propertySelectedLabel={chain.propertyLabel || null}
            submitLabel="Create Job"
            onPrevious={() => setStep("property")}
            onCancel={handleClose}
            onSaved={() => {
              invalidateHierarchy();
              onClose();
            }}
          />
        ) : null}
      </div>
    </Modal>
  );
}
