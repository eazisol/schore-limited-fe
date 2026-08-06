import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Modal } from "@/components/Modal";
import { Form, TextField, TextareaField, SubmitButton } from "@/components/form";
import { Button } from "@/components/ui/button";
import { holdReasonsService } from "@/lib/api/services/hold-reasons";

const schema = z.object({
  holdDate: z.string().min(1, "Hold date is required"),
  holdReasonId: z.string().min(1, "Hold reason is required"),
  holdNotes: z.string(),
});

type Values = z.infer<typeof schema>;

export type HoldDetails = {
  holdDate: string;
  holdReasonId: number;
  holdNotes?: string | null;
};

export function HoldDetailsModal({
  open,
  onClose,
  onConfirm,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (details: HoldDetails) => void | Promise<void>;
  defaultDate?: string;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      holdDate: defaultDate || new Date().toISOString().slice(0, 10),
      holdReasonId: "",
      holdNotes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        holdDate: defaultDate || new Date().toISOString().slice(0, 10),
        holdReasonId: "",
        holdNotes: "",
      });
    }
  }, [open, defaultDate, form]);

  const reasonsQuery = useQuery({
    queryKey: ["lookups", "hold-reasons"],
    queryFn: async () => (await holdReasonsService.list({ page: 1, pageSize: 100 })).data.items,
    enabled: open,
  });

  async function submit(values: Values) {
    await onConfirm({
      holdDate: values.holdDate,
      holdReasonId: Number(values.holdReasonId),
      holdNotes: values.holdNotes.trim() || null,
    });
  }

  if (!open) return null;

  return (
    <Form form={form} onSubmit={submit} className="contents">
      <Modal
        open={open}
        onClose={onClose}
        title="Hold details"
        subtitle="This day will be excluded from DAYS and KPI counts."
        size="md"
        showCloseButton={false}
      >
        <div className="space-y-4">
          <TextField<Values> name="holdDate" label="Hold date" type="date" required autoFocus />
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Hold reason <span className="text-destructive">*</span>
            </label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.watch("holdReasonId")}
              onChange={(e) =>
                form.setValue("holdReasonId", e.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            >
              <option value="">Select reason…</option>
              {(reasonsQuery.data ?? [])
                .filter((r) => r.isActive)
                .map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.name}
                  </option>
                ))}
            </select>
            {form.formState.errors.holdReasonId ? (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.holdReasonId.message}
              </p>
            ) : null}
          </div>
          <TextareaField<Values> name="holdNotes" label="Notes" rows={3} />
          <div className="flex justify-end gap-2 border-t pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton size="sm">Continue</SubmitButton>
          </div>
        </div>
      </Modal>
    </Form>
  );
}
