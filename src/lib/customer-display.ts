export function formatCustomerDisplayName(user: {
  clientCode?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}): string {
  const clientCode = user.clientCode?.trim();
  let name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  if (!name) {
    name = user.username?.trim() ?? "";
  }

  if (clientCode && name) {
    return `${clientCode} - ${name}`;
  }

  if (clientCode) {
    return clientCode;
  }

  return name || user.username?.trim() || "Client";
}
