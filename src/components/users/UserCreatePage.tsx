import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { AppTooltip } from "@/components/AppTooltip";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, SubmitButton } from "@/components/form";
import { RequirePermission } from "@/components/Permission";
import { UserFormFields } from "@/components/users/UserFormFields";
import { usersService } from "@/lib/api/services/users";
import { lookupsService } from "@/lib/api/services/lookups";
import { tradesService } from "@/lib/api/services/trades";
import { cisService } from "@/lib/api/services/cis";
import { notifyApiError } from "@/lib/api/axios";
import { formatCisRate } from "@/lib/module-ui";
import { useUserModuleMode, userModuleConfig } from "@/lib/user-module";
import {
  createUserFormSchema,
  emptyUserFormValues,
  toCreateUserPayload,
  type UserFormValues,
} from "@/lib/user-form";

export function UserCreatePage() {
  const mode = useUserModuleMode();
  const cfg = userModuleConfig(mode);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const schema = createUserFormSchema(mode);

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await lookupsService.roles()).data,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const tradesQuery = useQuery({
    queryKey: ["trades", "options"],
    queryFn: async () => (await tradesService.options()).data,
    enabled: cfg.isOperative,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const cisQuery = useQuery({
    queryKey: ["cis", "options"],
    queryFn: async () => (await cisService.options()).data,
    enabled: cfg.isOperative,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyUserFormValues,
  });

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof toCreateUserPayload>) => usersService.create(payload),
    onSuccess: (res) => {
      toast.success(
        res.message ||
          `${res.data?.firstName || res.data?.username || cfg.labels.entityTitle} created`,
      );
      queryClient.invalidateQueries({ queryKey: cfg.queryKey });
      navigate({ to: cfg.listPath });
    },
    onError: (err) => notifyApiError(err, `Failed to create ${cfg.labels.entity}`),
  });

  async function submit(values: UserFormValues) {
    await createMutation.mutateAsync(toCreateUserPayload(values, mode));
  }

  const lookupsLoading =
    rolesQuery.isLoading ||
    (cfg.isOperative && (tradesQuery.isLoading || cisQuery.isLoading));

  return (
    <RequirePermission route={cfg.permissionRoute} action="modify">
      <div>
        <PageHeader
          title={cfg.labels.addTitle}
          leading={
            <AppTooltip content={cfg.labels.backLabel} asChild>
              <Link
                to={cfg.listPath}
                aria-label={cfg.labels.backLabel}
                className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md text-accent transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </AppTooltip>
          }
        />

        <Form form={form} onSubmit={submit} className="max-w-3xl space-y-6">
          <UserFormFields
            mode={mode}
            variant="create"
            disabled={createMutation.isPending}
            lookupsLoading={lookupsLoading}
            autoFocusFirstName
            roleOptions={(rolesQuery.data ?? []).map((r) => ({
              value: String(r.id),
              label: r.name,
              description: r.description ?? undefined,
            }))}
            tradeOptions={(tradesQuery.data ?? []).map((t) => ({
              value: String(t.id),
              label: t.name,
            }))}
            cisOptions={(cisQuery.data ?? []).map((c) => ({
              value: String(c.id),
              label: `${c.name} (${formatCisRate(c.rate)})`,
            }))}
          />

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: cfg.listPath })}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <SubmitButton loadingText="Saving…" disabled={lookupsLoading}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {cfg.labels.createButton}
            </SubmitButton>
          </div>
        </Form>
      </div>
    </RequirePermission>
  );
}
