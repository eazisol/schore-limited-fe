import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableSelectField } from "@/components/form";
import type { UserFormValues } from "@/lib/user-form";
import { fetchCustomerOptions } from "@/lib/user-dropdowns";
import { fetchSiteOptions } from "@/lib/site-dropdowns";
import { fetchProjectOptions } from "@/lib/project-dropdowns";

export function UserScopeAssignmentFields({ disabled = false }: { disabled?: boolean }) {
  const { control, setValue } = useFormContext<UserFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "assignments" });

  return (
    <div className="space-y-3">
      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No projects assigned. Site Managers, Project Managers and Contracts Managers only see
          clients, sites and projects listed here.
        </p>
      ) : null}

      {fields.map((field, index) => (
        <AssignmentRow
          key={field.id}
          index={index}
          disabled={disabled}
          onRemove={() => remove(index)}
          setValue={setValue}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() =>
          append({
            customerId: "",
            siteId: "",
            projectId: "",
            customerLabel: "",
            siteLabel: "",
            projectLabel: "",
          })
        }
      >
        <Plus className="h-4 w-4" />
        Add assignment
      </Button>
    </div>
  );
}

function AssignmentRow({
  index,
  disabled,
  onRemove,
  setValue,
}: {
  index: number;
  disabled: boolean;
  onRemove: () => void;
  setValue: ReturnType<typeof useFormContext<UserFormValues>>["setValue"];
}) {
  const customerId = useWatch<UserFormValues, `assignments.${number}.customerId`>({
    name: `assignments.${index}.customerId`,
  });
  const siteId = useWatch<UserFormValues, `assignments.${number}.siteId`>({
    name: `assignments.${index}.siteId`,
  });
  const customerLabel = useWatch<UserFormValues, `assignments.${number}.customerLabel`>({
    name: `assignments.${index}.customerLabel`,
  });
  const siteLabel = useWatch<UserFormValues, `assignments.${number}.siteLabel`>({
    name: `assignments.${index}.siteLabel`,
  });
  const projectLabel = useWatch<UserFormValues, `assignments.${number}.projectLabel`>({
    name: `assignments.${index}.projectLabel`,
  });

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Assignment {index + 1}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground"
          disabled={disabled}
          onClick={onRemove}
          aria-label={`Remove assignment ${index + 1}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <SearchableSelectField<UserFormValues>
          name={`assignments.${index}.customerId`}
          label="Client"
          placeholder="Any / select client"
          searchPlaceholder="Search clients…"
          disabled={disabled}
          queryKey={["lookups", "customers"]}
          selectedLabel={customerLabel || null}
          emptyOption={{ value: "", label: "Any client" }}
          fetchOptions={fetchCustomerOptions}
          onSelect={(option) => {
            setValue(`assignments.${index}.customerLabel`, option.label);
            setValue(`assignments.${index}.siteId`, "");
            setValue(`assignments.${index}.siteLabel`, "");
            setValue(`assignments.${index}.projectId`, "");
            setValue(`assignments.${index}.projectLabel`, "");
          }}
        />
        <SearchableSelectField<UserFormValues>
          name={`assignments.${index}.siteId`}
          label="Site"
          placeholder="Any / select site"
          searchPlaceholder="Search sites…"
          disabled={disabled}
          queryKey={["lookups", "sites", customerId || "all"]}
          selectedLabel={siteLabel || null}
          emptyOption={{ value: "", label: "Any site" }}
          fetchOptions={(search) => fetchSiteOptions(search, customerId || undefined)}
          onSelect={(option) => {
            setValue(`assignments.${index}.siteLabel`, option.label);
            setValue(`assignments.${index}.projectId`, "");
            setValue(`assignments.${index}.projectLabel`, "");
          }}
        />
        <SearchableSelectField<UserFormValues>
          name={`assignments.${index}.projectId`}
          label="Project"
          placeholder="Any / select project"
          searchPlaceholder="Search projects…"
          disabled={disabled}
          queryKey={["lookups", "projects", customerId || "all", siteId || "all"]}
          selectedLabel={projectLabel || null}
          emptyOption={{ value: "", label: "Any project" }}
          fetchOptions={(search) =>
            fetchProjectOptions(search, siteId || undefined, customerId || undefined)
          }
          onSelect={(option) => {
            setValue(`assignments.${index}.projectLabel`, option.label);
          }}
        />
      </div>
    </div>
  );
}
