-- CONTENUTI MODIFICABILI SENZA DEPLOY
-- Esegui UNA VOLTA nel SQL Editor di Neon (database supporto-dealer).
-- Crea le tabelle procedure/offerte e le riempie con i contenuti attuali.

CREATE TABLE IF NOT EXISTS procedura (
  id          TEXT PRIMARY KEY,
  titolo      TEXT NOT NULL DEFAULT '',
  keywords    TEXT NOT NULL DEFAULT '',     -- parole chiave separate da virgola
  tipo        TEXT NOT NULL DEFAULT 'text', -- text | link
  risposta    TEXT NOT NULL DEFAULT '',
  url         TEXT NOT NULL DEFAULT '',
  attiva      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offerta (
  id          BIGSERIAL PRIMARY KEY,
  nome        TEXT NOT NULL DEFAULT '',
  tipo        TEXT NOT NULL DEFAULT '',
  scadenza    TEXT NOT NULL DEFAULT '',
  durata      TEXT NOT NULL DEFAULT '',
  luce        TEXT NOT NULL DEFAULT '',
  gas         TEXT NOT NULL DEFAULT '',
  comm        TEXT NOT NULL DEFAULT '',
  attiva      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO procedura (id, titolo, keywords, tipo, risposta, url, attiva, sort_order) VALUES
('link-firma-otp-conferma', 'Link firma OTP / conferma (PDC o Subentro)', 'otp,firma,link firma,conferma,touch point,accettazione', 'text', 'Per risalire al link di firma/conferma (PDC o Subentro):
1. Apri “Altre Prestazioni”
2. Clicca su “Search for Consumer”
3. Inserisci i dati fiscali del cliente
4. Seleziona l’anagrafica
5. Clicca sul nome del cliente (in blu)
6. Vai nella scheda “Documenti”
7. Guarda la sezione “Touch Point”
8. Clicca sul codice “FM…” corrispondente all’offertazione
9. Clicca sul link per procedere con l’accettazione, oppure invialo al cliente.', '', TRUE, 0),
('inserire-offerta-a-carrello', 'Inserire offerta a carrello (associazione punti prodotti)', 'carrello,associazione punti,monorario,offerta a carrello', 'text', 'Per inserire l’offerta a carrello (associazione punti prodotti):
1. CONFIGURA
2. Clicca su CHIAVE
3. SELEZIONA → ASSOCIAZIONE PUNTI PRODOTTI
4. Inserisci offerta luce e gas cliccando sul pallino corrispondente
5. SALVA
6. Clicca sulla chiave inglese
7. Clicca sul pallino prezzo MONORARIO
8. SALVA (x3)
9. TORNA A OPPORTUNITY → AVANTI', '', TRUE, 1),
('controllo-stato-processi-pratica', 'Controllo stato / processi pratica', 'stato pratica,processi,case,a che punto,ko,in lavorazione', 'text', 'Per controllare lo stato di una pratica:
1. Apri “Altre Prestazioni” → “Search for Consumer”
2. Inserisci i dati fiscali del cliente e seleziona l’anagrafica
3. Clicca sul nome del cliente (in blu)
4. Vai nella sezione PROCESSI
5. Nel blocco CASES in alto seleziona il numero di CASE della pratica (SUBENTRO, SWITCHING, VOLTURA…)
6. Vai su scheda CORRELATO → blocco integrato in case → seleziona IC-xxxxxxx per entrare nell’ordine

A sinistra vedi subito se la pratica è OK, in lavorazione o in KO. A destra hai tutta la cronologia (clicca “visualizza tutto”) per capire eventuali KO o l’appuntamento gas per le attivazioni.', '', TRUE, 2),
('modifica-anagrafica', 'Modifica anagrafica (mail, telefono, indirizzo)', 'anagrafica,recapito,cambia mail,cambio telefono,cambio indirizzo', 'text', 'Per modificare i dati anagrafici del cliente (mail, telefono, indirizzo):
1. Dal portale ACEA apri ALTRE PRESTAZIONI
2. Cerca il cliente per codice fiscale
3. Seleziona l’anagrafica
4. Clicca su INTERLOCUTOR CONTACT
5. In alto a destra clicca COMPLETA CONTATTO
6. Fai le modifiche permesse
7. SALVA', '', TRUE, 3),
('primo-accesso-al-portale-acea', 'Primo accesso al portale ACEA', 'primo accesso,credenziali,password,authenticator', 'text', 'Primo accesso al portale ACEA (appena ricevute le credenziali):
1. Clicca sul link ricevuto via mail
2. Inserisci username (è la mail su cui hai ricevuto la comunicazione)
3. Fai “Forgot password”: così potrai completare la procedura di primo accesso
4. Imposta la password
5. Una volta entrato, esci e rientra per collegare l’app Authenticator di Google
6. Inserisci il codice OTP generato dall’app: hai finito.', '', TRUE, 4),
('fare-una-voltura', 'Fare una voltura', 'voltura', 'text', 'Per fare una voltura:
1. Apri “Altre Prestazioni” → “Search for Consumer”
2. Inserisci i dati fiscali del cliente che deve intestarsi l’utenza
3. Seleziona l’anagrafica (se non c’è, creala)
4. Clicca sul nome del cliente (in blu)
5. Sulla destra clicca GESTIONE OFFERTA
6. Aperta l’OP, vai avanti nel primo blocco, effettua il controllo SCIPAFI e inserisci POD o PDR per fare la voltura.', '', TRUE, 5),
('fare-un-subentro', 'Fare un subentro', 'subentro,contatore spento,attivazione gas', 'text', 'Per fare un subentro:
1. Apri “Altre Prestazioni” → “Search for Consumer”
2. Inserisci i dati fiscali del cliente che deve intestarsi l’utenza
3. Seleziona l’anagrafica (se non c’è, creala)
4. Clicca sul nome del cliente (in blu)
5. Sulla destra clicca GESTIONE OFFERTA
6. Aperta l’OP, vai avanti nel primo blocco, effettua il controllo SCIPAFI e inserisci POD o PDR
7. Seleziona la prestazione SUBENTRO o ATTIVAZIONE GAS

Ricorda di inserire i dati del titolo occupazionale (proprietario o locatario); se non li hai puoi metterli fittizi.', '', TRUE, 6),
('visionare-fatture-controllare-debiti-cli', 'Visionare fatture / controllare debiti cliente', 'fattura,fatture,debito,duplicato', 'text', 'Per visionare le fatture del cliente:
1. Apri “Altre Prestazioni” → “Search for Consumer”
2. Inserisci i dati fiscali del cliente e seleziona l’anagrafica
3. Clicca sul nome del cliente (in blu)
4. Clicca sulla sezione FATTURE

Da qui vedi le fatture e controlli i debiti. Per reinviare una fattura o un documento al cliente usa GESTIONE DUPLICATI.', '', TRUE, 7),
('controllare-utenze-aumento-potenza-lettu', 'Controllare utenze / aumento potenza / letture', 'utenz,aumento potenza,lettura,residente,contratti attivi', 'text', 'Per controllare le utenze del cliente:
1. Apri “Altre Prestazioni” → “Search for Consumer”
2. Inserisci i dati fiscali del cliente e seleziona l’anagrafica
3. Clicca sul nome del cliente (in blu)
4. Vai nella sezione GESTIONE UTENZE

Da qui controlli le utenze attive, fai aumento di potenza, cambio residente/non residente, inserimento lettura gas e controlli i contratti attivi o cessati (anche Wind3 luce e gas).', '', TRUE, 8),
('voltura-interna', 'Voltura interna (guida)', 'voltura interna', 'link', '', 'https://www.canva.com/design/DAHCIhSLzJs/TJp0nuJxjPUv9by7n8P4mw/view', TRUE, 9),
('cambio-prodotto-switch-da-pdc', 'Cambio prodotto / switch da PDC (guida)', 'cambio prodotto,cambio offerta,switch', 'link', '', 'https://sellf.acea.it/cambio-prodotto-gestione-modalita-operativa-acea-energia-point/', TRUE, 10),
('duplicato-fattura', 'Duplicato fattura (guida)', 'duplicato fattura', 'link', '', 'https://www.canva.com/design/DAHCJSIbzL4/ecxZnKlbkI1BengT8RX0_g/view', TRUE, 11),
('aumento-potenza', 'Aumento potenza (guida)', 'aumento potenza', 'link', '', 'https://www.canva.com/design/DAHCI7cFuLw/6eFHyRD2EFDGWNqF6ne7hA/view', TRUE, 12),
('autolettura-gas', 'Autolettura gas (guida)', 'autolettura', 'link', '', 'https://www.canva.com/design/DAHCJdRap9E/YTeNbcSeRhED2QCfaPoIIQ/view', TRUE, 13),
('cambio-residenza', 'Cambio residenza (guida)', 'cambio residenza,residenza', 'link', '', 'https://www.canva.com/design/DAHCJQVvk2o/x2bnSxPTE3Sq6S_u2BzHQA/view', TRUE, 14),
('cambio-metodo-di-pagamento', 'Cambio metodo di pagamento (guida)', 'pagamento,rid,bollettino,domiciliazione', 'link', '', 'https://www.canva.com/design/DAHCJuFcgdU/wkpRUW4VMVGAK2SWWNtigw/view', TRUE, 15),
('fissa-avanzamento', 'Risposta fissa - Richiesta avanzamento', 'avanzamento,non firmati,non firmato', 'text', 'L''avanzamento te lo manda Mario come sempre il LUN-MER-VEN, insieme agli eventuali KO o NON FIRMATI.', '', TRUE, 90),
('fissa-otp', 'Risposta fissa - OTP non arriva', 'otp non arriva,non riceve otp', 'text', 'Se il cliente non riceve l''OTP: controlla che il numero di cellulare inserito sia corretto e attendi un paio di minuti. Poi fai riprovare l''invio del codice - spesso alla seconda richiesta arriva. Se dopo questi tentativi non arriva ancora, ti conviene contattare il supporto.', '', TRUE, 91)
ON CONFLICT (id) DO NOTHING;

INSERT INTO offerta (nome, tipo, scadenza, durata, luce, gas, comm, attiva, sort_order) VALUES
('ACEA SPRINT (domestico)', 'Variabile', '30/09/2026', '12 mesi', 'PUN + spread 0,014 €/kWh', 'PSV + spread 0,075 €/Smc', '10 €/mese', TRUE, 0),
('ACEA SPRINT (business)', 'Variabile', '30/09/2026', '12 mesi', 'PUN + spread 0,016 €/kWh', 'PSV + spread 0,081 €/Smc', '13 €/mese', TRUE, 1),
('ACEA FLEX', 'Variabile', '30/09/2026', '24 mesi', 'PUN + spread 0,03 €/kWh', 'PSV + spread 0,148 €/Smc', '9 €/mese', TRUE, 2),
('ACEA FIX (domestico)', 'Fissa', '20/07/2026', '12 mesi', '0,09 €/kWh', '0,40 €/Smc', '9,25 €/mese', TRUE, 3);
