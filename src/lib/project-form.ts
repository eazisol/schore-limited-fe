import { z } from "zod";
import type { ApiProject, ProjectPayload } from "@/lib/api/services/projects";
import {
  CODE_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  codeSchema,
  descriptionSchema,
  nameSchema,
} from "@/lib/field-validation";
import {
  rateOverrideRowSchema,
  rateOverridesToFormValues,
  refineRateOverrides,
  toRateOverridePayload,
} from "@/lib/rate-overrides";
import { parseAssignableStaffLabel } from "@/lib/project-assignee";

export const projectFormSchema = z
  .object({
    name: nameSchema("Name", NAME_MAX_LENGTH),
    code: codeSchema("Code", CODE_MAX_LENGTH),
    description: descriptionSchema(),
    customerId: z.string(),
    siteId: z.string().trim().min(1, "Site is required"),
    assignedUserIds: z.array(z.string()),
    isActive: z.boolean(),
    rateOverrides: z.array(rateOverrideRowSchema),
    rateChangeReason: z.string(),
  })
  .superRefine((values, ctx) => {
    if (!values.customerId.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["customerId"],
        message: "Client is required",
      });
    }
    refineRateOverrides(values.rateOverrides, ctx);
  });

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const emptyProjectFormValues: ProjectFormValues = {
  name: "",
  code: "",
  description: "",
  customerId: "",
  siteId: "",
  assignedUserIds: [],
  isActive: true,
  rateOverrides: [],
  rateChangeReason: "",
};

export function toProjectPayload(values: ProjectFormValues): ProjectPayload {
  return {
    name: values.name.trim(),
    code: values.code.trim().toUpperCase(),
    description: values.description.trim() || null,
    customerId: values.customerId,
    siteId: values.siteId,
    assignedUserIds: values.assignedUserIds.filter(Boolean),
    rateOverrides: toRateOverridePayload(values.rateOverrides),
    rateChangeReason: values.rateChangeReason.trim() || null,
    isActive: values.isActive,
  };
}

export function projectToFormValues(
  row: Pick<ApiProject, "name" | "code" | "description" | "customerId" | "siteId" | "isActive"> & {
    assignedUsers?: ApiProject["assignedUsers"];
    assignedUserIds?: string[];
    rateOverrides?: ApiProject["rateOverrides"];
  },
): ProjectFormValues {
  return {
    name: row.name,
    code: row.code,
    description: row.description ?? "",
    customerId: String(row.customerId),
    siteId: String(row.siteId),
    assignedUserIds:
      row.assignedUserIds?.map(String) ??
      (row.assignedUsers ?? []).map((user) => String(user.id)),
    isActive: row.isActive,
    rateOverrides: rateOverridesToFormValues(row.rateOverrides),
    rateChangeReason: "",
  };
}

export function projectAssigneeLabels(
  assignedUsers: ApiProject["assignedUsers"] | undefined,
): Record<string, string> {
  return Object.fromEntries(
    (assignedUsers ?? []).map((user) => {
      const parsed = parseAssignableStaffLabel(user.name ?? "");
      return [String(user.id), parsed.label || user.name];
    }),
  );
}
