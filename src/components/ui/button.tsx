import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

/*
 * Botões da identidade "Caderno quadriculado":
 * - default: grafite com sombra carimbada de marca-texto, que "afunda" ao clicar.
 * - outline: papel branco com borda grafite.
 * - destructive: caneta vermelha.
 */
const baseButtonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border-[1.5px] border-transparent text-sm font-medium whitespace-nowrap transition-[transform,box-shadow,background-color,color] duration-100 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground shadow-[3px_3px_0_var(--mark)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_var(--mark)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_var(--mark)]",
        outline:
          "border-foreground bg-card text-foreground hover:bg-secondary aria-expanded:bg-secondary",
        secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-secondary aria-expanded:bg-secondary",
        destructive:
          "border-pen bg-card text-pen hover:bg-pen hover:text-white focus-visible:ring-pen/30",
        link: "text-foreground underline decoration-mark decoration-[3px] underline-offset-4 hover:decoration-foreground",
      },
      size: {
        default: "h-9 gap-1.5 px-3.5",
        xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-2.5 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 text-[0.95rem]",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/** Classes do botão já mescladas, para uso também em links (`<Link className={buttonVariants()}>`). */
function buttonVariants(...args: Parameters<typeof baseButtonVariants>) {
  return cn(baseButtonVariants(...args));
}

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof baseButtonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}

export { Button, buttonVariants };
