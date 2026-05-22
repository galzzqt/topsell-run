import React from 'react'
import { cn } from '@/lib/utils/format'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-bold uppercase tracking-wider text-brand-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type={type}
          className={cn(
            'w-full px-4 py-3 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground placeholder:text-brand-muted/70 focus:outline-none focus:border-sport-orange focus:ring-1 focus:ring-sport-orange/30 transition-all duration-150',
            error && 'border-sport-red/50 focus:border-sport-red focus:ring-sport-red/20',
            className
          )}
          {...props}
        />
        {error && <span className="text-xs text-sport-red font-medium">{error}</span>}
      </div>
    )
  }
)

Input.displayName = 'Input'
