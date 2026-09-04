import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import {
  ProjectEntityForm,
  PropertyEntityForm,
  SiteEntityForm,
} from "@/components/hierarchy/HierarchyEntityForms";
import { sitesService } from "@/lib/api/services/sites";
import { projectsService } from "@/lib/api/services/projects";
import { propertiesService } from "@/lib/api/services/properties";
import { siteToFormValues } from "@/lib/site-form";
import { projectToFormValues } from "@/lib/project-form";
import { propertyToFormValues } from "@/lib/property-form";

export type HierarchyEditTarget =
  | { kind: "site"; id: string }
  | { kind: "project"; id: string }
  | { kind: "property"; id: string };

export function HierarchyEntityEditModal({
  target,
  onClose,
}: {
  target: HierarchyEditTarget;
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
      ? "Edit site"
      : target.kind === "project"
        ? "Edit project"
        : "Edit property";

  return (
    <Modal open onClose={onClose} title={title} size="xl" showCloseButton={false}>
      {target.kind === "site" ? (
        <SiteEditBody id={target.id} onCancel={onClose} onSaved={handleSaved} />
      ) : null}
      {target.kind === "project" ? (
        <ProjectEditBody id={target.id} onCancel={onClose} onSaved={handleSaved} />
      ) : null}
      {target.kind === "property" ? (
        <PropertyEditBody id={target.id} onCancel={onClose} onSaved={handleSaved} />
      ) : null}
    </Modal>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{message}</p>;
}

function SiteEditBody({
  id,
  onCancel,
  onSaved,
}: {
  id: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const query = useQuery({
    queryKey: ["sites", id],
    queryFn: async () => (await sitesService.get(id)).data,
  });

  const defaults = useMemo(
    () => (query.data ? siteToFormValues(query.data) : null),
    [query.data],
  );

  if (query.isLoading) return <LoadingState label="Loading site…" />;
  if (query.isError || !query.data || !defaults) {
    return <ErrorState message="Unable to load site." />;
  }

  return (
    <SiteEntityForm
      mode="edit"
      siteId={id}
      defaultValues={defaults}
      customerSelectedLabel={query.data.customerName}
      submitLabel="Save changes"
      onCancel={onCancel}
      onSaved={onSaved}
    />
  );
}

function ProjectEditBody({
  id,
  onCancel,
  onSaved,
}: {
  id: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const query = useQuery({
    queryKey: ["projects", id],
    queryFn: async () => (await projectsService.get(id)).data,
  });

  const defaults = useMemo(
    () => (query.data ? projectToFormValues(query.data) : null),
    [query.data],
  );

  if (query.isLoading) return <LoadingState label="Loading project…" />;
  if (query.isError || !query.data || !defaults) {
    return <ErrorState message="Unable to load project." />;
  }

  return (
    <ProjectEntityForm
      mode="edit"
      projectId={id}
      defaultValues={defaults}
      customerSelectedLabel={query.data.customerName}
      siteSelectedLabel={query.data.siteName}
      submitLabel="Save changes"
      onCancel={onCancel}
      onSaved={onSaved}
    />
  );
}

function PropertyEditBody({
  id,
  onCancel,
  onSaved,
}: {
  id: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const query = useQuery({
    queryKey: ["properties", id],
    queryFn: async () => (await propertiesService.get(id)).data,
  });

  const defaults = useMemo(
    () => (query.data ? propertyToFormValues(query.data) : null),
    [query.data],
  );

  if (query.isLoading) return <LoadingState label="Loading property…" />;
  if (query.isError || !query.data || !defaults) {
    return <ErrorState message="Unable to load property." />;
  }

  return (
    <PropertyEntityForm
      mode="edit"
      propertyId={id}
      defaultValues={defaults}
      customerSelectedLabel={query.data.customerName}
      siteSelectedLabel={query.data.siteName}
      projectSelectedLabel={query.data.projectName}
      submitLabel="Save changes"
      onCancel={onCancel}
      onSaved={onSaved}
    />
  );
}
