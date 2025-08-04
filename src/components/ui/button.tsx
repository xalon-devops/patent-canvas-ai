import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transform-gpu",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]",
        destructive: "bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]",
        outline: "border border-input bg-background/50 backdrop-blur-sm shadow-sm hover:bg-accent hover:text-accent-foreground hover:scale-[1.02] active:scale-[0.98]",
        secondary: "bg-secondary text-secondary-foreground shadow-md hover:bg-secondary/80 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]",
        ghost: "hover:bg-accent hover:text-accent-foreground hover:scale-[1.02] active:scale-[0.98]",
        link: "text-primary underline-offset-4 hover:underline hover:scale-[1.02] active:scale-[0.98] hover:text-xalon-cyan-light transition-fast",
        
        /* XALON Premium Brand Variants */
        gradient: "bg-gradient-primary text-white shadow-elegant hover:shadow-glow hover:scale-105 active:scale-95 transition-all duration-300 font-semibold",
        "gradient-secondary": "bg-gradient-secondary text-white shadow-elegant hover:shadow-accent hover:scale-105 active:scale-95 transition-all duration-300 font-semibold",
        xalon: "bg-xalon-cyan text-xalon-dark shadow-md hover:bg-xalon-cyan-light hover:shadow-primary hover:scale-105 active:scale-95 transition-all duration-200 font-semibold",
        "xalon-outline": "border-2 border-xalon-cyan text-xalon-cyan bg-transparent backdrop-blur-sm hover:bg-xalon-cyan hover:text-xalon-dark hover:shadow-primary hover:scale-105 active:scale-95 transition-all duration-200 font-semibold",
        "xalon-ghost": "text-xalon-cyan hover:bg-xalon-cyan/10 hover:text-xalon-cyan-light hover:scale-[1.02] active:scale-[0.98] transition-all duration-200",
        glow: "bg-gradient-glow text-white shadow-glow hover:shadow-glow/80 hover:scale-105 active:scale-95 transition-all duration-300 border-0 font-semibold animate-pulse-glow",
        
        /* Professional variants */
        professional: "glass text-foreground hover:bg-white/10 hover:shadow-glow/20 hover:scale-[1.02] active:scale-[0.98] font-medium transition-all duration-200",
        patent: "bg-primary/10 backdrop-blur-sm text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground hover:shadow-elegant hover:scale-[1.02] active:scale-[0.98] transition-all duration-200",
        premium: "bg-gradient-card text-white shadow-glow hover:shadow-glow/80 hover:scale-105 active:scale-95 font-semibold border border-white/10 backdrop-blur-sm transition-all duration-300",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-2xl px-8 text-base font-semibold",
        xl: "h-14 rounded-2xl px-10 text-lg font-semibold",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
