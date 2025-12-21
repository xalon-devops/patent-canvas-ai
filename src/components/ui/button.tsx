import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /* Default - Solid primary */
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        
        /* Destructive */
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        
        /* Outline - Subtle border */
        outline: "border border-border bg-transparent text-foreground hover:bg-muted hover:border-border",
        
        /* Secondary - Muted background */
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        
        /* Ghost - No background */
        ghost: "text-foreground/70 hover:text-foreground hover:bg-muted",
        
        /* Link - Underline style */
        link: "text-foreground/70 underline-offset-4 hover:underline hover:text-foreground p-0 h-auto",
        
        /* === INSTITUTIONAL VARIANTS === */
        
        /* Primary action - Clean, confident */
        gradient: "bg-primary text-primary-foreground font-medium hover:bg-primary/90",
        
        /* Secondary gradient */
        "gradient-secondary": "bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium hover:opacity-90",
        
        /* Brand variants - Refined */
        xalon: "bg-primary text-primary-foreground font-medium hover:bg-primary/90",
        "xalon-outline": "border border-primary/30 text-primary bg-transparent hover:bg-primary/10 hover:border-primary/50 font-medium",
        "xalon-ghost": "text-primary hover:bg-primary/10 font-medium",
        
        /* Premium glow - Subtle */
        glow: "bg-primary text-primary-foreground font-medium hover:bg-primary/90 shadow-glow",
        
        /* Professional - Clean glass */
        professional: "bg-muted/50 text-foreground border border-border/50 hover:bg-muted hover:border-border font-medium",
        
        /* Patent specific */
        patent: "bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground font-medium",
        
        /* Premium - Subtle elevation */
        premium: "bg-card text-foreground border border-border hover:bg-muted font-medium shadow-card",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-6 text-base",
        xl: "h-14 rounded-lg px-8 text-base",
        icon: "h-10 w-10 rounded-lg",
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