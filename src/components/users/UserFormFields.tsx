import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useFormContext } from "react-hook-form";
import {
  TextField,
  PasswordField,
  SwitchField,
  CheckboxField,
  PhoneNumberField,
  CreatableSearchableSelectField,
} from "@/components/form";
import { PasswordRequirements } from "@/lib/password";
import type { UserFormValues } from "@/lib/user-form";
import { type UserModuleMode } from "@/lib/user-module";
import { fetchCisOptions, fetchRoleOptions, fetchTradeOptions } from "@/lib/user-dropdowns";
import { ADDRESS_MAX_LENGTH } from "@/lib/field-validation";

export function UserFormFields({
  mode,
  variant,
  disabled = false,
  embedded = false,
  showActiveInHeader = false,
  lookupsLoading = false,
  roleSelectedLabel,
  operativeSelectedLabels,
  contractorSelectedLabel,
  autoFocusFirstName = false,
}: {
  mode: UserModuleMode;
  variant: "create" | "edit";
  disabled?: boolean;
  embedded?: boolean;
  /** Place Active switch on the Personal Information heading row (modals). */
  showActiveInHeader?: boolean;
  lookupsLoading?: boolean;
  roleSelectedLabel?: string | null;
  operativeSelectedLabels?: {
    trade?: string | null;
    cis?: string | null;
  };
  contractorSelectedLabel?: string | null;
  autoFocusFirstName?: boolean;
}) {
  const { watch } = useFormContext<UserFormValues>();
  const password = watch("password");
  const isOperative = mode === "operative";
  const isContractor = mode === "contractor";
  const isCustomer = mode === "customer";
  const isUser = mode === "user";
  const isContactModule = isContractor || isCustomer;
  const activeToggle =
    showActiveInHeader || !embedded ? (
      <SwitchField<UserFormValues> name="isActive" label="Active" />
    ) : undefined;

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <Section
        title="Personal Information"
        embedded={embedded}
        headerAction={activeToggle}
      >
        {isContractor ? (
          <>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <TextField<UserFormValues>
                name="companyName"
                label="Company name"
                autoFocus={autoFocusFirstName}
                maxLength={100}
              />
              <TextField<UserFormValues>
                name="firstName"
                label="First name"
                required
                maxLength={50}
              />
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <TextField<UserFormValues> name="lastName" label="Last name" required maxLength={50} />
              <TextField<UserFormValues>
                name="email"
                label="Email"
                required
                type="email"
                placeholder="name@schore.co.uk"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <PhoneNumberField<UserFormValues>
                name="phone"
                label="Phone"
                placeholder="07700 900000"
              />
              <TextField<UserFormValues>
                name="address"
                label="Address"
                maxLength={ADDRESS_MAX_LENGTH}
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <TextField<UserFormValues> name="city" label="City" maxLength={100} />
              <TextField<UserFormValues> name="state" label="State" maxLength={100} />
              <TextField<UserFormValues> name="country" label="Country" maxLength={100} />
              <TextField<UserFormValues> name="zipCode" label="ZIP Code" maxLength={20} />
            </div>
          </>
        ) : isCustomer ? (
          <>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <TextField<UserFormValues>
                name="firstName"
                label="First name"
                required
                autoFocus={autoFocusFirstName}
                maxLength={50}
              />
              <TextField<UserFormValues> name="lastName" label="Last name" required maxLength={50} />
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <TextField<UserFormValues> name="clientCode" label="Code" maxLength={100} />
              <TextField<UserFormValues>
                name="email"
                label="Email"
                required
                type="email"
                placeholder="name@schore.co.uk"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <PhoneNumberField<UserFormValues>
                name="phone"
                label="Phone"
                placeholder="07700 900000"
              />
              <TextField<UserFormValues>
                name="address"
                label="Address"
                maxLength={ADDRESS_MAX_LENGTH}
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <TextField<UserFormValues> name="city" label="City" maxLength={100} />
              <TextField<UserFormValues> name="state" label="State" maxLength={100} />
              <TextField<UserFormValues> name="country" label="Country" maxLength={100} />
              <TextField<UserFormValues> name="zipCode" label="ZIP Code" maxLength={20} />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <TextField<UserFormValues>
                name="firstName"
                label="First name"
                required
                autoFocus={autoFocusFirstName}
                maxLength={50}
              />
              <TextField<UserFormValues> name="lastName" label="Last name" required maxLength={50} />
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <TextField<UserFormValues>
                name="email"
                label="Email"
                required
                type="email"
                placeholder="name@schore.co.uk"
              />
              <PhoneNumberField<UserFormValues>
                name="phone"
                label="Phone"
                placeholder="07700 900000"
              />
            </div>
            {isOperative ? (
              <>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="space-y-2">
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
                <div className="max-w-xs">
                  <TextField<UserFormValues> name="startDate" label="Joining Date" type="date" />
                </div>
              </>
            ) : isUser ? (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="space-y-2">
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
            ) : null}
          </>
        )}
      </Section>

      {!isOperative && !isContactModule ? (
        <Section title="Access" hint="Roles control what this user can see and edit." embedded={embedded} separated={embedded}>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <CreatableSearchableSelectField<UserFormValues>
              name="roleId"
              label="Role"
              required
              placeholder="Select role"
              searchPlaceholder="Search roles…"
              disabled={disabled || lookupsLoading}
              queryKey={["lookups", "roles"]}
              selectedLabel={roleSelectedLabel}
              fetchOptions={fetchRoleOptions}
              lookupType="role"
            />
          </div>
        </Section>
      ) : null}

      {isOperative ? (
        <Section title="Workforce" hint="Trade and CIS status used on wage sheets." embedded={embedded} separated={embedded}>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <CreatableSearchableSelectField<UserFormValues>
              name="tradeId"
              label="Trade"
              required
              placeholder="Select trade"
              searchPlaceholder="Search trades…"
              disabled={disabled}
              queryKey={["lookups", "trades"]}
              selectedLabel={operativeSelectedLabels?.trade}
              fetchOptions={fetchTradeOptions}
              lookupType="trade"
            />
            <TextField<UserFormValues>
              name="dailyRate"
              label="Daily rate (£)"
              required
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
            />
            <CreatableSearchableSelectField<UserFormValues>
              name="cisId"
              label="CIS"
              required
              placeholder="Select CIS"
              searchPlaceholder="Search CIS statuses…"
              disabled={disabled}
              queryKey={["lookups", "cis"]}
              selectedLabel={operativeSelectedLabels?.cis}
              fetchOptions={fetchCisOptions}
              lookupType="cis"
            />
          </div>
          <CheckboxField<UserFormValues>
            name="isDailyRate"
            label="Use daily rate for pay (MAX price vs daily)"
          />
        </Section>
      ) : null}
    </fieldset>
  );
}

function Section({
  title,
  hint,
  headerAction,
  embedded,
  separated,
  children,
}: {
  title: string;
  hint?: string;
  headerAction?: ReactNode;
  embedded?: boolean;
  separated?: boolean;
  children: ReactNode;
}) {
  if (embedded) {
    return (
      <div className={cn("space-y-2", separated && "border-t border-border pt-3")}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold">{title}</h3>
            {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
          </div>
          {headerAction}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="card-elevated space-y-2 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-display font-semibold">{title}</h3>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {headerAction}
      </div>
      {children}
    </div>
  );
}
