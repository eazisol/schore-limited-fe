import type { ReactNode } from "react";
import { useFormContext } from "react-hook-form";
import {
  TextField,
  PasswordField,
  SelectField,
  SwitchField,
  PhoneNumberField,
  SearchableSelectField,
  type SelectOption,
} from "@/components/form";
import { PasswordRequirements } from "@/lib/password";
import type { UserFormValues } from "@/lib/user-form";
import { type UserModuleMode } from "@/lib/user-module";
import { fetchContractorOptions } from "@/lib/user-dropdowns";
import { ADDRESS_MAX_LENGTH } from "@/lib/field-validation";

export function UserFormFields({
  mode,
  variant,
  disabled = false,
  lookupsLoading = false,
  roleOptions,
  tradeOptions = [],
  cisOptions = [],
  contractorSelectedLabel,
  autoFocusFirstName = false,
}: {
  mode: UserModuleMode;
  variant: "create" | "edit";
  disabled?: boolean;
  lookupsLoading?: boolean;
  roleOptions: SelectOption[];
  tradeOptions?: SelectOption[];
  cisOptions?: SelectOption[];
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

  return (
    <fieldset className="space-y-6" disabled={disabled}>
      <Section
        title="Personal Information"
        headerAction={<SwitchField<UserFormValues> name="isActive" label="Active" />}
      >
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
          <>
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField<UserFormValues> name="startDate" label="Joining Date" type="date" />
              <TextField<UserFormValues> name="endDate" label="Leaving Date" type="date" />
            </div>
          </>
        ) : isUser ? (
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
        ) : isCustomer ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField<UserFormValues> name="dateOfBirth" label="Date of birth" type="date" />
          </div>
        ) : null}
        {isCustomer ? (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SearchableSelectField<UserFormValues>
                name="contractorId"
                label="Contractor"
                placeholder="Select contractor"
                searchPlaceholder="Search contractors…"
                queryKey={["users", "contractors", "dropdown"]}
                selectedLabel={contractorSelectedLabel}
                fetchOptions={fetchContractorOptions}
              />
              <TextField<UserFormValues>
                name="address"
                label="Address"
                maxLength={ADDRESS_MAX_LENGTH}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField<UserFormValues> name="city" label="City" maxLength={100} />
              <TextField<UserFormValues> name="state" label="State" maxLength={100} />
              <TextField<UserFormValues> name="country" label="Country" maxLength={100} />
              <TextField<UserFormValues> name="zipCode" label="ZIP Code" maxLength={20} />
            </div>
          </>
        ) : isContractor ? (
          <>
            <TextField<UserFormValues>
              name="address"
              label="Address"
              maxLength={ADDRESS_MAX_LENGTH}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField<UserFormValues> name="city" label="City" maxLength={100} />
              <TextField<UserFormValues> name="state" label="State" maxLength={100} />
              <TextField<UserFormValues> name="country" label="Country" maxLength={100} />
              <TextField<UserFormValues> name="zipCode" label="ZIP Code" maxLength={20} />
            </div>
          </>
        ) : null}
      </Section>

      {!isOperative && !isContactModule ? (
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
  headerAction,
  children,
}: {
  title: string;
  hint?: string;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="card-elevated space-y-4 p-4 sm:p-6">
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
