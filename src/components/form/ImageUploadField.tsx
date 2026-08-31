import { useRef, type ReactNode } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { FormField, FormItem } from "@/components/ui/form";
import { FormFieldLabel } from "@/components/form/FormFieldLabel";
import { shouldShowFieldError } from "@/components/form/shouldShowFieldError";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ImageUploadFieldProps<T extends FieldValues> {
  name: Path<T>;
  label?: ReactNode;
  description?: ReactNode;
  /** Max file size in kilobytes. Default 2 MB. */
  maxSizeKb?: number;
  /** `accept` attribute for the file input. */
  accept?: string;
  /** Allowed file extensions (lowercase, no dot). When set, rejects other types. */
  allowedExtensions?: readonly string[];
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

function fileExtension(file: File): string {
  const name = file.name.trim();
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function formatExtensionsLabel(extensions: readonly string[]): string {
  return extensions.map((ext) => ext.toUpperCase()).join(", ");
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
  accept = "image/*",
  allowedExtensions,
  disabled,
  className,
  onFileChange,
  onRemove,
}: ImageUploadFieldProps<T>) {
  const { control, formState } = useFormContext<T>();
  const submitting = formState.isSubmitting;
  const fileRef = useRef<HTMLInputElement>(null);
  const maxSizeMb = Math.round(maxSizeKb / 1024) || 1;
  const formatsLabel = allowedExtensions?.length
    ? formatExtensionsLabel(allowedExtensions)
    : "JPG, PNG";

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

        const invalid = shouldShowFieldError(fieldState.error, formState.isSubmitted);

        return (
          <FormItem className={className}>
            {label && (
              <FormFieldLabel label={label} description={description} />
            )}
            <div
              className={cn(
                "rounded-lg border bg-muted/25 p-3",
                invalid && "border-destructive",
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <button
                  type="button"
                  onClick={openPicker}
                  disabled={disabled || submitting}
                  aria-label={value ? "Change image" : "Upload image"}
                  className={cn(
                    "relative grid h-28 w-full shrink-0 place-items-center overflow-hidden rounded-md border border-dashed border-border bg-background transition-colors hover:border-accent/50 hover:bg-accent/5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 sm:h-28 sm:w-40",
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
                    Upload an image for this item. You can change or remove it anytime.
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
                    Allowed: {formatsLabel}. Max {maxSizeMb} MB
                  </p>
                </div>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={accept}
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                if (allowedExtensions?.length) {
                  const ext = fileExtension(file);
                  if (!ext || !allowedExtensions.includes(ext)) {
                    toast.error(
                      `Only ${formatExtensionsLabel(allowedExtensions)} images are allowed.`,
                    );
                    e.target.value = "";
                    return;
                  }
                }

                if (file.size > maxSizeKb * 1024) {
                  toast.error(`Image must be under ${maxSizeMb} MB`);
                  e.target.value = "";
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
