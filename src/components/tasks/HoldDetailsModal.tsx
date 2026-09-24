import { useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Modal } from "@/components/Modal";
import { TextField, TextareaField, SearchableSelectField } from "@/components/form";
import { Button } from "@/components/ui/button";
import { holdReasonsService } from "@/lib/api/services/hold-reasons";
import { Loader2 } from "lucide-react";

const schema = z.object({
  holdDate: z.string().min(1, "Hold date is required"),
  holdReasonId: z.string().min(1, "Hold reason is required"),
  holdNotes: z.string(),
});

type Values = z.infer<typeof schema>;

export type HoldDetails = {
  holdDate: string;
  holdReasonId: string;
  holdNotes?: string | null;
};

/** Local calendar date (YYYY-MM-DD) — avoids UTC off-by-one from toISOString(). */
function todayLocalYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function fetchHoldReasonOptions(search: string) {
  const res = await holdReasonsService.list({ page: 1, pageSize: 50, search: search.trim() });
  return (res.data.items ?? [])
    .filter((r) => r.isActive)
    .map((r) => ({ value: String(r.id), label: r.name }));
}

export function HoldDetailsModal({
  open,
  onClose,
  onConfirm,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (details: HoldDetails) => void | Promise<void>;
  /** Defaults to today's local date when omitted. */
  defaultDate?: string;
}) {
  const holdDateDefault = defaultDate?.trim() || todayLocalYmd();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      holdDate: holdDateDefault,
      holdReasonId: "",
      holdNotes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        holdDate: defaultDate?.trim() || todayLocalYmd(),
        holdReasonId: "",
        holdNotes: "",
      });
    }
  }, [open, defaultDate, form]);

  async function submit(values: Values) {
    await onConfirm({
      holdDate: values.holdDate,
      holdReasonId: values.holdReasonId,
      holdNotes: values.holdNotes.trim() || null,
    });
  }

  function handleContinue() {
    void form.handleSubmit(submit, (errors) => {
      const first =
        errors.holdDate?.message ||
        errors.holdReasonId?.message ||
        errors.holdNotes?.message ||
        "Please fill all required fields.";
      toast.error(first, { id: "form-validation" });
    })();
  }

  if (!open || typeof document === "undefined") return null;

  const isSubmitting = form.formState.isSubmitting;

  // Portal outside the parent task <form> so Continue / Enter cannot submit it.
  return createPortal(
    <Modal
      open={open}
      onClose={onClose}
      title="Hold details"
      subtitle="This day will be excluded from DAYS and KPI counts."
      size="sm"
      showCloseButton={false}
    >
      <FormProvider {...form}>
        <div
          className="space-y-4"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
              e.preventDefault();
              e.stopPropagation();
              handleContinue();
            }
          }}
        >
          <TextField<Values> name="holdDate" label="Hold date" type="date" required autoFocus />
          <SearchableSelectField<Values>
            name="holdReasonId"
            label="Hold reason"
            required
            placeholder="Select reason…"
            searchPlaceholder="Search reasons…"
            queryKey={["lookups", "hold-reasons", "hold-details"]}
            fetchOptions={fetchHoldReasonOptions}
            disabled={isSubmitting}
          />
          <TextareaField<Values> name="holdNotes" label="Notes" rows={3} />
          <div className="flex justify-end gap-2 border-t pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleContinue} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continue
            </Button>
          </div>
        </div>
      </FormProvider>
    </Modal>,
    document.body,
  );
}
