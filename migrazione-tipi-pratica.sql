-- ============================================================================
-- TIPI DI PRATICA PER BRAND
-- Esegui nel SQL Editor di Neon (database supporto-dealer), DOPO migrazione-multibrand.sql.
-- Additivo: crea solo una tabella nuova, non tocca nulla di esistente.
-- Serve a non proporre al dealer operazioni che il suo brand non puo' fare
-- (es. su Plenitude il subentro non si puo' lavorare).
-- ============================================================================

CREATE TABLE IF NOT EXISTS tipo_pratica (
  id          TEXT PRIMARY KEY,
  brand       TEXT NOT NULL DEFAULT '',
  nome        TEXT NOT NULL DEFAULT '',
  nota        TEXT NOT NULL DEFAULT '',
  origine     TEXT NOT NULL DEFAULT 'manuale',
  attivo      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tipo_pratica_brand_idx ON tipo_pratica (brand, attivo);
