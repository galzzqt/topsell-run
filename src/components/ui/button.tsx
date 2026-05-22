import React from 'react'
import { cn } from '@/lib/utils/format'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  children: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center font-bold tracking-wide uppercase transition-all duration-200 rounded-lg active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
          
          // Variants
          variant === 'primary' && 'bg-gradient-to-r from-sport-red to-sport-orange text-white hover:shadow-lg hover:shadow-sport-orange/20 border-none',
          variant === 'secondary' && 'bg-brand-gray border border-card-border text-foreground hover:bg-card-border',
          variant === 'outline' && 'bg-transparent border border-card-border text-foreground hover:border-sport-orange hover:text-sport-orange',
          variant === 'ghost' && 'bg-transparent text-brand-muted hover:text-foreground hover:bg-brand-gray/50',
          variant === 'danger' && 'bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20',

          // Sizes
          size === 'sm' && 'px-3 py-1.5 text-xs',
          size === 'md' && 'px-5 py-2.5 text-sm',
          size === 'lg' && 'px-7 py-3.5 text-base',

          className
        )}
        {...props}
      >
        {isLoading && (
          <svg className="w-4 h-4 mr-2 animate-spin text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
