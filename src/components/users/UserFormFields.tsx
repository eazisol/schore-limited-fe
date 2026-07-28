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

const CONTACT_FIELD_MAX = 30;

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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SwitchField<UserFormValues>
                name="isActive"
                label="Active"
              />
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
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField<UserFormValues> name="dateOfBirth" label="Date of birth" type="date" />
            {isCustomer ? (
              <SwitchField<UserFormValues>
                name="isActive"
                label="Active"
              />
            ) : null}
          </div>
        )}
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

      {isContactModule ? (
        <Section title={isContractor ? "Contractor" : "Customer"}>
          {isCustomer ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField<UserFormValues>
                name="contactName"
                label="Contact name"
                required
                maxLength={CONTACT_FIELD_MAX}
              />
              <SearchableSelectField<UserFormValues>
                name="contractorId"
                label="Contractor"
                required
                placeholder="Select contractor"
                searchPlaceholder="Search contractors…"
                queryKey={["users", "contractors", "dropdown"]}
                selectedLabel={contractorSelectedLabel}
                fetchOptions={fetchContractorOptions}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField<UserFormValues>
                name="contactName"
                label="Contact name"
                required
                maxLength={CONTACT_FIELD_MAX}
              />
              <TextField<UserFormValues>
                name="address"
                label="Address"
                maxLength={CONTACT_FIELD_MAX}
              />
            </div>
          )}
          {isCustomer ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <TextField<UserFormValues>
                  name="address"
                  label="Address"
                  maxLength={CONTACT_FIELD_MAX}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField<UserFormValues> name="state" label="State" maxLength={100} />
                  <TextField<UserFormValues> name="country" label="Country" maxLength={100} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField<UserFormValues> name="zipCode" label="Zip code" maxLength={20} />
                <TextField<UserFormValues> name="city" label="City" maxLength={100} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField<UserFormValues> name="zipCode" label="Zip code" maxLength={20} />
              <TextField<UserFormValues> name="city" label="City" maxLength={100} />
              <TextField<UserFormValues> name="state" label="State" maxLength={100} />
              <TextField<UserFormValues> name="country" label="Country" maxLength={100} />
            </div>
          )}
          {isContractor ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SwitchField<UserFormValues>
                name="isActive"
                label="Active"
              />
            </div>
          ) : null}
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
