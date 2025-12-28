import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /* Default - Premium solid primary */
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_2px_8px_hsl(var(--primary)/0.25)] hover:shadow-[0_4px_16px_hsl(var(--primary)/0.35)] hover:-translate-y-0.5",
        
        /* Destructive */
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[0_2px_8px_hsl(var(--destructive)/0.25)]",
        
        /* Outline - Refined border */
        outline: "border border-border bg-card text-foreground hover:bg-muted hover:border-primary/30 shadow-sm hover:shadow-md hover:-translate-y-0.5",
        
        /* Secondary - Muted background */
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm",
        
        /* Ghost - No background */
        ghost: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
        
        /* Link - Underline style */
        link: "text-primary underline-offset-4 hover:underline p-0 h-auto font-medium",
        
        /* === PREMIUM VARIANTS === */
        
        /* Gradient - Hero buttons */
        gradient: "bg-gradient-to-r from-primary to-accent text-white font-semibold shadow-[0_4px_16px_hsl(var(--primary)/0.35)] hover:shadow-[0_8px_24px_hsl(var(--primary)/0.45)] hover:-translate-y-1",
        
        /* Secondary gradient */
        "gradient-secondary": "bg-gradient-to-r from-primary/80 to-accent/80 text-white font-medium hover:from-primary hover:to-accent",
        
        /* Brand variants */
        xalon: "bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-[0_2px_8px_hsl(var(--primary)/0.25)]",
        "xalon-outline": "border-2 border-primary/30 text-primary bg-primary/5 hover:bg-primary hover:text-white hover:border-primary font-semibold transition-all",
        "xalon-ghost": "text-primary hover:bg-primary/10 font-medium",
        
        /* Glow effect */
        glow: "bg-primary text-primary-foreground font-semibold shadow-[0_0_20px_hsl(var(--primary)/0.4),0_4px_12px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.5),0_8px_20px_hsl(var(--primary)/0.4)]",
        
        /* Professional - Glass style */
        professional: "bg-card/80 backdrop-blur-sm text-foreground border border-border/50 hover:bg-card hover:border-primary/30 font-medium shadow-sm hover:shadow-md",
        
        /* Patent specific */
        patent: "bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-white font-semibold transition-all",
        
        /* Premium card style */
        premium: "bg-card text-foreground border border-border/60 hover:border-primary/30 font-medium shadow-md hover:shadow-lg hover:-translate-y-0.5",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-lg px-4 text-xs",
        lg: "h-12 rounded-xl px-7 text-base",
        xl: "h-14 rounded-xl px-8 text-base",
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