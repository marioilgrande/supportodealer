import { neon } from '@neondatabase/serverless';

// Connessione al DB Neon (stringa in DATABASE_URL, nelle env di Vercel).
export const sql = neon(process.env.DATABASE_URL);

// Genera un codice ticket leggibile tipo #DLR-000123
export function codiceTicket(id) {
  return 'DLR-' + String(id).padStart(6, '0');
}
