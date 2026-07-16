-- Esegui una sola volta nel SQL Editor di Neon, dopo aver creato il progetto.

CREATE TABLE IF NOT EXISTS ticket (
  id              BIGSERIAL PRIMARY KEY,
  codice          TEXT NOT NULL DEFAULT '',
  negozio         TEXT NOT NULL DEFAULT '',
  sis_sub         TEXT NOT NULL DEFAULT '',
  agenzia         TEXT NOT NULL DEFAULT '',
  categoria       TEXT NOT NULL DEFAULT '',
  colore          TEXT NOT NULL DEFAULT 'giallo',   -- rosso | giallo | verde
  messaggio       TEXT NOT NULL DEFAULT '',
  risposta_ai     TEXT NOT NULL DEFAULT '',
  esito           TEXT NOT NULL DEFAULT 'in_attesa', -- in_attesa | bastata | non_bastata | intervento_simone
  cf_cliente      TEXT NOT NULL DEFAULT '',
  num_opportunity TEXT NOT NULL DEFAULT '',
  tipo_pratica    TEXT NOT NULL DEFAULT '',   -- SUBENTRO | SWITCH | SWITCH CON VOLTURA | VOLTURA INTERNA
  nota_controllo  TEXT NOT NULL DEFAULT '',
  risposta_ok     BOOLEAN,                           -- validazione admin: risposta AI corretta?
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_created ON ticket(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_colore  ON ticket(colore);
CREATE INDEX IF NOT EXISTS idx_ticket_esito   ON ticket(esito);
