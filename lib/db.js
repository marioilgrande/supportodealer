import { neon } from '@neondatabase/serverless';

// Connessione al DB Neon (stringa in DATABASE_URL, nelle env di Vercel).
// Se la variabile manca non solleviamo un errore all'import: così il modulo si carica
// comunque e chi interroga il DB riceve un errore gestibile (e può usare il fallback).
function nonConfigurato() {
  throw new Error('DATABASE_URL non configurata');
}

export const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : nonConfigurato;

// Genera un codice ticket leggibile tipo #DLR-000123
export function codiceTicket(id) {
  return 'DLR-' + String(id).padStart(6, '0');
}
