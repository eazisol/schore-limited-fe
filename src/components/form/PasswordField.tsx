import { useState } from "react";
import type { FieldValues } from "react-hook-form";
import { Eye, EyeOff, Lock } from "lucide-react";
import { AppTooltip } from "@/components/AppTooltip";
import { TextField, type TextFieldProps } from "./TextField";

export function PasswordField<T extends FieldValues>(
  props: Omit<TextFieldProps<T>, "type" | "rightSlot" | "leftIcon"> & {
    leftIcon?: TextFieldProps<T>["leftIcon"];
    showToggle?: boolean;
  },
) {
  const [show, setShow] = useState(false);
  const { showToggle = true, leftIcon = Lock, ...rest } = props;
  const toggleLabel = show ? "Hide password" : "Show password";

  return (
    <TextField
      {...rest}
      type={show ? "text" : "password"}
      autoComplete={rest.autoComplete ?? "current-password"}
      leftIcon={leftIcon}
      rightSlot={
        showToggle ? (
          <AppTooltip content={toggleLabel} asChild>
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={toggleLabel}
              aria-pressed={show}
              tabIndex={-1}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent/10 hover:text-foreground"
            >
              {show ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </AppTooltip>
        ) : undefined
      }
    />
  );
}
