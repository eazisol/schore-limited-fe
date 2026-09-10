import { useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form, SubmitButton, SwitchField } from "@/components/form";
import { UserFormFields } from "@/components/users/UserFormFields";
import { SiteFormFields } from "@/components/sites/SiteFormFields";
import { ProjectFormFields } from "@/components/projects/ProjectFormFields";
import { PropertyFormFields } from "@/components/properties/PropertyFormFields";
import { useRateCapReasonGate } from "@/components/rates/useRateCapReasonGate";
import { usersService } from "@/lib/api/services/users";
import { sitesService } from "@/lib/api/services/sites";
import { projectsService } from "@/lib/api/services/projects";
import { propertiesService } from "@/lib/api/services/properties";
import { notifyApiError } from "@/lib/api/axios";
import { formatCustomerDisplayName } from "@/lib/customer-display";
import { cn } from "@/lib/utils";
import {
  createUserFormSchema,
  editUserFormSchema,
  emptyUserFormValues,
  toCreateUserPayload,
  toUpdateUserPayload,
  type UserFormValues,
} from "@/lib/user-form";
import { siteFormSchema, toSitePayload, type SiteFormValues } from "@/lib/site-form";
import { projectFormSchema, toProjectPayload, type ProjectFormValues } from "@/lib/project-form";
import {
  propertyFormSchema,
  toPropertyPayload,
  type PropertyFormValues,
} from "@/lib/property-form";

export const HIERARCHY_STEPS = [
  { id: "client", label: "Client" },
  { id: "site", label: "Site" },
  { id: "project", label: "Project" },
  { id: "property", label: "Property" },
] as const;

export type HierarchyStepId = (typeof HIERARCHY_STEPS)[number]["id"];

/** After a successful save in the create wizard. */
export type HierarchySaveAction = "continue" | "close";

export function HierarchyStepper({
  currentIndex,
  onStepClick,
}: {
  currentIndex: number;
  onStepClick?: (stepIndex: number, stepId: HierarchyStepId) => void;
}) {
  return (
    <ol className="flex items-center gap-1 sm:gap-2" aria-label="Setup steps">
      {HIERARCHY_STEPS.map((s, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        const canClick = done && Boolean(onStepClick);
        return (
          <li key={s.id} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            <button
              type="button"
              disabled={!canClick}
              onClick={() => canClick && onStepClick?.(index, s.id)}
              className={cn(
                "flex min-w-0 items-center gap-2 text-left",
                canClick ? "cursor-pointer transition-opacity hover:opacity-80" : "cursor-default",
              )}
            >
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                  done && "border-accent bg-accent text-accent-foreground",
                  active && "border-primary bg-primary text-primary-foreground",
                  !done && !active && "border-border bg-muted text-muted-foreground",
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "truncate text-xs font-medium sm:text-sm",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </button>
            {index < HIERARCHY_STEPS.length - 1 ? (
              <div
                className={cn(
                  "mx-1 hidden h-px flex-1 sm:block",
                  done ? "bg-accent" : "bg-border",
                )}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function HierarchyFormFooter({
  onCancel,
  onPrevious,
  submitLabel,
  pending,
  allowSaveAndClose = false,
  onIntentContinue,
  onIntentClose,
}: {
  onCancel: () => void;
  onPrevious?: () => void;
  submitLabel: string;
  pending: boolean;
  allowSaveAndClose?: boolean;
  onIntentContinue?: () => void;
  onIntentClose?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
      <div>
        {onPrevious ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPrevious}
            disabled={pending}
          >
            Previous
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        {allowSaveAndClose ? (
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={onIntentClose}
          >
            Save and close
          </Button>
        ) : null}
        <SubmitButton size="sm" loadingText="Saving…" onClick={onIntentContinue}>
          {submitLabel}
        </SubmitButton>
      </div>
    </div>
  );
}

export function ClientEntityForm({
  mode = "create",
  customerId,
  defaultValues = emptyUserFormValues,
  onCancel,
  onPrevious,
  onSaved,
  submitLabel,
  allowSaveAndClose = false,
}: {
  mode?: "create" | "edit";
  customerId?: string;
  defaultValues?: UserFormValues;
  onCancel: () => void;
  onPrevious?: () => void;
  onSaved: (
    next: { customerId: string; customerLabel: string },
    action: HierarchySaveAction,
  ) => void;
  submitLabel?: string;
  allowSaveAndClose?: boolean;
}) {
  const isEdit = mode === "edit";
  const resolvedSubmitLabel =
    submitLabel ?? (isEdit ? "Save changes" : "Create Client");
  const saveActionRef = useRef<HierarchySaveAction>("continue");
  const { runWithCapReason, modal: capReasonModal } = useRateCapReasonGate();
  const form = useForm<UserFormValues>({
    resolver: zodResolver(isEdit ? editUserFormSchema("customer") : createUserFormSchema("customer")),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const mutation = useMutation({
    mutationFn: (values: UserFormValues) =>
      isEdit && customerId
        ? usersService.update(customerId, toUpdateUserPayload(values, "customer"))
        : usersService.create(toCreateUserPayload(values, "customer")),
    onSuccess: (res) => {
      const saved = res.data;
      if (!saved) {
        notifyApiError(new Error("Client save returned empty data"), "Failed to save client");
        return;
      }
      toast.success(res.message || (isEdit ? "Client updated" : "Client created"));
      onSaved(
        {
          customerId: String(saved.id),
          customerLabel: formatCustomerDisplayName(saved),
        },
        isEdit ? "close" : saveActionRef.current,
      );
    },
  });

  return (
    <>
    <Form
      form={form}
      onSubmit={async (values) => {
        try {
          await runWithCapReason(values, (next) => mutation.mutateAsync(next));
        } catch (err) {
          notifyApiError(err, "Failed to save client");
        }
      }}
      className="space-y-2"
    >
      <UserFormFields
        embedded
        showActiveInHeader
        mode="customer"
        variant={isEdit ? "edit" : "create"}
        disabled={mutation.isPending}
        autoFocusFirstName={!isEdit}
      />
      <HierarchyFormFooter
        onCancel={onCancel}
        onPrevious={onPrevious}
        submitLabel={resolvedSubmitLabel}
        pending={mutation.isPending}
        allowSaveAndClose={allowSaveAndClose}
        onIntentContinue={() => {
          saveActionRef.current = "continue";
        }}
        onIntentClose={() => {
          saveActionRef.current = "close";
        }}
      />
    </Form>
    {capReasonModal}
    </>
  );
}

export function SiteEntityForm({
  mode,
  siteId,
  defaultValues,
  customerSelectedLabel,
  lockCustomer = false,
  submitLabel,
  allowSaveAndClose = false,
  onCancel,
  onPrevious,
  onSaved,
}: {
  mode: "create" | "edit";
  siteId?: string;
  defaultValues: SiteFormValues;
  customerSelectedLabel?: string | null;
  lockCustomer?: boolean;
  submitLabel?: string;
  allowSaveAndClose?: boolean;
  onCancel: () => void;
  onPrevious?: () => void;
  onSaved: (
    next: { siteId: string; siteLabel: string },
    action: HierarchySaveAction,
  ) => void;
}) {
  const resolvedSubmitLabel =
    submitLabel ?? (mode === "edit" ? "Save changes" : "Create Site");
  const saveActionRef = useRef<HierarchySaveAction>("continue");
  const { runWithCapReason, modal: capReasonModal } = useRateCapReasonGate();
  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const mutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toSitePayload>) =>
      mode === "edit" && siteId
        ? sitesService.update(siteId, payload)
        : sitesService.create(payload),
    onSuccess: (res) => {
      const saved = res.data;
      if (!saved) {
        notifyApiError(new Error("Site save returned empty data"), "Failed to save site");
        return;
      }
      toast.success(res.message || (mode === "edit" ? "Site updated" : "Site created"));
      onSaved(
        { siteId: String(saved.id), siteLabel: saved.name },
        mode === "edit" ? "close" : saveActionRef.current,
      );
    },
  });

  return (
    <>
    <Form
      form={form}
      onSubmit={async (values) => {
        try {
          await runWithCapReason(values, (next) => mutation.mutateAsync(toSitePayload(next)));
        } catch (err) {
          notifyApiError(err, "Failed to save site");
        }
      }}
      className="space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold">Details</h3>
        <SwitchField<SiteFormValues> name="isActive" label="Active" />
      </div>
      <SiteFormFields
        lockCustomer={lockCustomer}
        customerSelectedLabel={customerSelectedLabel}
        disabled={mutation.isPending}
      />
      <HierarchyFormFooter
        onCancel={onCancel}
        onPrevious={onPrevious}
        submitLabel={resolvedSubmitLabel}
        pending={mutation.isPending}
        allowSaveAndClose={allowSaveAndClose}
        onIntentContinue={() => {
          saveActionRef.current = "continue";
        }}
        onIntentClose={() => {
          saveActionRef.current = "close";
        }}
      />
    </Form>
    {capReasonModal}
    </>
  );
}

export function ProjectEntityForm({
  mode,
  projectId,
  defaultValues,
  customerSelectedLabel,
  siteSelectedLabel,
  assigneeSelectedLabels,
  lockCustomer = false,
  lockSite = false,
  submitLabel,
  allowSaveAndClose = false,
  onCancel,
  onPrevious,
  onSaved,
}: {
  mode: "create" | "edit";
  projectId?: string;
  defaultValues: ProjectFormValues;
  customerSelectedLabel?: string | null;
  siteSelectedLabel?: string | null;
  assigneeSelectedLabels?: Record<string, string>;
  lockCustomer?: boolean;
  lockSite?: boolean;
  submitLabel?: string;
  allowSaveAndClose?: boolean;
  onCancel: () => void;
  onPrevious?: () => void;
  onSaved: (
    next: { projectId: string; projectLabel: string },
    action: HierarchySaveAction,
  ) => void;
}) {
  const resolvedSubmitLabel =
    submitLabel ?? (mode === "edit" ? "Save changes" : "Create Project");
  const saveActionRef = useRef<HierarchySaveAction>("continue");
  const { runWithCapReason, modal: capReasonModal } = useRateCapReasonGate();
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const mutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toProjectPayload>) =>
      mode === "edit" && projectId
        ? projectsService.update(projectId, payload)
        : projectsService.create(payload),
    onSuccess: (res) => {
      const saved = res.data;
      if (!saved) {
        notifyApiError(new Error("Project save returned empty data"), "Failed to save project");
        return;
      }
      toast.success(res.message || (mode === "edit" ? "Project updated" : "Project created"));
      onSaved(
        { projectId: String(saved.id), projectLabel: saved.name },
        mode === "edit" ? "close" : saveActionRef.current,
      );
    },
  });

  return (
    <>
    <Form
      form={form}
      onSubmit={async (values) => {
        try {
          await runWithCapReason(values, (next) => mutation.mutateAsync(toProjectPayload(next)));
        } catch (err) {
          notifyApiError(err, "Failed to save project");
        }
      }}
      className="space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold">Details</h3>
        <SwitchField<ProjectFormValues> name="isActive" label="Active" />
      </div>
      <ProjectFormFields
        lockCustomer={lockCustomer}
        lockSite={lockSite}
        customerSelectedLabel={customerSelectedLabel}
        siteSelectedLabel={siteSelectedLabel}
        assigneeSelectedLabels={assigneeSelectedLabels}
        disabled={mutation.isPending}
      />
      <HierarchyFormFooter
        onCancel={onCancel}
        onPrevious={onPrevious}
        submitLabel={resolvedSubmitLabel}
        pending={mutation.isPending}
        allowSaveAndClose={allowSaveAndClose}
        onIntentContinue={() => {
          saveActionRef.current = "continue";
        }}
        onIntentClose={() => {
          saveActionRef.current = "close";
        }}
      />
    </Form>
    {capReasonModal}
    </>
  );
}

export function PropertyEntityForm({
  mode,
  propertyId,
  defaultValues,
  customerSelectedLabel,
  siteSelectedLabel,
  projectSelectedLabel,
  lockCustomer = false,
  lockSite = false,
  lockProject = false,
  submitLabel,
  onCancel,
  onPrevious,
  onSaved,
}: {
  mode: "create" | "edit";
  propertyId?: string;
  defaultValues: PropertyFormValues;
  customerSelectedLabel?: string | null;
  siteSelectedLabel?: string | null;
  projectSelectedLabel?: string | null;
  lockCustomer?: boolean;
  lockSite?: boolean;
  lockProject?: boolean;
  submitLabel?: string;
  onCancel: () => void;
  onPrevious?: () => void;
  onSaved: () => void;
}) {
  const resolvedSubmitLabel =
    submitLabel ?? (mode === "edit" ? "Save changes" : "Create Property");
  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const mutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toPropertyPayload>) =>
      mode === "edit" && propertyId
        ? propertiesService.update(propertyId, payload)
        : propertiesService.create(payload),
    onSuccess: (res) => {
      toast.success(res.message || (mode === "edit" ? "Property updated" : "Property created"));
      onSaved();
    },
    onError: (err) => notifyApiError(err, "Failed to save property"),
  });

  return (
    <Form
      form={form}
      onSubmit={async (values) => {
        await mutation.mutateAsync(toPropertyPayload(values));
      }}
      className="space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold">Details</h3>
        <SwitchField<PropertyFormValues> name="isActive" label="Active" />
      </div>
      <PropertyFormFields
        embedded
        lockCustomer={lockCustomer}
        lockSite={lockSite}
        lockProject={lockProject}
        customerSelectedLabel={customerSelectedLabel}
        siteSelectedLabel={siteSelectedLabel}
        projectSelectedLabel={projectSelectedLabel}
        autoFocusPropertyName={mode === "create"}
        disabled={mutation.isPending}
      />
      <HierarchyFormFooter
        onCancel={onCancel}
        onPrevious={onPrevious}
        submitLabel={resolvedSubmitLabel}
        pending={mutation.isPending}
      />
    </Form>
  );
}
