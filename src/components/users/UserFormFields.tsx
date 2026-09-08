import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useFormContext, type FieldErrors } from "react-hook-form";
import {
  TextField,
  PasswordField,
  SwitchField,
  CheckboxField,
  PhoneNumberField,
  CreatableSearchableSelectField,
  SearchableMultiSelectField,
} from "@/components/form";
import { FormFieldHint } from "@/components/form/FormFieldLabel";
import { PasswordRequirements } from "@/lib/password";
import type { UserFormValues } from "@/lib/user-form";
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

type OperativeFormTab = "details" | "trades" | "rates" | "payment" | "certificates";

const OPERATIVE_TABS: { id: OperativeFormTab; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "trades", label: "Trades" },
  { id: "rates", label: "Rates" },
  { id: "payment", label: "Bank & card" },
  { id: "certificates", label: "Certificates" },
];

const OPERATIVE_TAB_FIELDS: Record<OperativeFormTab, (keyof UserFormValues)[]> = {
  details: ["firstName", "lastName", "email", "phone", "password", "dateOfBirth", "startDate"],
  trades: ["tradeIds"],
  rates: ["dailyRate", "cisId", "isDailyRate", "rateOverrides", "rateChangeReason"],
  payment: [
    "accountHolderName",
    "bankName",
    "sortCode",
    "accountNumber",
    "cardHolderName",
    "cardNumber",
    "cardExpiry",
  ],
  certificates: ["certifications"],
};

const TAB_PANEL_CLASS =
  "mt-0 space-y-2 pt-3 focus-visible:outline-none data-[state=inactive]:hidden";

function tabHasError(errors: FieldErrors<UserFormValues>, tab: OperativeFormTab) {
  return OPERATIVE_TAB_FIELDS[tab].some((name) => Boolean(errors[name]));
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
}) {
  const {
    setFocus,
    formState: { errors, submitCount },
  } = useFormContext<UserFormValues>();
  const [tab, setTab] = useState<OperativeFormTab>("details");
  const lastSubmitCount = useRef(0);

  useEffect(() => {
    if (submitCount <= lastSubmitCount.current) return;
    lastSubmitCount.current = submitCount;
    const firstInvalid = OPERATIVE_TABS.find((item) => tabHasError(errors, item.id));
    if (!firstInvalid) return;
    setTab(firstInvalid.id);
    const firstField = OPERATIVE_TAB_FIELDS[firstInvalid.id].find((name) => Boolean(errors[name]));
    if (!firstField) return;
    const frame = requestAnimationFrame(() => {
      setFocus(firstField);
    });
    return () => cancelAnimationFrame(frame);
  }, [errors, setFocus, submitCount]);

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
          <TextField<UserFormValues> name="dateOfBirth" label="Date of birth" type="date" />
        </div>
        <div className="max-w-xs">
          <TextField<UserFormValues> name="startDate" label="Joining Date" type="date" />
        </div>
      </TabsContent>

      <TabsContent value="trades" forceMount className={TAB_PANEL_CLASS}>
        <PanelHint>Trade used on wage sheets and job assignment.</PanelHint>
        <SearchableMultiSelectField<UserFormValues>
          name="tradeIds"
          label="Trades"
          required
          placeholder="Select trades…"
          searchPlaceholder="Search trades…"
          disabled={disabled}
          queryKey={["lookups", "trades"]}
          selectedLabels={operativeSelectedLabels?.trades}
          fetchOptions={fetchTradeOptions}
        />
      </TabsContent>

      <TabsContent value="rates" forceMount className={TAB_PANEL_CLASS}>
        <PanelHint>
          Daily rate and CIS status for pay. Agreed item rates stay within parent budget, or need a
          reason + Rate approvals.
        </PanelHint>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
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
        {canSeeRates ? <RateOverrideFields disabled={disabled} /> : null}
      </TabsContent>

      <TabsContent value="payment" forceMount className={TAB_PANEL_CLASS}>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Bank details
            </p>
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
                maxLength={10}
              />
              <TextField<UserFormValues>
                name="accountNumber"
                label="Account number"
                placeholder="8 digits"
                maxLength={20}
              />
            </div>
          </div>
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Card details
            </p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <TextField<UserFormValues>
                name="cardHolderName"
                label="Cardholder name"
                placeholder="Name on the card"
                maxLength={120}
              />
              <TextField<UserFormValues>
                name="cardNumber"
                label="Card number"
                placeholder="•••• •••• •••• ••••"
                maxLength={25}
                inputMode="numeric"
                autoComplete="cc-number"
              />
              <TextField<UserFormValues>
                name="cardExpiry"
                label="Expiry (MM/YY)"
                placeholder="MM/YY"
                maxLength={5}
                autoComplete="cc-exp"
              />
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="certificates" forceMount className={TAB_PANEL_CLASS}>
        <PanelHint>
          CSCS, asbestos, training and other accreditations with start and expiry dates.
        </PanelHint>
        <OperativeCertificationFields disabled={disabled} />
      </TabsContent>
    </Tabs>
  );
}

function PanelHint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
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
