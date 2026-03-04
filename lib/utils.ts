import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalize date strings to MM/DD/YYYY format.
 * Handles: MM/DD/YY, MM/DD/YYYY, and date ranges like "MM/DD/YYYY-MM/DD/YYYY".
 */
export function normalizeDate(dateStr: string): string {
  if (!dateStr) return dateStr

  // Handle date ranges (e.g., "05/18/2025-05/18/2025")
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-').map(part => normalizeSingleDate(part.trim()))
    // Collapse range to single date if start and end are the same
    if (parts.length === 2 && parts[0] === parts[1]) {
      return parts[0]
    }
    return parts.join('-')
  }

  return normalizeSingleDate(dateStr.trim())
}

function normalizeSingleDate(dateStr: string): string {
  // Match MM/DD/YY or MM/DD/YYYY
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!match) return dateStr

  const [, month, day, yearStr] = match
  let year = parseInt(yearStr, 10)

  // Convert 2-digit year to 4-digit
  if (yearStr.length === 2) {
    // Assume 00-99 maps to 2000-2099
    year = 2000 + year
  }

  return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`
}
