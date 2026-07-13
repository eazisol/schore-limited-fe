import { useRef, type ReactNode } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

export interface AvatarUploadFieldProps<T extends FieldValues> {
  name: Path<T>;
  label?: ReactNode;
  description?: ReactNode;
  initials?: string;
  maxSizeKb?: number;
  disabled?: boolean;
  className?: string;
}

export function AvatarUploadField<T extends FieldValues>({
  name, label, description, initials = "?", maxSizeKb = 1024, disabled, className,
}: AvatarUploadFieldProps<T>) {
  const { control, formState } = useFormContext<T>();
  const submitting = formState.isSubmitting;
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const value = (field.value as string) || "";
        return (
          <FormItem className={className}>
            {label && <FormLabel>{label}</FormLabel>}
            <div className="flex items-center gap-4">
              <div className="relative">
                {value ? (
                  <img src={value} alt="" className="h-20 w-20 rounded-full object-cover border" />
                ) : (
                  <div className="h-20 w-20 rounded-full grid place-items-center bg-accent/90 text-accent-foreground text-xl font-semibold">
                    {initials}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={disabled || submitting}
                  aria-label="Change avatar"
                  className="absolute -bottom-1 -right-1 h-7 w-7 grid place-items-center rounded-full bg-card border shadow-sm hover:bg-accent/10 disabled:opacity-50"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button" variant="outline" size="sm"
                  disabled={disabled || submitting}
                  onClick={() => fileRef.current?.click()}
                >
                  Upload image
                </Button>
                {value && (
                  <Button
                    type="button" variant="ghost" size="sm"
                    disabled={disabled || submitting}
                    onClick={() => field.onChange("")}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > maxSizeKb * 1024) {
                    toast.error(`Image must be under ${Math.round(maxSizeKb / 1024)} MB`);
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => field.onChange(reader.result as string);
                  reader.readAsDataURL(file);
                }}
              />
            </div>
            {description && <FormDescription>{description}</FormDescription>}
          </FormItem>
        );
      }}
    />
  );
}
