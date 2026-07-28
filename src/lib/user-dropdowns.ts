import type { SearchableSelectOption } from "@/components/form";
import { usersService } from "@/lib/api/services/users";
import { USER_TYPE_ID } from "@/lib/user-module";

export async function fetchCustomerOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await usersService.dropdown({
    search,
    userTypeId: USER_TYPE_ID.customer,
  });
  return (res.data ?? []).map((item) => ({
    value: String(item.id),
    label: item.name,
  }));
}

export async function fetchContractorOptions(search: string): Promise<SearchableSelectOption[]> {
  const res = await usersService.dropdown({
    search,
    userTypeId: USER_TYPE_ID.contractor,
  });
  return (res.data ?? []).map((item) => ({
    value: String(item.id),
    label: item.name,
  }));
}
