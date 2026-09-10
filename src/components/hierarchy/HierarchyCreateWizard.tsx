import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import {
  ClientEntityForm,
  HIERARCHY_STEPS,
  HierarchyStepper,
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

type HierarchyChain = {
  customerId: string;
  customerLabel: string;
  siteId: string;
  siteLabel: string;
  projectId: string;
  projectLabel: string;
};

const emptyChain: HierarchyChain = {
  customerId: "",
  customerLabel: "",
  siteId: "",
  siteLabel: "",
  projectId: "",
  projectLabel: "",
};

export function HierarchyCreateWizard({
  onClose,
  customersQueryKey,
}: {
  onClose: () => void;
  customersQueryKey: readonly string[];
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<HierarchyStepId>("client");
  const [chain, setChain] = useState<HierarchyChain>(emptyChain);

  const stepIndex = HIERARCHY_STEPS.findIndex((s) => s.id === step);

  function invalidateHierarchy() {
    qc.invalidateQueries({ queryKey: customersQueryKey });
    qc.invalidateQueries({ queryKey: ["users", "customers"] });
    qc.invalidateQueries({ queryKey: ["sites"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["properties"] });
    qc.invalidateQueries({ queryKey: ["lookups"] });
    qc.invalidateQueries({ queryKey: ["hierarchy"] });
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
      }) as const,
    [],
  );

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

  return (
    <Modal
      open
      onClose={handleClose}
      title={titles[step]}
      subtitle="Client → Site → Project → Property"
      size="lg"
      showCloseButton={false}
    >
      <div className="space-y-3">
        <HierarchyStepper
          currentIndex={stepIndex}
          onStepClick={(_, sId) => setStep(sId)}
        />

        {step === "client" ? (
          <ClientEntityForm
            mode={chain.customerId ? "edit" : "create"}
            customerId={chain.customerId || undefined}
            submitLabel={chain.customerId ? "Save & continue" : "Create Client"}
            allowSaveAndClose
            onCancel={handleClose}
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
            lockCustomer
            allowSaveAndClose
            submitLabel={chain.siteId ? "Save & continue" : "Create Site"}
            onPrevious={() => setStep("client")}
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
            lockCustomer
            lockSite
            allowSaveAndClose
            submitLabel={chain.projectId ? "Save & continue" : "Create Project"}
            onPrevious={() => setStep("site")}
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
            lockCustomer
            lockSite
            lockProject
            submitLabel="Create Property"
            onPrevious={() => setStep("project")}
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
