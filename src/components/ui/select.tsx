'use client'

import React, { useState, useRef, useEffect, useId } from 'react'
import { cn } from '@/lib/utils/format'
import { ChevronDown, Search, Check, X } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'options'> {
  label?: string
  error?: string
  placeholder?: string
  searchPlaceholder?: string
  options: readonly { readonly value: string; readonly label: string }[] | { value: string; label: string }[]
  required?: boolean
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      placeholder = '-- Pilih --',
      searchPlaceholder = 'Search for an item...',
      options = [],
      required,
      value,
      defaultValue,
      onChange,
      disabled,
      name,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const selectId = id || generatedId

    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [internalValue, setInternalValue] = useState<string>(
      value !== undefined ? String(value) : defaultValue !== undefined ? String(defaultValue) : ''
    )

    const containerRef = useRef<HTMLDivElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const nativeSelectRef = useRef<HTMLSelectElement | null>(null)

    // Sync with controlled value prop
    useEffect(() => {
      if (value !== undefined) {
        setInternalValue(String(value))
      }
    }, [value])

    // Focus search input when dropdown opens
    useEffect(() => {
      if (isOpen) {
        setSearchTerm('')
        const timer = setTimeout(() => {
          searchInputRef.current?.focus()
        }, 50)
        return () => clearTimeout(timer)
      }
    }, [isOpen])

    // Close on click outside or escape
    useEffect(() => {
      if (!isOpen) return

      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setIsOpen(false)
        }
      }

      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }, [isOpen])

    const selectedOption = options.find((opt) => String(opt.value) === String(internalValue))

    const filteredOptions = options.filter((opt) =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opt.value.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleSelectOption = (optValue: string) => {
      setInternalValue(optValue)
      setIsOpen(false)

      if (nativeSelectRef.current) {
        nativeSelectRef.current.value = optValue
        const event = new Event('change', { bubbles: true })
        nativeSelectRef.current.dispatchEvent(event)
      }

      if (onChange) {
        const syntheticEvent = {
          target: { name: name || '', value: optValue },
          currentTarget: { name: name || '', value: optValue },
        } as unknown as React.ChangeEvent<HTMLSelectElement>
        onChange(syntheticEvent)
      }
    }

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation()
      handleSelectOption('')
    }

    return (
      <div className="w-full flex flex-col gap-1.5" ref={containerRef}>
        {label && (
          <label htmlFor={selectId} className="text-xs font-bold uppercase tracking-wider text-brand-muted">
            {label}
            {required && <span className="text-sport-orange ml-0.5">*</span>}
          </label>
        )}

        <div className="relative">
          {/* Hidden native select for standard HTML form submission, accessibility, and react-hook-form integration */}
          <select
            id={selectId}
            name={name}
            value={internalValue}
            onChange={(e) => {
              setInternalValue(e.target.value)
              onChange?.(e)
            }}
            disabled={disabled}
            required={required}
            className="sr-only pointer-events-none absolute -z-10 opacity-0 h-0 w-0"
            tabIndex={-1}
            ref={(node) => {
              nativeSelectRef.current = node
              if (typeof ref === 'function') {
                ref(node)
              } else if (ref) {
                ref.current = node
              }
            }}
            {...props}
          >
            <option value="">{placeholder}</option>
            {options.map((opt, idx) => (
              <option key={`${opt.value}-${idx}`} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Trigger Button */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setIsOpen((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            className={cn(
              'w-full min-h-[46px] px-4 py-2.5 bg-white border border-card-border rounded-xl text-sm text-slate-800 flex items-center justify-between gap-2 text-left transition-all duration-150 shadow-sm',
              'hover:border-sport-orange/60 focus:outline-none focus:border-sport-orange focus:ring-1 focus:ring-sport-orange/30',
              isOpen && 'border-sport-orange ring-1 ring-sport-orange/30',
              disabled && 'opacity-50 cursor-not-allowed bg-slate-100 hover:border-card-border',
              error && 'border-sport-red/50 focus:border-sport-red focus:ring-sport-red/20',
              className
            )}
          >
            <span className={cn('truncate block flex-1 font-medium', !selectedOption ? 'text-slate-400' : 'text-slate-800')}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>

            <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
              {selectedOption && !disabled && (
                <span
                  role="button"
                  onClick={handleClear}
                  className="p-0.5 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                  title="Hapus pilihan"
                >
                  <X className="w-3.5 h-3.5" />
                </span>
              )}
              <ChevronDown
                className={cn('w-4 h-4 transition-transform duration-200 text-slate-400', isOpen && 'rotate-180 text-sport-orange')}
              />
            </div>
          </button>

          {/* Dropdown Popover */}
          {isOpen && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
              {/* Search Input Box */}
              <div className="p-2 border-b border-slate-100 bg-slate-50/80">
                <div className="relative flex items-center">
                  <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-sport-orange focus:ring-1 focus:ring-sport-orange/30 transition-all shadow-inner"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Options List */}
              <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5" role="listbox">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((opt, idx) => {
                    const isSelected = String(opt.value) === String(internalValue)
                    return (
                      <button
                        key={`${opt.value}-${idx}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelectOption(opt.value)}
                        className={cn(
                          'w-full px-3 py-2.5 rounded-lg text-xs text-left flex items-center justify-between gap-2 transition-all cursor-pointer font-medium',
                          isSelected
                            ? 'bg-orange-50 text-sport-orange font-bold'
                            : 'text-slate-700 hover:bg-slate-100 hover:text-sport-orange'
                        )}
                      >
                        <span className="truncate">{opt.label}</span>
                        {isSelected && <Check className="w-4 h-4 shrink-0 text-sport-orange" />}
                      </button>
                    )
                  })
                ) : (
                  <div className="px-3 py-6 text-center text-xs text-slate-400">
                    Tidak ada hasil untuk &quot;{searchTerm}&quot;
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {error && <span className="text-xs text-sport-red font-medium">{error}</span>}
      </div>
    )
  }
)

Select.displayName = 'Select'
