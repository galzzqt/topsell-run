import React from 'react'
import { cn } from '@/lib/utils/format'

interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  className?: string
  children: React.ReactNode
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', className, children }) => {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider',
        variant === 'success' && 'bg-green-500/10 text-green-400 border border-green-500/25',
        variant === 'warning' && 'bg-amber-500/10 text-amber-400 border border-amber-500/25',
        variant === 'danger' && 'bg-red-500/10 text-red-400 border border-red-500/25',
        variant === 'info' && 'bg-blue-500/10 text-blue-400 border border-blue-500/25',
        variant === 'neutral' && 'bg-brand-gray text-brand-muted border border-card-border',
        className
      )}
    >
      {children}
    </span>
  )
}
