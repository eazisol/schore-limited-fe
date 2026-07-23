import type { ReactNode } from "react";
import { useFormContext } from "react-hook-form";
import {
  TextField,
  PasswordField,
  SelectField,
  SwitchField,
  PhoneNumberField,
  type SelectOption,
} from "@/components/form";
import { PasswordRequirements } from "@/lib/password";
import type { UserFormValues } from "@/lib/user-form";
import type { UserModuleMode } from "@/lib/user-module";

export function UserFormFields({
  mode,
  variant,
  disabled = false,
  lookupsLoading = false,
  roleOptions,
  tradeOptions = [],
  cisOptions = [],
  autoFocusFirstName = false,
}: {
  mode: UserModuleMode;
  variant: "create" | "edit";
  disabled?: boolean;
  lookupsLoading?: boolean;
  roleOptions: SelectOption[];
  tradeOptions?: SelectOption[];
  cisOptions?: SelectOption[];
  autoFocusFirstName?: boolean;
}) {
  const { watch } = useFormContext<UserFormValues>();
  const password = watch("password");
  const isOperative = mode === "operative";

  return (
    <fieldset className="space-y-6" disabled={disabled}>
      <Section title="Personal Information">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField<UserFormValues>
            name="firstName"
            label="First name"
            required
            autoFocus={autoFocusFirstName}
            maxLength={50}
          />
          <TextField<UserFormValues> name="lastName" label="Last name" required maxLength={50} />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField<UserFormValues>
            name="email"
            label="Email"
            required
            type="email"
            placeholder="name@schore.co.uk"
          />
          <PhoneNumberField<UserFormValues> name="phone" label="Phone" placeholder="07700 900000" />
        </div>
        {isOperative ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField<UserFormValues> name="dateOfBirth" label="Date of birth" type="date" />
            <SwitchField<UserFormValues>
              name="isActive"
              label="Active"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <PasswordField<UserFormValues>
                name="password"
                label="Password"
                required={variant === "create"}
                autoComplete="new-password"
                placeholder={
                  variant === "edit" ? "Leave blank to keep current password" : undefined
                }
              />
              {(variant === "create" || password) && (
                <PasswordRequirements password={password} />
              )}
            </div>
            <TextField<UserFormValues> name="dateOfBirth" label="Date of birth" type="date" />
          </div>
        )}
      </Section>

      {!isOperative ? (
        <Section title="Access" hint="Roles control what this user can see and edit.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField<UserFormValues>
              name="roleId"
              label="Role"
              required
              placeholder={lookupsLoading ? "Loading roles…" : "Select role"}
              disabled={lookupsLoading}
              options={roleOptions}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SwitchField<UserFormValues>
              name="isActive"
              label="Active"
            />
          </div>
        </Section>
      ) : null}

      {isOperative ? (
        <Section title="Workforce" hint="Trade and CIS status used on wage sheets.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField<UserFormValues>
              name="tradeId"
              label="Trade"
              required
              placeholder={lookupsLoading ? "Loading trades…" : "Select trade"}
              disabled={lookupsLoading}
              options={tradeOptions}
            />
            <SelectField<UserFormValues>
              name="cisId"
              label="CIS"
              required
              placeholder={lookupsLoading ? "Loading CIS…" : "Select CIS"}
              disabled={lookupsLoading}
              options={cisOptions}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField<UserFormValues>
              name="dailyRate"
              label="Daily rate (£)"
              required
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
            />
          </div>
        </Section>
      ) : null}
    </fieldset>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="card-elevated space-y-4 p-4 sm:p-6">
      <div>
        <h3 className="font-display font-semibold">{title}</h3>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}
