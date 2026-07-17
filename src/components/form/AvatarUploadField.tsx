import { useRef, type ReactNode } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export interface AvatarUploadFieldProps<T extends FieldValues> {
  name: Path<T>;
  label?: ReactNode;
  description?: ReactNode;
  initials?: string;
  maxSizeKb?: number;
  disabled?: boolean;
  className?: string;
  layout?: "default" | "profile";
  title?: string;
  subtitle?: string;
  /** Called when the user selects or removes an image file (for API upload). */
  onFileChange?: (file: File | null) => void;
  /** Called before a persisted image is removed. */
  onRemove?: () => void;
}

export function AvatarUploadField<T extends FieldValues>({
  name,
  label,
  description,
  initials = "?",
  maxSizeKb = 1024,
  disabled,
  className,
  layout = "default",
  title,
  subtitle,
  onFileChange,
  onRemove,
}: AvatarUploadFieldProps<T>) {
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
      render={({ field }) => {
        const value = (field.value as string) || "";

        function clearImage() {
          field.onChange("");
          onFileChange?.(null);
          if (fileRef.current) fileRef.current.value = "";
        }

        const avatarNode = (
          <div className="relative shrink-0 group">
            {value ? (
              <img
                src={value}
                alt=""
                className={cn(
                  "rounded-full object-cover border-2 border-background shadow-sm",
                  layout === "profile" ? "h-20 w-20 sm:h-24 sm:w-24" : "h-20 w-20",
                )}
              />
            ) : (
              <div
                className={cn(
                  "rounded-full grid place-items-center bg-accent/90 text-accent-foreground font-semibold border-2 border-background shadow-sm",
                  layout === "profile" ? "h-20 w-20 sm:h-24 sm:w-24 text-xl" : "h-20 w-20 text-xl",
                )}
              >
                {initials}
              </div>
            )}
            {layout === "profile" ? (
              <button
                type="button"
                onClick={openPicker}
                disabled={disabled || submitting}
                aria-label="Change photo"
                className="absolute inset-0 grid cursor-pointer place-items-center rounded-full bg-foreground/45 text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 disabled:opacity-50"
              >
                <Camera className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={openPicker}
                disabled={disabled || submitting}
                aria-label="Change avatar"
                className="absolute -bottom-1 -right-1 h-7 w-7 grid place-items-center rounded-full bg-card border shadow-sm hover:bg-accent/10 disabled:opacity-50"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );

        const fileInput = (
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > maxSizeKb * 1024) {
                toast.error(`Image must be under ${Math.round(maxSizeKb / 1024)} MB`);
                return;
              }
              onFileChange?.(file);
              const reader = new FileReader();
              reader.onload = () => field.onChange(reader.result as string);
              reader.readAsDataURL(file);
            }}
          />
        );

        if (layout === "profile") {
          return (
            <FormItem className={className}>
              <div className="rounded-lg border border-border bg-muted/25 p-4 sm:p-5">
                <div className="flex items-center gap-4 sm:gap-5">
                  {avatarNode}
                  <div className="min-w-0 flex-1">
                    {title && (
                      <div className="font-display font-semibold text-lg truncate">{title}</div>
                    )}
                    {subtitle && (
                      <div className="text-sm text-muted-foreground truncate mt-0.5">
                        {subtitle}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5">
                      <button
                        type="button"
                        onClick={openPicker}
                        disabled={disabled || submitting}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent/90 disabled:opacity-50"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        Change photo
                      </button>
                      {value && (
                        <button
                          type="button"
                          onClick={onRemove ?? clearImage}
                          disabled={disabled || submitting}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove image
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      JPG or PNG, max {Math.round(maxSizeKb / 1024)} MB
                    </p>
                  </div>
                </div>
              </div>
              {description && <FormDescription className="mt-2">{description}</FormDescription>}
              {fileInput}
            </FormItem>
          );
        }

        return (
          <FormItem className={className}>
            {label && <FormLabel>{label}</FormLabel>}
            <div className="flex items-center gap-4">
              {avatarNode}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={openPicker}
                  disabled={disabled || submitting}
                  className="text-sm font-medium text-foreground hover:underline disabled:opacity-50"
                >
                  Upload image
                </button>
                {value && (
                  <button
                    type="button"
                    onClick={onRemove ?? clearImage}
                    disabled={disabled || submitting}
                    className="inline-flex items-center gap-1.5 text-left text-sm text-destructive hover:underline disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove image
                  </button>
                )}
              </div>
            </div>
            {description && <FormDescription>{description}</FormDescription>}
            {fileInput}
          </FormItem>
        );
      }}
    />
  );
}
