import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import {
  propertyFormDefaults,
  type PropertyFormValues,
} from "@/lib/property-form";
import { emptyProjectFormValues, type ProjectFormValues } from "@/lib/project-form";
import { emptySiteFormValues, type SiteFormValues } from "@/lib/site-form";
import { taskFormDefaults, type TaskFormValues } from "@/lib/task-form";

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
  const includeJob = freeNavigation;
  const steps = useMemo(() => getHierarchySteps(includeJob), [includeJob]);
  const [step, setStep] = useState<HierarchyStepId>("client");
  const [chain, setChain] = useState<HierarchyChain>(emptyChain);
  const lockParents = !freeNavigation;

  const stepIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === step),
  );

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

  return (
    <Modal
      open
      onClose={handleClose}
      title={titles[step]}
      subtitle={subtitle}
      size="lg"
      showCloseButton={false}
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
