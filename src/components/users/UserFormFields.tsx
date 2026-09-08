import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useFormContext, useWatch, type FieldErrors } from "react-hook-form";
import {
  TextField,
  PasswordField,
  SwitchField,
  CheckboxField,
  PhoneNumberField,
  CreatableSearchableSelectField,
  CreatableSearchableMultiSelectField,
} from "@/components/form";
import { FormFieldHint } from "@/components/form/FormFieldLabel";
import { PasswordRequirements } from "@/lib/password";
import type { UserFormValues } from "@/lib/user-form";
import { formatAccountNumberInput, formatSortCodeInput } from "@/lib/user-form";
import { type UserModuleMode } from "@/lib/user-module";
import { fetchCisOptions, fetchRoleOptions, fetchTradeOptions } from "@/lib/user-dropdowns";
import { ADDRESS_MAX_LENGTH } from "@/lib/field-validation";
import { UserCapabilityFields } from "@/components/users/UserCapabilityFields";
import { UserMenuPermissionFields } from "@/components/users/UserMenuPermissionFields";
import { RateOverrideFields } from "@/components/rates/RateOverrideFields";
import { OperativeCertificationFields } from "@/components/users/OperativeCertificationFields";
import { usePermissions } from "@/contexts/PermissionContext";
import { CAPABILITY_CODES } from "@/lib/access";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  underlineTabListClass,
  underlineTabTriggerClass,
} from "@/components/ui/tabs";

export type OperativeFormTab = "details" | "rates" | "payment" | "certificates";

export const OPERATIVE_FORM_TABS: { id: OperativeFormTab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "rates", label: "Rates" },
  { id: "payment", label: "Bank" },
  { id: "certificates", label: "Certificates" },
];

const OPERATIVE_TABS = OPERATIVE_FORM_TABS;

const OPERATIVE_TAB_FIELDS: Record<OperativeFormTab, (keyof UserFormValues)[]> = {
  details: [
    "firstName",
    "lastName",
    "email",
    "phone",
    "password",
    "startDate",
    "tradeIds",
  ],
  rates: ["dailyRate", "cisId", "isDailyRate", "rateOverrides", "rateChangeReason"],
  payment: [
    "accountHolderName",
    "bankName",
    "sortCode",
    "accountNumber",
  ],
  certificates: ["certifications"],
};

const TAB_PANEL_CLASS =
  "mt-0 space-y-2 pt-3 focus-visible:outline-none data-[state=inactive]:hidden";

function fieldHasError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error !== "object") return false;
  if ("message" in error && (error as { message?: unknown }).message) return true;
  if ("types" in error) return true;
  if (Array.isArray(error)) return error.some(fieldHasError);
  return Object.values(error as Record<string, unknown>).some(fieldHasError);
}

function tabHasError(errors: FieldErrors<UserFormValues>, tab: OperativeFormTab) {
  return OPERATIVE_TAB_FIELDS[tab].some((name) => fieldHasError(errors[name]));
}

function firstErrorFieldInTab(
  errors: FieldErrors<UserFormValues>,
  tab: OperativeFormTab,
): keyof UserFormValues | null {
  for (const name of OPERATIVE_TAB_FIELDS[tab]) {
    if (fieldHasError(errors[name])) return name;
  }
  return null;
}

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
  capabilityResetKey,
  operativeTab,
  onOperativeTabChange,
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
    trades?: Record<string, string>;
    cis?: string | null;
  };
  contractorSelectedLabel?: string | null;
  autoFocusFirstName?: boolean;
  capabilityResetKey?: string;
  /** Controlled tab for operative create/edit footers (Next). */
  operativeTab?: OperativeFormTab;
  onOperativeTabChange?: (tab: OperativeFormTab) => void;
}) {
  const { watch } = useFormContext<UserFormValues>();
  const { hasCapability } = usePermissions();
  const password = watch("password");
  const isOperative = mode === "operative";
  const isContractor = mode === "contractor";
  const isCustomer = mode === "customer";
  const isUser = mode === "user";
  const isContactModule = isContractor || isCustomer;
  const canSeeRates =
    hasCapability(CAPABILITY_CODES.seeRates) || hasCapability(CAPABILITY_CODES.editTaskPrices);
  const activeToggle =
    showActiveInHeader || !embedded ? (
      <SwitchField<UserFormValues> name="isActive" label="Active" />
    ) : undefined;

  if (isOperative) {
    return (
      <fieldset disabled={disabled}>
        <OperativeFormTabs
          variant={variant}
          disabled={disabled}
          password={password}
          canSeeRates={canSeeRates}
          operativeSelectedLabels={operativeSelectedLabels}
          autoFocusFirstName={autoFocusFirstName}
          activeToggle={activeToggle}
          tab={operativeTab}
          onTabChange={onOperativeTabChange}
        />
      </fieldset>
    );
  }

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <Section title="Personal Information" embedded={embedded} headerAction={activeToggle}>
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
              <TextField<UserFormValues>
                name="lastName"
                label="Last name"
                required
                maxLength={50}
              />
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
              <TextField<UserFormValues>
                name="lastName"
                label="Last name"
                required
                maxLength={50}
              />
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
              <TextField<UserFormValues>
                name="lastName"
                label="Last name"
                required
                maxLength={50}
              />
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
            {isUser ? (
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

      {isCustomer && canSeeRates ? (
        <Section
          title="Rate overrides"
          hint="Leave empty to use standard catalogue rates. Within parent budget saves immediately; above needs a per-item reason + Rate approvals."
          embedded={embedded}
          separated={embedded}
        >
          <RateOverrideFields disabled={disabled} />
        </Section>
      ) : null}

      {!isContactModule ? (
        <Section
          title="Access"
          hint="Roles control screens. Assignments control which projects this user can see."
          embedded={embedded}
          separated={embedded}
        >
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

      {!isContactModule ? (
        <Section
          title="Menu access"
          hint="Override which screens this user can read, change, or delete. Leave the role defaults unless this person needs different access."
          embedded={embedded}
          separated={embedded}
        >
          <UserMenuPermissionFields disabled={disabled} resetKey={capabilityResetKey} />
        </Section>
      ) : null}

      {!isContactModule ? (
        <Section
          title="Rates & commercial"
          hint="Select extra commercial permissions for this user, or remove ones the role would grant."
          embedded={embedded}
          separated={embedded}
        >
          <div className="min-w-0 max-w-full overflow-hidden">
            <UserCapabilityFields disabled={disabled} resetKey={capabilityResetKey} />
          </div>
        </Section>
      ) : null}
    </fieldset>
  );
}

function OperativeFormTabs({
  variant,
  disabled,
  password,
  canSeeRates,
  operativeSelectedLabels,
  autoFocusFirstName,
  activeToggle,
  tab: controlledTab,
  onTabChange,
}: {
  variant: "create" | "edit";
  disabled: boolean;
  password: string;
  canSeeRates: boolean;
  operativeSelectedLabels?: {
    trades?: Record<string, string>;
    cis?: string | null;
  };
  autoFocusFirstName?: boolean;
  activeToggle?: ReactNode;
  tab?: OperativeFormTab;
  onTabChange?: (tab: OperativeFormTab) => void;
}) {
  const {
    setFocus,
    control,
    formState: { errors, submitCount },
  } = useFormContext<UserFormValues>();
  const [uncontrolledTab, setUncontrolledTab] = useState<OperativeFormTab>("details");
  const tab = controlledTab ?? uncontrolledTab;
  const setTab = onTabChange ?? setUncontrolledTab;
  const lastSubmitCount = useRef(0);
  const isDailyRate = useWatch({ control, name: "isDailyRate" });

  useEffect(() => {
    if (submitCount <= lastSubmitCount.current) return;
    lastSubmitCount.current = submitCount;
    const firstInvalid = OPERATIVE_TABS.find((item) => tabHasError(errors, item.id));
    if (!firstInvalid) return;
    setTab(firstInvalid.id);
    const firstField = firstErrorFieldInTab(errors, firstInvalid.id);
    if (!firstField) return;
    const frame = requestAnimationFrame(() => {
      setFocus(firstField);
    });
    return () => cancelAnimationFrame(frame);
  }, [errors, setFocus, setTab, submitCount]);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as OperativeFormTab)}
      className="flex min-w-0 flex-col"
    >
      <div className="-mx-4 -mt-3 min-w-0 overflow-x-auto border-b px-3 sm:-mx-5 sm:px-4">
        <TabsList className={underlineTabListClass}>
          {OPERATIVE_TABS.map((item) => {
            const invalid = submitCount > 0 && tabHasError(errors, item.id);
            return (
              <TabsTrigger
                key={item.id}
                value={item.id}
                className={cn(
                  underlineTabTriggerClass,
                  invalid &&
                    "text-destructive data-[state=active]:border-destructive data-[state=active]:text-destructive",
                )}
              >
                <span className="inline-flex items-center gap-1.5">
                  {item.label}
                  {invalid ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden />
                  ) : null}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      <TabsContent value="details" forceMount className={TAB_PANEL_CLASS}>
        {activeToggle ? <div className="flex justify-end">{activeToggle}</div> : null}
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
          <PhoneNumberField<UserFormValues> name="phone" label="Phone" placeholder="07700 900000" />
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <TextField<UserFormValues> name="startDate" label="Joining Date" type="date" />
          <CreatableSearchableMultiSelectField<UserFormValues>
            name="tradeIds"
            label="Trades"
            description="Trade used on wage sheets and job assignment."
            placeholder="Select trades…"
            searchPlaceholder="Search trades…"
            disabled={disabled}
            queryKey={["lookups", "trades"]}
            selectedLabels={operativeSelectedLabels?.trades}
            fetchOptions={fetchTradeOptions}
            lookupType="trade"
          />
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div className="space-y-2">
            <PasswordField<UserFormValues>
              name="password"
              label="Password"
              required={variant === "create"}
              autoComplete="new-password"
              placeholder={variant === "edit" ? "Leave blank to keep current password" : undefined}
            />
            {(variant === "create" || password) && <PasswordRequirements password={password} />}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="rates" forceMount className={TAB_PANEL_CLASS}>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <TextField<UserFormValues>
            name="dailyRate"
            label="Daily rate (£)"
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
          />
          <CreatableSearchableSelectField<UserFormValues>
            name="cisId"
            label="CIS"
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
        {canSeeRates && isDailyRate ? <RateOverrideFields disabled={disabled} /> : null}
      </TabsContent>

      <TabsContent value="payment" forceMount className={TAB_PANEL_CLASS}>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <TextField<UserFormValues>
            name="accountHolderName"
            label="Account holder name"
            placeholder="Name on the account"
            maxLength={120}
          />
          <TextField<UserFormValues>
            name="bankName"
            label="Bank name"
            placeholder="Optional"
            maxLength={100}
          />
          <TextField<UserFormValues>
            name="sortCode"
            label="Sort code"
            placeholder="12-34-56"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            transformValue={formatSortCodeInput}
          />
          <TextField<UserFormValues>
            name="accountNumber"
            label="Account number"
            placeholder="8 digits"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            transformValue={formatAccountNumberInput}
          />
        </div>
      </TabsContent>

      <TabsContent value="certificates" forceMount className={TAB_PANEL_CLASS}>
        <OperativeCertificationFields disabled={disabled} />
      </TabsContent>
    </Tabs>
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
  const heading = (
    <div className="flex min-w-0 items-center gap-1.5">
      <h3 className={cn("font-display font-semibold", embedded && "text-sm")}>{title}</h3>
      {hint ? <FormFieldHint description={hint} /> : null}
    </div>
  );

  if (embedded) {
    return (
      <div className={cn("space-y-2", separated && "border-t border-border pt-3")}>
        <div className="flex items-center justify-between gap-2">
          {heading}
          {headerAction}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="card-elevated space-y-2 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        {heading}
        {headerAction}
      </div>
      {children}
    </div>
  );
}
