import type { ReactNode, MouseEvent } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { FormProvider, type FieldErrors } from "react-hook-form";
import { TextField, PasswordField, SearchableSelectField, TextareaField } from "@/components/form";
import { focusFirstFormError, getFirstFormErrorMessage } from "@/components/form/Form";
import { PasswordRequirements } from "@/lib/password";
import { toApiError } from "@/lib/api/axios";
import { propertiesService } from "@/lib/api/services/properties";
import { jobTypesService } from "@/lib/api/services/job-types";
import { statusesService, DOCUMENT_TYPE_CODE } from "@/lib/api/services/statuses";
import { documentTypesService } from "@/lib/api/services/document-types";
import { usersService } from "@/lib/api/services/users";
import { productTypesService } from "@/lib/api/services/product-types";
import {
  categoriesService,
  unitsService,
} from "@/lib/api/services/units-categories";
import { tradesService } from "@/lib/api/services/trades";
import { cisService } from "@/lib/api/services/cis";
import { rolesService } from "@/lib/api/services/system-config";
import {
  ADDRESS_MAX_LENGTH,
  CODE_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  codeSchema,
  descriptionSchema,
  nameSchema,
  normalizeCodeInput,
  rateSchema,
} from "@/lib/field-validation";
import { formatCisRate } from "@/lib/module-ui";
import { getSiteManagerRoleId } from "@/lib/site-manager-role";
import { USER_TYPE_ID } from "@/lib/user-module";
import { emailSchema, userNameSchema } from "@/lib/user-validation";
import { newPasswordSchema } from "@/lib/password";
import type { LookupCreateContext, LookupCreateType } from "@/lib/lookup-create";
import type { SearchableSelectOption } from "@/components/form";
import { fetchContractorOptions, fetchCustomerOptions } from "@/lib/user-dropdowns";
import { formatCustomerDisplayName } from "@/lib/customer-display";
import { fetchSiteOptions } from "@/lib/site-dropdowns";
import { sitesService } from "@/lib/api/services/sites";
import { projectsService } from "@/lib/api/services/projects";

const JOB_TYPE_NAME_MAX = 50;
const JOB_TYPE_CODE_MAX = 20;
const STATUS_NAME_MAX = 50;
const STATUS_CODE_MAX = 20;
const CONTACT_FIELD_MAX = 30;

const propertySchema = z
  .object({
    propertyName: nameSchema("Property name"),
    contactName: z.string().trim().min(1, "Contact name is required").max(CONTACT_FIELD_MAX),
    customerId: z.string(),
    address: z.string().trim().min(1, "Address is required").max(ADDRESS_MAX_LENGTH),
    city: z.string().trim().max(100, "City must be 100 characters or fewer"),
    state: z.string().trim().max(100, "State must be 100 characters or fewer"),
    country: z.string().trim().max(100, "Country must be 100 characters or fewer"),
    zipCode: z.string().trim().max(20, "ZIP Code must be 20 characters or fewer"),
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

const jobTypeSchema = z.object({
  name: nameSchema("Name", JOB_TYPE_NAME_MAX),
  code: codeSchema("Code", JOB_TYPE_CODE_MAX),
});

const namedLookupSchema = z.object({
  name: nameSchema("Name"),
  code: codeSchema("Code"),
});

const cisQuickSchema = z.object({
  name: nameSchema("Name"),
  code: codeSchema("Code"),
  rate: rateSchema(),
});

const statusSchema = z.object({
  name: nameSchema("Name", STATUS_NAME_MAX),
  code: codeSchema("Code", STATUS_CODE_MAX),
});

const siteManagerSchema = z.object({
  firstName: userNameSchema("First name"),
  lastName: userNameSchema("Last name"),
  email: emailSchema(),
  password: newPasswordSchema,
});

const contactUserSchema = z.object({
  clientCode: z.string().trim().max(100, "Code must be 100 characters or fewer"),
  firstName: userNameSchema("First name"),
  lastName: userNameSchema("Last name"),
  email: emailSchema(),
});

const contractorQuickSchema = contactUserSchema.extend({
  companyName: z.string().trim().max(100, "Company name must be 100 characters or fewer"),
});

const siteQuickSchema = z
  .object({
    name: nameSchema("Name", NAME_MAX_LENGTH),
    code: codeSchema("Code", CODE_MAX_LENGTH),
    description: descriptionSchema(),
    address: z.string().trim().max(500, "Address must be 500 characters or fewer"),
    city: z.string().trim().max(100, "City must be 100 characters or fewer"),
    state: z.string().trim().max(100, "State must be 100 characters or fewer"),
    country: z.string().trim().max(100, "Country must be 100 characters or fewer"),
    zipCode: z.string().trim().max(20, "ZIP Code must be 20 characters or fewer"),
    customerId: z.string(),
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

const projectQuickSchema = z.object({
  name: nameSchema("Name", NAME_MAX_LENGTH),
  code: codeSchema("Code", CODE_MAX_LENGTH),
  description: descriptionSchema(),
  siteId: z.string().trim().min(1, "Site is required"),
});

const roleQuickSchema = z.object({
  name: nameSchema("Name", 50),
  code: codeSchema("Code", 50),
  description: descriptionSchema(),
});

type PropertyValues = z.infer<typeof propertySchema>;
type JobTypeValues = z.infer<typeof jobTypeSchema>;
type NamedLookupValues = z.infer<typeof namedLookupSchema>;
type CisQuickValues = z.infer<typeof cisQuickSchema>;
type StatusValues = z.infer<typeof statusSchema>;
type SiteManagerValues = z.infer<typeof siteManagerSchema>;
type ContactUserValues = z.infer<typeof contactUserSchema>;
type ContractorQuickValues = z.infer<typeof contractorQuickSchema>;
type SiteQuickValues = z.infer<typeof siteQuickSchema>;
type ProjectQuickValues = z.infer<typeof projectQuickSchema>;
type RoleQuickValues = z.infer<typeof roleQuickSchema>;

export interface LookupQuickCreateModalProps {
  type: LookupCreateType;
  open: boolean;
  onClose: () => void;
  onCreated: (option: SearchableSelectOption) => void;
  context?: LookupCreateContext;
}

export function LookupQuickCreateModal({
  type,
  open,
  onClose,
  onCreated,
  context,
}: LookupQuickCreateModalProps) {
  if (!open) return null;

  switch (type) {
    case "property":
      return <PropertyQuickCreateModal onClose={onClose} onCreated={onCreated} />;
    case "jobType":
      return <JobTypeQuickCreateModal onClose={onClose} onCreated={onCreated} />;
    case "status":
      return <StatusQuickCreateModal onClose={onClose} onCreated={onCreated} />;
    case "siteManager":
      return <SiteManagerQuickCreateModal onClose={onClose} onCreated={onCreated} />;
    case "productType":
      return <ProductTypeQuickCreateModal onClose={onClose} onCreated={onCreated} />;
    case "category":
      return <CategoryQuickCreateModal onClose={onClose} onCreated={onCreated} />;
    case "unit":
      return <UnitQuickCreateModal onClose={onClose} onCreated={onCreated} />;
    case "trade":
      return <TradeQuickCreateModal onClose={onClose} onCreated={onCreated} />;
    case "cis":
      return <CisQuickCreateModal onClose={onClose} onCreated={onCreated} />;
    case "contractor":
      return <ContractorQuickCreateModal onClose={onClose} onCreated={onCreated} />;
    case "customer":
      return <CustomerQuickCreateModal onClose={onClose} onCreated={onCreated} />;
    case "site":
      return <SiteQuickCreateModal onClose={onClose} onCreated={onCreated} context={context} />;
    case "project":
      return <ProjectQuickCreateModal onClose={onClose} onCreated={onCreated} context={context} />;
    case "role":
      return <RoleQuickCreateModal onClose={onClose} onCreated={onCreated} />;
    default:
      return null;
  }
}

function PropertyQuickCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (option: SearchableSelectOption) => void;
}) {
  const form = useForm<PropertyValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      propertyName: "",
      contactName: "",
      customerId: "",
      address: "",
      city: "",
      state: "",
      country: "",
      zipCode: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: PropertyValues) =>
      propertiesService.create({
        reference: null,
        propertyName: values.propertyName.trim(),
        contactName: values.contactName.trim(),
        contactPhoneNo: null,
        contactEmail: null,
        address: values.address.trim(),
        zipCode: values.zipCode.trim() || null,
        city: values.city.trim() || null,
        state: values.state.trim() || null,
        country: values.country.trim() || null,
        accessNotes: null,
        customerId: values.customerId.trim() ? Number(values.customerId) : 0,
        isActive: true,
      }),
    onSuccess: (res) => {
      const created = res.data;
      if (!created) return;
      toast.success(res.message || "Property created");
      onCreated({
        value: String(created.id),
        label: created.propertyName?.trim() || `Property ${created.id}`,
      });
    },
  });

  return (
    <QuickCreateShell
      title="Add property"
      size="lg"
      form={form}
      onClose={onClose}
      onSubmit={async (values) => {
        await mutation.mutateAsync(values);
      }}
      pending={mutation.isPending}
      submitLabel="Create property"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField<PropertyValues>
            name="propertyName"
            label="Property name"
            required
            autoFocus
            maxLength={50}
          />
          <TextField<PropertyValues>
            name="contactName"
            label="Contact name"
            required
            maxLength={CONTACT_FIELD_MAX}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SearchableSelectField<PropertyValues>
            name="customerId"
            label="Client"
            placeholder="Select client"
            searchPlaceholder="Search clients…"
            queryKey={["users", "customers", "dropdown", "quick-create"]}
            fetchOptions={fetchCustomerOptions}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-3">
            <TextField<PropertyValues>
              name="address"
              label="Address"
              required
              maxLength={ADDRESS_MAX_LENGTH}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField<PropertyValues> name="country" label="Country" maxLength={100} />
              <TextField<PropertyValues> name="zipCode" label="ZIP Code" maxLength={20} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:content-start">
            <TextField<PropertyValues> name="city" label="City" maxLength={100} />
            <TextField<PropertyValues> name="state" label="State" maxLength={100} />
          </div>
        </div>
      </div>
    </QuickCreateShell>
  );
}

function JobTypeQuickCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (option: SearchableSelectOption) => void;
}) {
  const form = useForm<JobTypeValues>({
    resolver: zodResolver(jobTypeSchema),
    defaultValues: { name: "", code: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: JobTypeValues) =>
      jobTypesService.create({
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        description: null,
        orderBy: 0,
        isActive: true,
      }),
    onSuccess: (res) => {
      const created = res.data;
      if (!created) return;
      toast.success(res.message || "Job type created");
      onCreated({
        value: String(created.id),
        label: created.name?.trim() || `Job type ${created.id}`,
      });
    },
  });

  return (
    <QuickCreateShell
      title="Add job type"
      form={form}
      onClose={onClose}
      onSubmit={async (values) => {
        await mutation.mutateAsync(values);
      }}
      pending={mutation.isPending}
      submitLabel="Create job type"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField<JobTypeValues> name="name" label="Name" required autoFocus maxLength={JOB_TYPE_NAME_MAX} />
        <TextField<JobTypeValues>
          name="code"
          label="Code"
          required
          maxLength={JOB_TYPE_CODE_MAX}
          transformValue={normalizeCodeInput}
          inputClassName="uppercase"
        />
      </div>
    </QuickCreateShell>
  );
}

function StatusQuickCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (option: SearchableSelectOption) => void;
}) {
  const taskDocTypeQuery = useQuery({
    queryKey: ["lookups", "document-types", "TASK"],
    queryFn: async () => {
      const res = await documentTypesService.list({ page: 1, pageSize: 50 });
      return (res.data.items ?? []).find(
        (row) => row.code === DOCUMENT_TYPE_CODE.TASK && row.isActive !== false,
      );
    },
  });

  const form = useForm<StatusValues>({
    resolver: zodResolver(statusSchema),
    defaultValues: { name: "", code: "" },
  });

  const mutation = useMutation({
    mutationFn: async (values: StatusValues) => {
      const documentTypeId = taskDocTypeQuery.data?.id;
      if (!documentTypeId) {
        throw new Error("Job document type is not available.");
      }
      return statusesService.create({
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        documentTypeId,
        description: null,
        orderBy: 0,
        isActive: true,
      });
    },
    onSuccess: (res) => {
      const created = res.data;
      if (!created) return;
      toast.success(res.message || "Status created");
      onCreated({
        value: String(created.id),
        label: created.name?.trim() || `Status ${created.id}`,
        code: created.code,
      });
    },
  });

  return (
    <QuickCreateShell
      title="Add status"
      form={form}
      onClose={onClose}
      onSubmit={async (values) => {
        await mutation.mutateAsync(values);
      }}
      pending={mutation.isPending || taskDocTypeQuery.isLoading}
      submitLabel="Create status"
      submitDisabled={!taskDocTypeQuery.data}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField<StatusValues> name="name" label="Name" required autoFocus maxLength={STATUS_NAME_MAX} />
        <TextField<StatusValues>
          name="code"
          label="Code"
          required
          maxLength={STATUS_CODE_MAX}
          transformValue={normalizeCodeInput}
          inputClassName="uppercase"
        />
      </div>
    </QuickCreateShell>
  );
}

function contactUserDropdownLabel(user: {
  clientCode?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  companyName?: string | null;
}) {
  const clientCode = user.clientCode?.trim();
  if (clientCode) return clientCode;
  const company = user.companyName?.trim();
  if (company) return company;
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return name || user.email?.trim() || "User";
}

function SiteManagerQuickCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (option: SearchableSelectOption) => void;
}) {
  const roleQuery = useQuery({
    queryKey: ["roles", "site-manager"],
    queryFn: getSiteManagerRoleId,
  });

  const form = useForm<SiteManagerValues>({
    resolver: zodResolver(siteManagerSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "" },
  });

  const password = form.watch("password");

  const mutation = useMutation({
    mutationFn: async (values: SiteManagerValues) => {
      const roleId = roleQuery.data;
      if (!roleId) {
        throw new Error("Site Manager role is not available.");
      }
      return usersService.create({
        username: values.email.trim(),
        email: values.email.trim(),
        password: values.password,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: null,
        dateOfBirth: null,
        isActive: true,
        userTypeId: USER_TYPE_ID.user,
        roleIds: [roleId],
      });
    },
    onSuccess: (res) => {
      const created = res.data;
      if (!created) return;
      const label = `${created.firstName} ${created.lastName}`.trim() || created.email;
      toast.success(res.message || "Site manager created");
      onCreated({ value: String(created.id), label });
    },
  });

  return (
    <QuickCreateShell
      title="Add site manager"
      form={form}
      onClose={onClose}
      onSubmit={async (values) => {
        await mutation.mutateAsync(values);
      }}
      pending={mutation.isPending || roleQuery.isLoading}
      submitLabel="Create site manager"
      submitDisabled={!roleQuery.data}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField<SiteManagerValues> name="firstName" label="First name" required autoFocus maxLength={50} />
        <TextField<SiteManagerValues> name="lastName" label="Last name" required maxLength={50} />
        <TextField<SiteManagerValues>
          name="email"
          label="Email"
          required
          type="email"
          placeholder="name@schore.co.uk"
        />
        <PasswordField<SiteManagerValues>
          name="password"
          label="Password"
          required
          autoComplete="new-password"
        />
      </div>
      <PasswordRequirements password={password} />
    </QuickCreateShell>
  );
}

function ContractorQuickCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (option: SearchableSelectOption) => void;
}) {
  const form = useForm<ContractorQuickValues>({
    resolver: zodResolver(contractorQuickSchema),
    defaultValues: { companyName: "", firstName: "", lastName: "", email: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: ContractorQuickValues) =>
      usersService.create({
        username: values.email.trim(),
        email: values.email.trim(),
        password: null,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: null,
        dateOfBirth: null,
        isActive: true,
        userTypeId: USER_TYPE_ID.contractor,
        roleIds: null,
        companyName: values.companyName.trim() || null,
      }),
    onSuccess: (res) => {
      const created = res.data;
      if (!created) return;
      toast.success(res.message || "Contractor created");
      onCreated({
        value: String(created.id),
        label: contactUserDropdownLabel(created),
      });
    },
  });

  return (
    <QuickCreateShell
      title="Add contractor"
      form={form}
      onClose={onClose}
      onSubmit={async (values) => {
        await mutation.mutateAsync(values);
      }}
      pending={mutation.isPending}
      submitLabel="Create contractor"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField<ContractorQuickValues>
          name="companyName"
          label="Company name"
          autoFocus
          maxLength={100}
          className="sm:col-span-2"
        />
        <TextField<ContractorQuickValues> name="firstName" label="First name" required maxLength={50} />
        <TextField<ContractorQuickValues> name="lastName" label="Last name" required maxLength={50} />
        <TextField<ContractorQuickValues>
          name="email"
          label="Email"
          required
          type="email"
          placeholder="name@schore.co.uk"
          className="sm:col-span-2"
        />
      </div>
    </QuickCreateShell>
  );
}

function CustomerQuickCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (option: SearchableSelectOption) => void;
}) {
  const form = useForm<ContactUserValues>({
    resolver: zodResolver(contactUserSchema),
    defaultValues: { clientCode: "", firstName: "", lastName: "", email: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: ContactUserValues) =>
      usersService.create({
        username: values.email.trim(),
        email: values.email.trim(),
        password: null,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: null,
        dateOfBirth: null,
        isActive: true,
        userTypeId: USER_TYPE_ID.customer,
        roleIds: null,
        clientCode: values.clientCode.trim() || null,
      }),
    onSuccess: (res) => {
      const created = res.data;
      if (!created) return;
      toast.success(res.message || "Client created");
      onCreated({
        value: String(created.id),
        label: formatCustomerDisplayName(created),
      });
    },
  });

  return (
    <QuickCreateShell
      title="Add client"
      form={form}
      onClose={onClose}
      onSubmit={async (values) => {
        await mutation.mutateAsync(values);
      }}
      pending={mutation.isPending}
      submitLabel="Create client"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField<ContactUserValues>
            name="firstName"
            label="First name"
            required
            autoFocus
            maxLength={50}
          />
          <TextField<ContactUserValues> name="lastName" label="Last name" required maxLength={50} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField<ContactUserValues> name="clientCode" label="Code" maxLength={100} />
          <TextField<ContactUserValues>
            name="email"
            label="Email"
            required
            type="email"
            placeholder="name@schore.co.uk"
          />
        </div>
      </div>
    </QuickCreateShell>
  );
}

function SiteQuickCreateModal({
  onClose,
  onCreated,
  context,
}: {
  onClose: () => void;
  onCreated: (option: SearchableSelectOption) => void;
  context?: LookupCreateContext;
}) {
  const lockedCustomerId = context?.customerId?.trim() ?? "";

  const form = useForm<SiteQuickValues>({
    resolver: zodResolver(siteQuickSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      address: "",
      city: "",
      state: "",
      country: "",
      zipCode: "",
      customerId: lockedCustomerId,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: SiteQuickValues) =>
      sitesService.create({
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        description: values.description.trim() || null,
        address: values.address.trim() || null,
        city: values.city.trim() || null,
        state: values.state.trim() || null,
        country: values.country.trim() || null,
        zipCode: values.zipCode.trim() || null,
        customerId: Number(values.customerId),
        isActive: true,
      }),
    onSuccess: (res) => {
      const created = res.data;
      if (!created) return;
      toast.success(res.message || "Site created");
      onCreated({
        value: String(created.id),
        label: `${created.code} · ${created.name}`,
      });
    },
  });

  return (
    <QuickCreateShell
      title="Add site"
      size="lg"
      form={form}
      onClose={onClose}
      onSubmit={async (values) => {
        await mutation.mutateAsync(values);
      }}
      pending={mutation.isPending}
      submitLabel="Create site"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lockedCustomerId ? (
            <LockedLookupField
              label="Client"
              value={context?.customerLabel?.trim() || "Selected client"}
            />
          ) : (
            <SearchableSelectField<SiteQuickValues>
              name="customerId"
              label="Client"
              required
              placeholder="Select client"
              searchPlaceholder="Search clients…"
              queryKey={["users", "customers", "dropdown", "quick-create"]}
              fetchOptions={fetchCustomerOptions}
            />
          )}
          <TextField<SiteQuickValues>
            name="name"
            label="Name"
            required
            autoFocus
            maxLength={NAME_MAX_LENGTH}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField<SiteQuickValues>
            name="code"
            label="Code"
            required
            maxLength={CODE_MAX_LENGTH}
            transformValue={normalizeCodeInput}
            inputClassName="uppercase"
          />
          <TextField<SiteQuickValues> name="address" label="Address" maxLength={500} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextField<SiteQuickValues> name="city" label="City" maxLength={100} />
          <TextField<SiteQuickValues> name="state" label="State" maxLength={100} />
          <TextField<SiteQuickValues> name="country" label="Country" maxLength={100} />
          <TextField<SiteQuickValues> name="zipCode" label="ZIP Code" maxLength={20} />
        </div>
        <TextareaField<SiteQuickValues>
          name="description"
          label="Description"
          maxLength={DESCRIPTION_MAX_LENGTH}
          rows={3}
        />
      </div>
    </QuickCreateShell>
  );
}

function ProjectQuickCreateModal({
  onClose,
  onCreated,
  context,
}: {
  onClose: () => void;
  onCreated: (option: SearchableSelectOption) => void;
  context?: LookupCreateContext;
}) {
  const lockedSiteId = context?.siteId?.trim() ?? "";
  const lockedCustomerId = context?.customerId?.trim() ?? "";

  const form = useForm<ProjectQuickValues>({
    resolver: zodResolver(projectQuickSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      siteId: lockedSiteId,
    },
  });

  const fetchSites = (search: string) => fetchSiteOptions(search, lockedCustomerId || undefined);

  const mutation = useMutation({
    mutationFn: (values: ProjectQuickValues) =>
      projectsService.create({
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        description: values.description.trim() || null,
        customerId: lockedCustomerId ? Number(lockedCustomerId) : 0,
        siteId: Number(values.siteId),
        isActive: true,
      }),
    onSuccess: (res) => {
      const created = res.data;
      if (!created) return;
      toast.success(res.message || "Project created");
      onCreated({
        value: String(created.id),
        label: `${created.code} · ${created.name}`,
      });
    },
  });

  return (
    <QuickCreateShell
      title="Add project"
      form={form}
      onClose={onClose}
      onSubmit={async (values) => {
        await mutation.mutateAsync(values);
      }}
      pending={mutation.isPending}
      submitLabel="Create project"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lockedCustomerId ? (
            <LockedLookupField
              label="Client"
              value={context?.customerLabel?.trim() || "Selected client"}
            />
          ) : null}
          {lockedSiteId ? (
            <LockedLookupField label="Site" value={context?.siteLabel?.trim() || "Selected site"} />
          ) : (
            <SearchableSelectField<ProjectQuickValues>
              name="siteId"
              label="Site"
              required
              placeholder="Select site"
              searchPlaceholder="Search sites…"
              queryKey={["lookups", "sites", "quick-create", lockedCustomerId]}
              fetchOptions={fetchSites}
            />
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField<ProjectQuickValues>
            name="name"
            label="Name"
            required
            autoFocus
            maxLength={NAME_MAX_LENGTH}
          />
          <TextField<ProjectQuickValues>
            name="code"
            label="Code"
            required
            maxLength={CODE_MAX_LENGTH}
            transformValue={normalizeCodeInput}
            inputClassName="uppercase"
          />
        </div>
        <TextareaField<ProjectQuickValues>
          name="description"
          label="Description"
          maxLength={DESCRIPTION_MAX_LENGTH}
          rows={3}
        />
      </div>
    </QuickCreateShell>
  );
}

function LockedLookupField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium leading-none">{label}</p>
      <p className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">{value}</p>
    </div>
  );
}

function ProductTypeQuickCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (option: SearchableSelectOption) => void;
}) {
  return (
    <NamedLookupQuickCreateModal
      title="Add product type"
      submitLabel="Create product type"
      successMessage="Product type created"
      fallbackLabel="Product type"
      onClose={onClose}
      onCreated={onCreated}
      create={(values) =>
        productTypesService.create({
          name: values.name.trim(),
          code: values.code.trim().toUpperCase(),
          orderBy: 0,
          isActive: true,
        })
      }
    />
  );
}

function CategoryQuickCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (option: SearchableSelectOption) => void;
}) {
  return (
    <NamedLookupQuickCreateModal
      title="Add category"
      submitLabel="Create category"
      successMessage="Category created"
      fallbackLabel="Category"
      onClose={onClose}
      onCreated={onCreated}
      create={(values) =>
        categoriesService.create({
          name: values.name.trim(),
          code: values.code.trim().toUpperCase(),
          description: "",
          orderBy: 0,
          isActive: true,
        })
      }
    />
  );
}

function UnitQuickCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (option: SearchableSelectOption) => void;
}) {
  return (
    <NamedLookupQuickCreateModal
      title="Add unit"
      submitLabel="Create unit"
      successMessage="Unit created"
      fallbackLabel="Unit"
      onClose={onClose}
      onCreated={onCreated}
      create={(values) =>
        unitsService.create({
          name: values.name.trim(),
          code: values.code.trim().toUpperCase(),
          orderBy: 0,
          isActive: true,
        })
      }
    />
  );
}

function TradeQuickCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (option: SearchableSelectOption) => void;
}) {
  return (
    <NamedLookupQuickCreateModal
      title="Add trade"
      submitLabel="Create trade"
      successMessage="Trade created"
      fallbackLabel="Trade"
      onClose={onClose}
      onCreated={onCreated}
      create={(values) =>
        tradesService.create({
          name: values.name.trim(),
          code: values.code.trim().toUpperCase(),
          description: "",
          orderBy: 0,
          isActive: true,
        })
      }
    />
  );
}

function CisQuickCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (option: SearchableSelectOption) => void;
}) {
  const form = useForm<CisQuickValues>({
    resolver: zodResolver(cisQuickSchema),
    defaultValues: { name: "", code: "", rate: 0 },
  });

  const mutation = useMutation({
    mutationFn: (values: CisQuickValues) =>
      cisService.create({
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        rate: values.rate,
        description: "",
        orderBy: 0,
        isActive: true,
      }),
    onSuccess: (res) => {
      const created = res.data;
      if (!created) return;
      toast.success(res.message || "CIS status created");
      onCreated({
        value: String(created.id),
        label: `${created.name?.trim() || `CIS ${created.id}`} (${formatCisRate(created.rate)})`,
      });
    },
  });

  return (
    <QuickCreateShell
      title="Add CIS status"
      form={form}
      onClose={onClose}
      onSubmit={async (values) => {
        await mutation.mutateAsync(values);
      }}
      pending={mutation.isPending}
      submitLabel="Create CIS status"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField<CisQuickValues> name="name" label="Name" required autoFocus maxLength={50} />
        <TextField<CisQuickValues>
          name="code"
          label="Code"
          required
          maxLength={20}
          transformValue={normalizeCodeInput}
          inputClassName="uppercase"
        />
        <TextField<CisQuickValues>
          name="rate"
          label="Rate (%)"
          required
          type="number"
          min={0}
          max={100}
          step="0.01"
          className="sm:col-span-2"
        />
      </div>
    </QuickCreateShell>
  );
}

function RoleQuickCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (option: SearchableSelectOption) => void;
}) {
  const form = useForm<RoleQuickValues>({
    resolver: zodResolver(roleQuickSchema),
    defaultValues: { name: "", code: "", description: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: RoleQuickValues) =>
      rolesService.create({
        name: values.name.trim(),
        code: values.code.trim(),
        description: values.description.trim(),
        isActive: true,
      }),
    onSuccess: (res) => {
      const created = res.data;
      if (!created) return;
      toast.success(res.message || "Role created");
      onCreated({
        value: String(created.id),
        label: created.name?.trim() || `Role ${created.id}`,
        description: created.description?.trim() || undefined,
      });
    },
  });

  return (
    <QuickCreateShell
      title="Add role"
      form={form}
      onClose={onClose}
      onSubmit={async (values) => {
        await mutation.mutateAsync(values);
      }}
      pending={mutation.isPending}
      submitLabel="Create role"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField<RoleQuickValues> name="name" label="Name" required autoFocus maxLength={50} />
          <TextField<RoleQuickValues>
            name="code"
            label="Code"
            required
            maxLength={50}
            transformValue={normalizeCodeInput}
            inputClassName="uppercase"
          />
        </div>
        <TextareaField<RoleQuickValues>
          name="description"
          label="Description"
          rows={3}
          maxLength={500}
        />
      </div>
    </QuickCreateShell>
  );
}

function NamedLookupQuickCreateModal({
  title,
  submitLabel,
  successMessage,
  fallbackLabel,
  onClose,
  onCreated,
  create,
}: {
  title: string;
  submitLabel: string;
  successMessage: string;
  fallbackLabel: string;
  onClose: () => void;
  onCreated: (option: SearchableSelectOption) => void;
  create: (values: NamedLookupValues) => Promise<{ data?: { id: number; name?: string | null } | null; message?: string }>;
}) {
  const form = useForm<NamedLookupValues>({
    resolver: zodResolver(namedLookupSchema),
    defaultValues: { name: "", code: "" },
  });

  const mutation = useMutation({
    mutationFn: create,
    onSuccess: (res) => {
      const created = res.data;
      if (!created) return;
      toast.success(res.message || successMessage);
      onCreated({
        value: String(created.id),
        label: created.name?.trim() || `${fallbackLabel} ${created.id}`,
      });
    },
  });

  return (
    <QuickCreateShell
      title={title}
      form={form}
      onClose={onClose}
      onSubmit={async (values) => {
        await mutation.mutateAsync(values);
      }}
      pending={mutation.isPending}
      submitLabel={submitLabel}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField<NamedLookupValues> name="name" label="Name" required autoFocus maxLength={50} />
        <TextField<NamedLookupValues>
          name="code"
          label="Code"
          required
          maxLength={20}
          transformValue={normalizeCodeInput}
          inputClassName="uppercase"
        />
      </div>
    </QuickCreateShell>
  );
}

function QuickCreateShell<T extends Record<string, unknown>>({
  title,
  form,
  onClose,
  onSubmit,
  pending,
  submitLabel,
  submitDisabled,
  size = "md",
  children,
}: {
  title: string;
  form: ReturnType<typeof useForm<T>>;
  onClose: () => void;
  onSubmit: (values: T) => Promise<void>;
  pending?: boolean;
  submitLabel: string;
  submitDisabled?: boolean;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  async function handleSubmit(values: T) {
    setErrorMessage(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setErrorMessage(resolveQuickCreateError(err, "Failed to save. Please try again."));
    }
  }

  function handleInvalid(errors: FieldErrors<T>) {
    const message =
      getFirstFormErrorMessage(errors) ?? "Please fill all required fields.";
    setErrorMessage(message);
    focusFirstFormError(errors, form);
  }

  function handleSaveClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    void form.handleSubmit(handleSubmit, handleInvalid)();
  }

  const content = (
    <FormProvider {...form}>
      <Modal open onClose={onClose} title={title} size={size} showCloseButton={false}>
        <div
          className="space-y-3"
          onKeyDown={(event) => {
            if (event.key === "Enter") event.stopPropagation();
          }}
        >
          <fieldset disabled={pending} className="space-y-3">
            {children}
          </fieldset>
          {errorMessage ? (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 border-t pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submitDisabled || pending}
              onClick={handleSaveClick}
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </FormProvider>
  );

  if (typeof document === "undefined") return content;

  return createPortal(content, document.body);
}

function resolveQuickCreateError(err: unknown, fallback: string): string {
  const apiError = toApiError(err);
  if (apiError.message?.trim()) return apiError.message.trim();
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return fallback;
}
