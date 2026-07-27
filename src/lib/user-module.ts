import { useRouterState } from "@tanstack/react-router";

export type UserModuleMode = "user" | "customer" | "contractor" | "operative";

/** Backend userTypeId values for each module. */
export const USER_TYPE_ID = {
  user: 1,
  customer: 2,
  contractor: 3,
  operative: 4,
} as const;

const ROUTE_PREFIX: Record<UserModuleMode, string> = {
  user: "/users",
  customer: "/customers",
  contractor: "/contractors",
  operative: "/operatives",
};

const QUERY_KEY: Record<UserModuleMode, readonly string[]> = {
  user: ["users"],
  customer: ["users", "customers"],
  contractor: ["users", "contractors"],
  operative: ["users", "operatives"],
};

const LABELS: Record<
  UserModuleMode,
  {
    moduleTitle: string;
    entity: string;
    entityTitle: string;
    addTitle: string;
    editTitle: string;
    viewTitle: string;
    createButton: string;
    addButton: string;
    deleteButton: string;
    editButton: string;
    backLabel: string;
    loadingList: string;
    loadingDetail: string;
    emptyTitle: string;
    itemLabel: string;
    deleteConfirm: string;
  }
> = {
  user: {
    moduleTitle: "User Management",
    entity: "user",
    entityTitle: "User",
    addTitle: "Add User",
    editTitle: "Edit user",
    viewTitle: "User details",
    createButton: "Create user",
    addButton: "Add user",
    deleteButton: "Delete user",
    editButton: "Edit user",
    backLabel: "Back to users",
    loadingList: "Loading users…",
    loadingDetail: "Loading user…",
    emptyTitle: "No users match your filters",
    itemLabel: "users",
    deleteConfirm:
      "This permanently removes the account and revokes platform access. This action cannot be undone.",
  },
  customer: {
    moduleTitle: "Customers",
    entity: "customer",
    entityTitle: "Customer",
    addTitle: "Add Customer",
    editTitle: "Edit customer",
    viewTitle: "Customer details",
    createButton: "Create customer",
    addButton: "Add customer",
    deleteButton: "Delete customer",
    editButton: "Edit customer",
    backLabel: "Back to customers",
    loadingList: "Loading customers…",
    loadingDetail: "Loading customer…",
    emptyTitle: "No customers match your filters",
    itemLabel: "customers",
    deleteConfirm:
      "This permanently removes the customer account. This action cannot be undone.",
  },
  contractor: {
    moduleTitle: "Contractors",
    entity: "contractor",
    entityTitle: "Contractor",
    addTitle: "Add Contractor",
    editTitle: "Edit contractor",
    viewTitle: "Contractor details",
    createButton: "Create contractor",
    addButton: "Add contractor",
    deleteButton: "Delete contractor",
    editButton: "Edit contractor",
    backLabel: "Back to contractors",
    loadingList: "Loading contractors…",
    loadingDetail: "Loading contractor…",
    emptyTitle: "No contractors match your filters",
    itemLabel: "contractors",
    deleteConfirm:
      "This permanently removes the contractor account. This action cannot be undone.",
  },
  operative: {
    moduleTitle: "Operatives",
    entity: "operative",
    entityTitle: "Operative",
    addTitle: "Add Operative",
    editTitle: "Edit operative",
    viewTitle: "Operative details",
    createButton: "Create operative",
    addButton: "Add operative",
    deleteButton: "Delete operative",
    editButton: "Edit operative",
    backLabel: "Back to operatives",
    loadingList: "Loading operatives…",
    loadingDetail: "Loading operative…",
    emptyTitle: "No operatives match your filters",
    itemLabel: "operatives",
    deleteConfirm:
      "This permanently removes the operative account. This action cannot be undone.",
  },
};

export function useUserModuleMode(): UserModuleMode {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.startsWith("/operatives")) return "operative";
  if (pathname.startsWith("/contractors")) return "contractor";
  if (pathname.startsWith("/customers")) return "customer";
  return "user";
}

export function userModuleConfig(mode: UserModuleMode) {
  const isOperative = mode === "operative";
  const isContractor = mode === "contractor";
  const isCustomer = mode === "customer";
  const isContactModule = isContractor || isCustomer;
  const routePrefix = ROUTE_PREFIX[mode];

  return {
    mode,
    isOperative,
    isContractor,
    isCustomer,
    isContactModule,
    hideAccessFields: isOperative || isContactModule,
    userTypeId: USER_TYPE_ID[mode],
    permissionRoute: routePrefix,
    listPath: routePrefix,
    newPath: `${routePrefix}/new`,
    detailPath: `${routePrefix}/$id`,
    queryKey: QUERY_KEY[mode],
    labels: {
      ...LABELS[mode],
      searchPlaceholder: "Search by name, username or email…",
    },
  } as const;
}

export type UserModuleConfig = ReturnType<typeof userModuleConfig>;
