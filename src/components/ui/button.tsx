import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium outline-none select-none disabled:pointer-events-none disabled:opacity-40 transition-[opacity,transform,background-color,color,border-color] duration-150 ease-out active:not-disabled:scale-[0.96] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
  {
    variants: {
      variant: {
        primary:
          "bg-fg text-bg hover:opacity-90",
        ghost:
          "bg-transparent text-fg-muted hover:text-fg hover:bg-fg/6",
        pill: "bg-fg text-bg hover:opacity-90 rounded-full",
        outline:
          "border border-border bg-transparent text-fg hover:bg-fg/6",
        quiet:
          "bg-fg/8 text-fg hover:bg-fg/12 border border-border",
      },
      size: {
        sm: "h-8 px-3 text-sm rounded-[var(--radius-sm)]",
        md: "h-10 px-4 text-sm rounded-[var(--radius-md)]",
        icon: "size-10 rounded-full",
        iconSm: "size-8 rounded-full",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>
>(({ className, variant, size, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(buttonVariants({ variant, size }), className)}
    {...props}
  />
));
Button.displayName = "Button";
