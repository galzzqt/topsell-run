/**
 * Convert ISO date format (YYYY-MM-DD) to display format (DD/MM/YYYY)
 */
export function isoToDisplay(isoDate: string): string {
  if (!isoDate) return ''
  const [year, month, day] = isoDate.split('-')
  if (!year || !month || !day) return ''
  return `${day}/${month}/${year}`
}

/**
 * Convert display format (DD/MM/YYYY) to ISO date format (YYYY-MM-DD)
 */
export function displayToIso(displayDate: string): string {
  if (!displayDate) return ''
  const parts = displayDate.split('/')
  if (parts.length !== 3) return ''
  
  const [day, month, year] = parts
  if (!day || !month || !year) return ''
  
  // Basic validation
  const dayNum = parseInt(day, 10)
  const monthNum = parseInt(month, 10)
  const yearNum = parseInt(year, 10)
  
  if (dayNum < 1 || dayNum > 31) return ''
  if (monthNum < 1 || monthNum > 12) return ''
  if (yearNum < 1900 || yearNum > 2100) return ''
  
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

/**
 * Format date input as DD/MM/YYYY while typing
 */
export function formatDateInput(input: string): string {
  const digits = input.replace(/\D/g, '') // Remove non-digits
  
  // Limit to 8 digits (DDMMYYYY)
  const limited = digits.substring(0, 8)
  
  // Format as DD/MM/YYYY
  let formatted = ''
  if (limited.length > 0) {
    formatted = limited.substring(0, 2) // DD
    if (limited.length >= 3) {
      formatted += '/' + limited.substring(2, 4) // MM
    }
    if (limited.length >= 5) {
      formatted += '/' + limited.substring(4, 8) // YYYY
    }
  }
  
  return formatted
}
