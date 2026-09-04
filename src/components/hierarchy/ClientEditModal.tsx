import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ClientEntityForm } from "@/components/hierarchy/HierarchyEntityForms";
import { usersService } from "@/lib/api/services/users";
import { userToFormValues } from "@/lib/user-form";

export function ClientEditModal({
  customerId,
  onClose,
}: {
  customerId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["users", "customers", customerId],
    queryFn: async () => (await usersService.get(customerId)).data,
  });

  const defaults = useMemo(
    () => (query.data ? userToFormValues(query.data) : null),
    [query.data],
  );

  function handleSaved() {
    qc.invalidateQueries({ queryKey: ["users", "customers"] });
    qc.invalidateQueries({ queryKey: ["users", "customers", customerId] });
    qc.invalidateQueries({ queryKey: ["lookups"] });
    qc.invalidateQueries({ queryKey: ["customer-work"] });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit client"
      size="xl"
      showCloseButton={false}
    >
      {query.isLoading || !defaults ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading client…
        </div>
      ) : query.isError || !query.data ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Unable to load client.</p>
      ) : (
        <ClientEntityForm
          mode="edit"
          customerId={customerId}
          defaultValues={defaults}
          submitLabel="Save changes"
          onCancel={onClose}
          onSaved={handleSaved}
        />
      )}
    </Modal>
  );
}
