const TZ = 'America/Bogota';

/** Returns today's date as YYYY-MM-DD in Bogotá timezone */
export function todayBogota(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

/** Formats a YYYY-MM-DD date string as a long date in Spanish */
export function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: TZ,
  }).format(new Date(dateString + 'T12:00:00'));
}

/** Alias for formatDate */
export const formatDateLong = formatDate;

/** Formats an ISO timestamp as date+time in Spanish */
export function formatDateTime(dateString: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  }).format(new Date(dateString));
}
