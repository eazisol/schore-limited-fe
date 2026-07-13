import { FormProvider, type FieldValues, type UseFormReturn } from "react-hook-form";
import type { FormHTMLAttributes, ReactNode } from "react";

export interface FormProps<T extends FieldValues>
  extends Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit"> {
  form: UseFormReturn<T>;
  onSubmit: (values: T) => void | Promise<void>;
  children: ReactNode;
}

/** Thin wrapper around react-hook-form's FormProvider + <form>. */
export function Form<T extends FieldValues>({ form, onSubmit, children, ...rest }: FormProps<T>) {
  return (
    <FormProvider {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} {...rest}>
        {children}
      </form>
    </FormProvider>
  );
}
