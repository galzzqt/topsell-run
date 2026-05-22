import React from 'react'
import { cn } from '@/lib/utils/format'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  placeholder?: string
  options: { value: string; label: string }[]
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, placeholder, options, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-bold uppercase tracking-wider text-brand-muted">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              'w-full px-4 py-3 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground focus:outline-none focus:border-sport-orange focus:ring-1 focus:ring-sport-orange/30 appearance-none cursor-pointer transition-all duration-150',
              error && 'border-sport-red/50 focus:border-sport-red focus:ring-sport-red/20',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled style={{ color: '#64748b', backgroundColor: '#ffffff' }}>
                {placeholder}
              </option>
            )}
            {options.map((opt, idx) => (
              <option
                key={`${opt.value}-${idx}`}
                value={opt.value}
                style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
              >
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-brand-muted">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {error && <span className="text-xs text-sport-red font-medium">{error}</span>}
      </div>
    )
  }
)

Select.displayName = 'Select'
