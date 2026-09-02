import { z } from "zod";
import type { ProjectPayload } from "@/lib/api/services/projects";
import {
  CODE_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  codeSchema,
  descriptionSchema,
  nameSchema,
} from "@/lib/field-validation";

export const projectFormSchema = z
  .object({
    name: nameSchema("Name", NAME_MAX_LENGTH),
    code: codeSchema("Code", CODE_MAX_LENGTH),
    description: descriptionSchema(),
    customerId: z.string(),
    siteId: z.string().trim().min(1, "Site is required"),
    isActive: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (!values.customerId.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["customerId"],
        message: "Client is required",
      });
    }
  });

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export function toProjectPayload(values: ProjectFormValues): ProjectPayload {
  return {
    name: values.name.trim(),
    code: values.code.trim().toUpperCase(),
    description: values.description.trim() || null,
    customerId: values.customerId,
    siteId: values.siteId,
    isActive: values.isActive,
  };
}

export function projectToFormValues(row: {
  name: string;
  code: string;
  description?: string | null;
  customerId: string;
  siteId: string;
  isActive: boolean;
}): ProjectFormValues {
  return {
    name: row.name,
    code: row.code,
    description: row.description ?? "",
    customerId: String(row.customerId),
    siteId: String(row.siteId),
    isActive: row.isActive,
  };
}
