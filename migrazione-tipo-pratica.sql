-- Aggiunge ai ticket: tipo di pratica + nome e recapito di chi fa la richiesta.
-- ESEGUI NEL PROGETTO NEON "supporto-dealer" (NON in "segnalazioni": li' la tabella
-- ticket non esiste e il comando fallisce senza fare danni).
-- Sicuro da rilanciare: se le colonne esistono gia' non fa nulla.

ALTER TABLE ticket ADD COLUMN IF NOT EXISTS tipo_pratica         TEXT NOT NULL DEFAULT '';
ALTER TABLE ticket ADD COLUMN IF NOT EXISTS richiedente_nome     TEXT NOT NULL DEFAULT '';
ALTER TABLE ticket ADD COLUMN IF NOT EXISTS richiedente_contatto TEXT NOT NULL DEFAULT '';
