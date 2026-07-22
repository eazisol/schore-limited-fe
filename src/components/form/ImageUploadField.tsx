import { useRef, type ReactNode } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ImageUploadFieldProps<T extends FieldValues> {
  name: Path<T>;
  label?: ReactNode;
  description?: ReactNode;
  maxSizeKb?: number;
  disabled?: boolean;
  className?: string;
  /** Called when the user selects or removes an image file. */
  onFileChange?: (file: File | null) => void;
  /**
   * Called when removing a persisted (server) image.
   * Local/new previews (`data:`) are cleared without calling this.
   */
  onRemove?: () => void;
}

/**
 * Rectangular image picker with preview, change, and remove — for catalogue items.
 * Stores a data URL (or existing remote URL) in the form field.
 */
export function ImageUploadField<T extends FieldValues>({
  name,
  label,
  description,
  maxSizeKb = 2048,
  disabled,
  className,
  onFileChange,
  onRemove,
}: ImageUploadFieldProps<T>) {
  const { control, formState } = useFormContext<T>();
  const submitting = formState.isSubmitting;
  const fileRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    if (!disabled && !submitting) fileRef.current?.click();
  }

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = (field.value as string) || "";
        const isPersistedImage = Boolean(value) && !value.startsWith("data:");

        function clearImage() {
          field.onChange("");
          onFileChange?.(null);
          if (fileRef.current) fileRef.current.value = "";
        }

        function handleRemove() {
          if (isPersistedImage && onRemove) {
            onRemove();
            return;
          }
          clearImage();
        }

        return (
          <FormItem className={className}>
            {label && <FormLabel>{label}</FormLabel>}
            <div
              className={cn(
                "rounded-lg border bg-muted/25 p-4",
                fieldState.error && "border-destructive",
              )}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <button
                  type="button"
                  onClick={openPicker}
                  disabled={disabled || submitting}
                  aria-label={value ? "Change image" : "Upload image"}
                  className={cn(
                    "relative grid h-28 w-full shrink-0 place-items-center overflow-hidden rounded-md border border-dashed border-border bg-background transition-colors hover:border-accent/50 hover:bg-accent/5 disabled:opacity-50 sm:h-28 sm:w-40",
                    value && "border-solid",
                  )}
                >
                  {value ? (
                    <img src={value} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                      <ImagePlus className="h-6 w-6" />
                      <span className="text-[11px] font-medium">Add image</span>
                    </div>
                  )}
                </button>

                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Upload a JPG or PNG image for this item. You can change or remove it anytime.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openPicker}
                      disabled={disabled || submitting}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {value ? "Change image" : "Upload image"}
                    </Button>
                    {value ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-destructive/30 text-destructive hover:bg-destructive/5"
                        onClick={handleRemove}
                        disabled={disabled || submitting}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Max {Math.round(maxSizeKb / 1024) || 2} MB
                  </p>
                </div>
              </div>
            </div>
            {description && <FormDescription>{description}</FormDescription>}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > maxSizeKb * 1024) {
                  toast.error(`Image must be under ${Math.round(maxSizeKb / 1024) || 2} MB`);
                  return;
                }
                onFileChange?.(file);
                const reader = new FileReader();
                reader.onload = () => field.onChange(reader.result as string);
                reader.readAsDataURL(file);
              }}
            />
          </FormItem>
        );
      }}
    />
  );
}
