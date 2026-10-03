-- ============================================================================
-- SUPPORTO DEALER MULTI-BRAND  (Plenitude / Sorgenia / Alperia)
-- Esegui nel SQL Editor di Neon, database supporto-dealer.
-- Additivo: aggiunge colonne e tabelle, NON tocca lo storico delle richieste.
-- I contenuti ACEA vengono rimossi dallo script di import (import-brand.sql).
-- ============================================================================

-- 1) Procedure: brand + contenuto a blocchi (tabelle, note, elenchi, link)
ALTER TABLE procedura ADD COLUMN IF NOT EXISTS brand       TEXT    NOT NULL DEFAULT '';
ALTER TABLE procedura ADD COLUMN IF NOT EXISTS sottotitolo TEXT    NOT NULL DEFAULT '';
ALTER TABLE procedura ADD COLUMN IF NOT EXISTS etichetta   TEXT    NOT NULL DEFAULT '';
ALTER TABLE procedura ADD COLUMN IF NOT EXISTS blocchi     JSONB   NOT NULL DEFAULT '[]'::jsonb;
-- origine: 'sync' = arriva dai portali info-utili (lo script la riscrive)
--          'manuale' = aggiunta da Mario dal pannello (lo script NON la tocca)
ALTER TABLE procedura ADD COLUMN IF NOT EXISTS origine     TEXT    NOT NULL DEFAULT 'manuale';

-- 2) Offerte: brand e segmento (domestico / business)
ALTER TABLE offerta ADD COLUMN IF NOT EXISTS brand    TEXT NOT NULL DEFAULT '';
ALTER TABLE offerta ADD COLUMN IF NOT EXISTS segmento TEXT NOT NULL DEFAULT '';
ALTER TABLE offerta ADD COLUMN IF NOT EXISTS origine  TEXT NOT NULL DEFAULT 'manuale';

-- 3) Contatti per brand (sostituiscono il Dealer Support ACEA e i codici SIS/SUB)
CREATE TABLE IF NOT EXISTS contatto (
  id          TEXT PRIMARY KEY,
  brand       TEXT NOT NULL DEFAULT '',
  area        TEXT NOT NULL DEFAULT '',
  ufficio     TEXT NOT NULL DEFAULT '',
  richieste   TEXT NOT NULL DEFAULT '',
  tel         TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  orari       TEXT NOT NULL DEFAULT '',
  link        TEXT NOT NULL DEFAULT '',
  nota        TEXT NOT NULL DEFAULT '',
  origine     TEXT NOT NULL DEFAULT 'manuale',
  attivo      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4) Il brand della richiesta, per lo storico e le statistiche
ALTER TABLE ticket ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT '';

-- 5) Indici per le letture piu' frequenti
CREATE INDEX IF NOT EXISTS procedura_brand_idx ON procedura (brand, attiva);
CREATE INDEX IF NOT EXISTS offerta_brand_idx   ON offerta   (brand, attiva);
CREATE INDEX IF NOT EXISTS contatto_brand_idx  ON contatto  (brand, attivo);
