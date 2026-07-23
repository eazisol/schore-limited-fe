import { useRouterState } from "@tanstack/react-router";

export type UserModuleMode = "user" | "operative";

/** Backend userTypeId values for each module. */
export const USER_TYPE_ID = {
  user: 1,
  operative: 4,
} as const;

export function useUserModuleMode(): UserModuleMode {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return pathname.startsWith("/operatives") ? "operative" : "user";
}

export function userModuleConfig(mode: UserModuleMode) {
  const isOperative = mode === "operative";
  return {
    mode,
    isOperative,
    userTypeId: USER_TYPE_ID[mode],
    permissionRoute: isOperative ? "/operatives" : "/users",
    listPath: isOperative ? "/operatives" : "/users",
    newPath: isOperative ? "/operatives/new" : "/users/new",
    detailPath: isOperative ? "/operatives/$id" : "/users/$id",
    queryKey: isOperative ? (["users", "operatives"] as const) : (["users"] as const),
    labels: {
      moduleTitle: isOperative ? "Operatives" : "User Management",
      entity: isOperative ? "operative" : "user",
      entityTitle: isOperative ? "Operative" : "User",
      addTitle: isOperative ? "Add Operative" : "Add User",
      editTitle: isOperative ? "Edit operative" : "Edit user",
      viewTitle: isOperative ? "Operative details" : "User details",
      createButton: isOperative ? "Create operative" : "Create user",
      addButton: isOperative ? "Add operative" : "Add user",
      deleteButton: isOperative ? "Delete operative" : "Delete user",
      editButton: isOperative ? "Edit operative" : "Edit user",
      backLabel: isOperative ? "Back to operatives" : "Back to users",
      loadingList: isOperative ? "Loading operatives…" : "Loading users…",
      loadingDetail: isOperative ? "Loading operative…" : "Loading user…",
      emptyTitle: isOperative
        ? "No operatives match your filters"
        : "No users match your filters",
      itemLabel: isOperative ? "operatives" : "users",
      searchPlaceholder: isOperative
        ? "Search by name, username or email…"
        : "Search by name, username or email…",
      deleteConfirm: isOperative
        ? "This permanently removes the operative account. This action cannot be undone."
        : "This permanently removes the account and revokes platform access. This action cannot be undone.",
    },
  } as const;
}

export type UserModuleConfig = ReturnType<typeof userModuleConfig>;
