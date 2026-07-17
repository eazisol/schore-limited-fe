import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      visibleToasts={3}
      expand={false}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "bg-success/10 text-success border-success/30 [&_[data-icon]]:text-success",
          error:
            "bg-destructive/10 text-destructive border-destructive/30 [&_[data-icon]]:text-destructive",
          warning:
            "bg-destructive/10 text-destructive border-destructive/30 [&_[data-icon]]:text-destructive",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
