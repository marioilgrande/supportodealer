-- Aggiunge il TIPO DI PRATICA ai ticket (SUBENTRO / SWITCH / SWITCH CON VOLTURA / VOLTURA INTERNA).
-- Esegui una volta nel SQL Editor di Neon, database supporto-dealer.
-- Sicuro da rilanciare: se la colonna esiste gia' non fa nulla.

ALTER TABLE ticket ADD COLUMN IF NOT EXISTS tipo_pratica TEXT NOT NULL DEFAULT '';
