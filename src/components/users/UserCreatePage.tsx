import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormPageCard } from "@/components/FormPageCard";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, SubmitButton, SwitchField } from "@/components/form";
import { RequirePermission } from "@/components/Permission";
import {
  OPERATIVE_FORM_TABS,
  UserFormFields,
  type OperativeFormTab,
} from "@/components/users/UserFormFields";
import { usersService } from "@/lib/api/services/users";
import { notifyApiError } from "@/lib/api/axios";
import { useUserModuleMode, userModuleConfig } from "@/lib/user-module";
import {
  createUserFormSchema,
  emptyUserFormValues,
  toCreateUserPayload,
  type UserFormValues,
} from "@/lib/user-form";
import { uploadPendingCertificationFiles } from "@/lib/upload-certification-files";
import { useRateCapReasonGate } from "@/components/rates/useRateCapReasonGate";

export function UserCreatePage() {
  const mode = useUserModuleMode();
  const cfg = userModuleConfig(mode);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const schema = createUserFormSchema(mode);
  const { runWithCapReason, modal: capReasonModal } = useRateCapReasonGate();
  const isOperative = mode === "operative";
  const [operativeTab, setOperativeTab] = useState<OperativeFormTab>("details");

  const form = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyUserFormValues,
  });

  const createMutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      const res = await usersService.create(toCreateUserPayload(values, mode));
      if (mode === "operative" && res.data?.id) {
        await uploadPendingCertificationFiles(String(res.data.id), values.certifications, res.data);
      }
      return res;
    },
    onSuccess: (res) => {
      toast.success(
        res.message ||
          `${res.data?.firstName || res.data?.username || cfg.labels.entityTitle} created`,
      );
      queryClient.invalidateQueries({ queryKey: cfg.queryKey });
      navigate({ to: cfg.listPath });
    },
  });

  async function submit(values: UserFormValues) {
    try {
      await runWithCapReason(values, (next) => createMutation.mutateAsync(next));
    } catch (err) {
      notifyApiError(err, `Failed to create ${cfg.labels.entity}`);
    }
  }

  const operativeTabIndex = useMemo(
    () => OPERATIVE_FORM_TABS.findIndex((item) => item.id === operativeTab),
    [operativeTab],
  );
  const canGoNext = isOperative && operativeTabIndex >= 0 && operativeTabIndex < OPERATIVE_FORM_TABS.length - 1;

  return (
    <RequirePermission route={cfg.permissionRoute} action="modify">
      <Form form={form} onSubmit={submit} className="w-full max-w-3xl">
        <FormPageCard
          title={cfg.labels.addTitle}
          back={{ to: cfg.listPath, label: cfg.labels.backLabel }}
          headerActions={<SwitchField<UserFormValues> name="isActive" label="Active" />}
          maxWidth="w-full max-w-3xl"
          footer={
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate({ to: cfg.listPath })}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              {canGoNext ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={createMutation.isPending}
                  onClick={() => setOperativeTab(OPERATIVE_FORM_TABS[operativeTabIndex + 1]!.id)}
                >
                  Next
                </Button>
              ) : null}
              <SubmitButton size="sm" loadingText="Saving…">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {cfg.labels.createButton}
              </SubmitButton>
            </div>
          }
        >
          <UserFormFields
            embedded
            mode={mode}
            variant="create"
            disabled={createMutation.isPending}
            autoFocusFirstName
            capabilityResetKey="create"
            operativeTab={isOperative ? operativeTab : undefined}
            onOperativeTabChange={isOperative ? setOperativeTab : undefined}
          />
        </FormPageCard>
      </Form>

      {capReasonModal}
    </RequirePermission>
  );
}
