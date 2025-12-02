import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

/**
 * Get user's timezone from device
 */
export const getUserTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Get current date/time in user's timezone
 */
export const getCurrentDate = (): Date => {
  return new Date();
};

/**
 * Get current year
 */
export const getCurrentYear = (): number => {
  return new Date().getFullYear();
};

/**
 * Parse a date string safely (handles ISO strings from database)
 */
export const parseDate = (dateString: string | null | undefined): Date | null => {
  if (!dateString) return null;
  const date = parseISO(dateString);
  return isValid(date) ? date : null;
};

/**
 * Format date with consistent styling - displays in user's local timezone
 * @param dateInput - Date object or ISO string
 * @param formatStr - date-fns format string
 */
export const formatDate = (
  dateInput: Date | string | null | undefined,
  formatStr: string = 'MMM d, yyyy'
): string => {
  if (!dateInput) return 'N/A';
  
  const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
  
  if (!isValid(date)) return 'Invalid date';
  
  return format(date, formatStr);
};

/**
 * Format date with time - displays in user's local timezone
 */
export const formatDateTime = (
  dateInput: Date | string | null | undefined
): string => {
  return formatDate(dateInput, 'MMM d, yyyy h:mm a');
};

/**
 * Format date short (month/day only)
 */
export const formatDateShort = (
  dateInput: Date | string | null | undefined
): string => {
  return formatDate(dateInput, 'MMM d');
};

/**
 * Format date for admin views (includes time)
 */
export const formatDateAdmin = (
  dateInput: Date | string | null | undefined
): string => {
  return formatDate(dateInput, 'MMM d, yyyy HH:mm');
};

/**
 * Format date for patent documents
 */
export const formatDatePatent = (
  dateInput: Date | string | null | undefined
): string => {
  return formatDate(dateInput, 'MMMM d, yyyy');
};

/**
 * Format month/year only
 */
export const formatMonthYear = (
  dateInput: Date | string | null | undefined
): string => {
  return formatDate(dateInput, 'MMM yyyy');
};

/**
 * Format relative time (e.g., "2 hours ago")
 */
export const formatRelativeTime = (
  dateInput: Date | string | null | undefined
): string => {
  if (!dateInput) return 'N/A';
  
  const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
  
  if (!isValid(date)) return 'Invalid date';
  
  return formatDistanceToNow(date, { addSuffix: true });
};

/**
 * Get ISO string for current time (for database operations)
 */
export const getCurrentISOString = (): string => {
  return new Date().toISOString();
};

/**
 * Calculate years remaining (e.g., for patent expiration)
 */
export const calculateYearsRemaining = (
  startDate: Date | string | null | undefined,
  totalYears: number = 20
): number => {
  if (!startDate) return 0;
  
  const date = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  if (!isValid(date)) return 0;
  
  const now = new Date();
  const yearsElapsed = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365);
  return Math.max(0, Math.floor(totalYears - yearsElapsed));
};

/**
 * Get display timezone name
 */
export const getTimezoneDisplay = (): string => {
  const timezone = getUserTimezone();
  try {
    const formatter = new Intl.DateTimeFormat('en', { 
      timeZoneName: 'short',
      timeZone: timezone 
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    return tzPart?.value || timezone;
  } catch {
    return timezone;
  }
};
