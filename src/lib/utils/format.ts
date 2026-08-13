import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)
}

export function formatDate(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function generateRandomReference(prefix = 'PAY'): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

/**
 * Returns current timestamp formatted in Asia/Jakarta (UTC+7 / WIB) as 'YYYY-MM-DDTHH:mm'
 */
export function getWibNowString(): string {
  const d = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)

  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00'
  const year = getPart('year')
  const month = getPart('month')
  const day = getPart('day')
  let hour = getPart('hour')
  if (hour === '24') hour = '00'
  const minute = getPart('minute')

  return `${year}-${month}-${day}T${hour}:${minute}`
}
