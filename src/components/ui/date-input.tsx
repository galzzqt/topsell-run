'use client'

import React, { useEffect, useRef, useId } from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils/format'
import { isoToDisplay, displayToIso, formatDateInput } from '@/lib/utils/date'

interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'> {
  label?: string
  error?: string
  value?: string
  onChange?: (value: string) => void
  required?: boolean
}

function todayIso() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, label, error, value, onChange, placeholder = 'DD/MM/YYYY', disabled, id, onBlur, required, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState('')
    const pickerRef = useRef<HTMLInputElement>(null)
    const generatedId = useId()
    const inputId = id || generatedId

    useEffect(() => {
      setDisplayValue(value ? isoToDisplay(value) : '')
    }, [value])

    const emitIso = (isoDate: string) => {
      if (isoDate && onChange) {
        onChange(isoDate)
      }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatDateInput(e.target.value)
      setDisplayValue(formatted)

      const digits = e.target.value.replace(/\D/g, '')
      if (digits.length === 8) {
        const isoDate = displayToIso(formatted)
        if (isoDate) {
          emitIso(isoDate)
        }
      } else if (formatted === '') {
        onChange?.('')
      }
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const digits = displayValue.replace(/\D/g, '')
      if (digits.length === 8) {
        const isoDate = displayToIso(displayValue)
        if (isoDate) {
          emitIso(isoDate)
        }
      }
      onBlur?.(e)
    }


    const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const isoDate = e.target.value
      if (!isoDate) {
        setDisplayValue('')
        onChange?.('')
        return
      }
      setDisplayValue(isoToDisplay(isoDate))
      emitIso(isoDate)
    }

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-bold uppercase tracking-wider text-brand-muted">
            {label}{required && <span className="text-sport-orange ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type="text"
            inputMode="numeric"
            autoComplete="bday"
            disabled={disabled}
            className={cn(
              'w-full px-4 py-3 pr-11 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground placeholder:text-brand-muted/70 focus:outline-none focus:border-sport-orange focus:ring-1 focus:ring-sport-orange/30 transition-all duration-150',
              error && 'border-sport-red/50 focus:border-sport-red focus:ring-sport-red/20',
              className
            )}
            value={displayValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            maxLength={10}
            {...props}
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center">
            {/* Visual calendar icon button */}
            <div className="p-1.5 rounded-md text-brand-muted hover:text-sport-orange transition-colors pointer-events-none">
              <Calendar className="w-4 h-4" />
            </div>
            {/* Native date picker input overlay that directly captures touch on mobile & click on desktop */}
            <input
              ref={pickerRef}
              type="date"
              value={value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''}
              min="1900-01-01"
              max={todayIso()}
              onChange={handlePickerChange}
              disabled={disabled}
              aria-label={label || 'Pilih tanggal'}
              title="Pilih tanggal"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:pointer-events-none"
            />
          </div>
        </div>
        {error && <span className="text-xs text-sport-red font-medium">{error}</span>}
      </div>
    )
  }
)

DateInput.displayName = 'DateInput'
