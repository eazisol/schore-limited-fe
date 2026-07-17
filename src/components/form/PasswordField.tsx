import { useState } from "react";
import type { FieldValues } from "react-hook-form";
import { Eye, EyeOff, Lock } from "lucide-react";
import { TextField, type TextFieldProps } from "./TextField";

export function PasswordField<T extends FieldValues>(props: Omit<TextFieldProps<T>, "type" | "rightSlot" | "leftIcon"> & { leftIcon?: TextFieldProps<T>["leftIcon"]; showToggle?: boolean }) {
  const [show, setShow] = useState(false);
  const { showToggle = true, leftIcon = Lock, ...rest } = props;
  return (
    <TextField
      {...rest}
      type={show ? "text" : "password"}
      autoComplete={rest.autoComplete ?? "current-password"}
      leftIcon={leftIcon}
      rightSlot={
        showToggle ? (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            tabIndex={-1}
            className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/10"
          >
            {show ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        ) : undefined
      }
    />
  );
}
