import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import {
  ProjectEntityForm,
  PropertyEntityForm,
  SiteEntityForm,
} from "@/components/hierarchy/HierarchyEntityForms";
import { emptySiteFormValues, type SiteFormValues } from "@/lib/site-form";
import { emptyProjectFormValues, type ProjectFormValues } from "@/lib/project-form";
import { propertyFormDefaults, type PropertyFormValues } from "@/lib/property-form";

export type HierarchyCreateTarget =
  | {
      kind: "site";
      customerId: string;
      customerLabel?: string;
    }
  | {
      kind: "project";
      customerId: string;
      customerLabel?: string;
      siteId?: string;
      siteLabel?: string;
    }
  | {
      kind: "property";
      customerId: string;
      customerLabel?: string;
      siteId?: string;
      siteLabel?: string;
      projectId?: string;
      projectLabel?: string;
    };

export function HierarchyEntityCreateModal({
  target,
  onClose,
}: {
  target: HierarchyCreateTarget;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  function handleSaved() {
    qc.invalidateQueries({ queryKey: ["sites"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["properties"] });
    qc.invalidateQueries({ queryKey: ["lookups"] });
    qc.invalidateQueries({ queryKey: ["hierarchy"] });
    qc.invalidateQueries({ queryKey: ["customer-work"] });
    onClose();
  }

  const title =
    target.kind === "site"
      ? "Add site"
      : target.kind === "project"
        ? "Add project"
        : "Add property";

  return (
    <Modal open onClose={onClose} title={title} size="lg" showCloseButton={false}>
      {target.kind === "site" ? (
        <SiteCreateBody target={target} onCancel={onClose} onSaved={handleSaved} />
      ) : null}
      {target.kind === "project" ? (
        <ProjectCreateBody target={target} onCancel={onClose} onSaved={handleSaved} />
      ) : null}
      {target.kind === "property" ? (
        <PropertyCreateBody target={target} onCancel={onClose} onSaved={handleSaved} />
      ) : null}
    </Modal>
  );
}

function SiteCreateBody({
  target,
  onCancel,
  onSaved,
}: {
  target: Extract<HierarchyCreateTarget, { kind: "site" }>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const defaultValues = useMemo<SiteFormValues>(
    () => ({
      ...emptySiteFormValues,
      customerId: target.customerId,
    }),
    [target.customerId],
  );

  return (
    <SiteEntityForm
      mode="create"
      defaultValues={defaultValues}
      customerSelectedLabel={target.customerLabel}
      lockCustomer
      submitLabel="Create site"
      onCancel={onCancel}
      onSaved={onSaved}
    />
  );
}

function ProjectCreateBody({
  target,
  onCancel,
  onSaved,
}: {
  target: Extract<HierarchyCreateTarget, { kind: "project" }>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const lockSite = Boolean(target.siteId);
  const defaultValues = useMemo<ProjectFormValues>(
    () => ({
      ...emptyProjectFormValues,
      customerId: target.customerId,
      siteId: target.siteId ?? "",
    }),
    [target.customerId, target.siteId],
  );

  return (
    <ProjectEntityForm
      mode="create"
      defaultValues={defaultValues}
      customerSelectedLabel={target.customerLabel}
      siteSelectedLabel={target.siteLabel}
      lockCustomer
      lockSite={lockSite}
      submitLabel="Create project"
      onCancel={onCancel}
      onSaved={onSaved}
    />
  );
}

function PropertyCreateBody({
  target,
  onCancel,
  onSaved,
}: {
  target: Extract<HierarchyCreateTarget, { kind: "property" }>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const lockSite = Boolean(target.siteId);
  const lockProject = Boolean(target.projectId);
  const defaultValues = useMemo<PropertyFormValues>(
    () => ({
      ...propertyFormDefaults,
      customerId: target.customerId,
      siteId: target.siteId ?? "",
      projectId: target.projectId ?? "",
    }),
    [target.customerId, target.siteId, target.projectId],
  );

  return (
    <PropertyEntityForm
      mode="create"
      defaultValues={defaultValues}
      customerSelectedLabel={target.customerLabel}
      siteSelectedLabel={target.siteLabel}
      projectSelectedLabel={target.projectLabel}
      lockCustomer
      lockSite={lockSite}
      lockProject={lockProject}
      submitLabel="Create property"
      onCancel={onCancel}
      onSaved={onSaved}
    />
  );
}
