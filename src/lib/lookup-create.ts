import { PROPERTIES_ROUTE } from "@/lib/properties";
import { SITES_ROUTE } from "@/lib/sites";
import { PROJECTS_ROUTE } from "@/lib/projects";
import { JOB_TYPES_ROUTE } from "@/lib/job-types";
import { STATUSES_ROUTE } from "@/lib/statuses";
import { MANAGE_FORMS_ROUTE } from "@/lib/manage-forms";
import { USER_TYPE_ID } from "@/lib/user-module";
import { CATEGORIES_ROUTE } from "@/lib/categories";
import { UNITS_ROUTE } from "@/lib/units";
import { PRODUCT_MANAGEMENT_ROUTE } from "@/lib/product-management";
import { ITEMS_ROUTE } from "@/lib/items";
import { TRADES_ROUTE } from "@/lib/trades";
import { CIS_ROUTE } from "@/lib/cis";
import { ROLES_ROUTE } from "@/lib/roles";
import { CERTIFICATION_TYPES_ROUTE } from "@/lib/certification-types";
import { CERTIFICATION_LEVELS_ROUTE } from "@/lib/certification-levels";

export type LookupCreateType =
  | "property"
  | "jobType"
  | "status"
  | "siteManager"
  | "productType"
  | "category"
  | "unit"
  | "trade"
  | "cis"
  | "contractor"
  | "customer"
  | "site"
  | "project"
  | "role"
  | "certificationType"
  | "certificationLevel";

/** Parent form context passed into inline create modals (e.g. pre-selected customer/site). */
export interface LookupCreateContext {
  customerId?: string;
  customerLabel?: string | null;
  siteId?: string;
  siteLabel?: string | null;
  certificationTypeId?: string;
  certificationTypeLabel?: string | null;
}

export interface LookupCreateConfig {
  type: LookupCreateType;
  /** Permission routes — user needs modify on any one of these. */
  permissionRoutes: readonly string[];
  /** React Query keys to invalidate after create. */
  invalidateQueryKeys: readonly (readonly unknown[])[];
  addNewLabel: string;
}

export const LOOKUP_CREATE_CONFIG: Record<LookupCreateType, LookupCreateConfig> = {
  property: {
    type: "property",
    permissionRoutes: [PROPERTIES_ROUTE],
    invalidateQueryKeys: [["lookups", "properties"], ["properties"]],
    addNewLabel: "Add property",
  },
  jobType: {
    type: "jobType",
    permissionRoutes: [JOB_TYPES_ROUTE, MANAGE_FORMS_ROUTE],
    invalidateQueryKeys: [["lookups", "job-types"], ["job-types"]],
    addNewLabel: "Add property type",
  },
  status: {
    type: "status",
    permissionRoutes: [STATUSES_ROUTE, MANAGE_FORMS_ROUTE],
    invalidateQueryKeys: [["lookups", "statuses"], ["lookups", "statuses", "TASK"], ["statuses"]],
    addNewLabel: "Add status",
  },
  siteManager: {
    type: "siteManager",
    permissionRoutes: ["/users"],
    invalidateQueryKeys: [["lookups", "site-managers"], ["users"]],
    addNewLabel: "Add site manager",
  },
  productType: {
    type: "productType",
    permissionRoutes: [PRODUCT_MANAGEMENT_ROUTE, ITEMS_ROUTE],
    invalidateQueryKeys: [["lookups", "product-types"], ["product-types"]],
    addNewLabel: "Add product type",
  },
  category: {
    type: "category",
    permissionRoutes: [CATEGORIES_ROUTE, PRODUCT_MANAGEMENT_ROUTE],
    invalidateQueryKeys: [["lookups", "categories"], ["categories"]],
    addNewLabel: "Add category",
  },
  unit: {
    type: "unit",
    permissionRoutes: [UNITS_ROUTE, PRODUCT_MANAGEMENT_ROUTE],
    invalidateQueryKeys: [["lookups", "units"], ["units"]],
    addNewLabel: "Add unit",
  },
  trade: {
    type: "trade",
    permissionRoutes: [TRADES_ROUTE],
    invalidateQueryKeys: [["lookups", "trades"], ["trades"], ["trades", "options"]],
    addNewLabel: "Add trade",
  },
  cis: {
    type: "cis",
    permissionRoutes: [CIS_ROUTE],
    invalidateQueryKeys: [["lookups", "cis"], ["cis"], ["cis", "options"]],
    addNewLabel: "Add CIS status",
  },
  contractor: {
    type: "contractor",
    permissionRoutes: ["/contractors"],
    invalidateQueryKeys: [
      ["users", "contractors", "dropdown"],
      ["users", "contractors"],
      ["users", "contractors", "dropdown", "quick-create"],
    ],
    addNewLabel: "Add contractor",
  },
  customer: {
    type: "customer",
    permissionRoutes: ["/customers"],
    invalidateQueryKeys: [
      ["users", "customers", "dropdown"],
      ["users", "customers"],
      ["users", "customers", "dropdown", "quick-create"],
    ],
    addNewLabel: "Add client",
  },
  site: {
    type: "site",
    permissionRoutes: [SITES_ROUTE],
    invalidateQueryKeys: [
      ["sites", "dropdown"],
      ["sites"],
      ["lookups", "sites"],
    ],
    addNewLabel: "Add site",
  },
  project: {
    type: "project",
    permissionRoutes: [PROJECTS_ROUTE],
    invalidateQueryKeys: [
      ["projects", "dropdown"],
      ["projects"],
      ["lookups", "projects"],
    ],
    addNewLabel: "Add project",
  },
  role: {
    type: "role",
    permissionRoutes: [ROLES_ROUTE],
    invalidateQueryKeys: [["roles"], ["roles", "list"], ["lookups", "roles"]],
    addNewLabel: "Add role",
  },
  certificationType: {
    type: "certificationType",
    permissionRoutes: [CERTIFICATION_TYPES_ROUTE],
    invalidateQueryKeys: [
      ["lookups", "certification-types"],
      ["certification-types"],
    ],
    addNewLabel: "Add certification type",
  },
  certificationLevel: {
    type: "certificationLevel",
    permissionRoutes: [CERTIFICATION_LEVELS_ROUTE],
    invalidateQueryKeys: [
      ["lookups", "certification-levels"],
      ["certification-levels"],
    ],
    addNewLabel: "Add certification level",
  },
};

export const SITE_MANAGER_USER_TYPE_ID = USER_TYPE_ID.user;
