-- CONTENUTI MODIFICABILI SENZA DEPLOY  (script in puro ASCII: a prova di copia-incolla)
-- Esegui nel SQL Editor di Neon, database supporto-dealer.
-- I caratteri speciali (accenti, virgolette, euro) sono scritti in codice Unicode
-- con la sintassi U&'...\20AC...': Postgres li ricostruisce correttamente.
-- ATTENZIONE: azzera procedure e offerte e le riporta ai contenuti di partenza.

CREATE TABLE IF NOT EXISTS procedura (
  id          TEXT PRIMARY KEY,
  titolo      TEXT NOT NULL DEFAULT '',
  keywords    TEXT NOT NULL DEFAULT '',
  tipo        TEXT NOT NULL DEFAULT 'text',
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

DELETE FROM procedura;
DELETE FROM offerta;

INSERT INTO procedura (id, titolo, keywords, tipo, risposta, url, attiva, sort_order) VALUES
('link-firma-otp-conferma', 'Link firma OTP / conferma (PDC o Subentro)', 'otp,firma,link firma,conferma,touch point,accettazione', 'text', U&'Per risalire al link di firma/conferma (PDC o Subentro):\000A1. Apri \201CAltre Prestazioni\201D\000A2. Clicca su \201CSearch for Consumer\201D\000A3. Inserisci i dati fiscali del cliente\000A4. Seleziona l\2019anagrafica\000A5. Clicca sul nome del cliente (in blu)\000A6. Vai nella scheda \201CDocumenti\201D\000A7. Guarda la sezione \201CTouch Point\201D\000A8. Clicca sul codice \201CFM\2026\201D corrispondente all\2019offertazione\000A9. Clicca sul link per procedere con l\2019accettazione, oppure invialo al cliente.', '', TRUE, 0),
('inserire-offerta-a-carrello', 'Inserire offerta a carrello (associazione punti prodotti)', 'carrello,associazione punti,monorario,offerta a carrello', 'text', U&'Per inserire l\2019offerta a carrello (associazione punti prodotti):\000A1. CONFIGURA\000A2. Clicca su CHIAVE\000A3. SELEZIONA \2192 ASSOCIAZIONE PUNTI PRODOTTI\000A4. Inserisci offerta luce e gas cliccando sul pallino corrispondente\000A5. SALVA\000A6. Clicca sulla chiave inglese\000A7. Clicca sul pallino prezzo MONORARIO\000A8. SALVA (x3)\000A9. TORNA A OPPORTUNITY \2192 AVANTI', '', TRUE, 1),
('controllo-stato-processi-pratica', 'Controllo stato / processi pratica', 'stato pratica,processi,case,a che punto,ko,in lavorazione', 'text', U&'Per controllare lo stato di una pratica:\000A1. Apri \201CAltre Prestazioni\201D \2192 \201CSearch for Consumer\201D\000A2. Inserisci i dati fiscali del cliente e seleziona l\2019anagrafica\000A3. Clicca sul nome del cliente (in blu)\000A4. Vai nella sezione PROCESSI\000A5. Nel blocco CASES in alto seleziona il numero di CASE della pratica (SUBENTRO, SWITCHING, VOLTURA\2026)\000A6. Vai su scheda CORRELATO \2192 blocco integrato in case \2192 seleziona IC-xxxxxxx per entrare nell\2019ordine\000A\000AA sinistra vedi subito se la pratica \00E8 OK, in lavorazione o in KO. A destra hai tutta la cronologia (clicca \201Cvisualizza tutto\201D) per capire eventuali KO o l\2019appuntamento gas per le attivazioni.', '', TRUE, 2),
('modifica-anagrafica', 'Modifica anagrafica (mail, telefono, indirizzo)', 'anagrafica,recapito,cambia mail,cambio telefono,cambio indirizzo', 'text', U&'Per modificare i dati anagrafici del cliente (mail, telefono, indirizzo):\000A1. Dal portale ACEA apri ALTRE PRESTAZIONI\000A2. Cerca il cliente per codice fiscale\000A3. Seleziona l\2019anagrafica\000A4. Clicca su INTERLOCUTOR CONTACT\000A5. In alto a destra clicca COMPLETA CONTATTO\000A6. Fai le modifiche permesse\000A7. SALVA', '', TRUE, 3),
('primo-accesso-al-portale-acea', 'Primo accesso al portale ACEA', 'primo accesso,credenziali,password,authenticator', 'text', U&'Primo accesso al portale ACEA (appena ricevute le credenziali):\000A1. Clicca sul link ricevuto via mail\000A2. Inserisci username (\00E8 la mail su cui hai ricevuto la comunicazione)\000A3. Fai \201CForgot password\201D: cos\00EC potrai completare la procedura di primo accesso\000A4. Imposta la password\000A5. Una volta entrato, esci e rientra per collegare l\2019app Authenticator di Google\000A6. Inserisci il codice OTP generato dall\2019app: hai finito.', '', TRUE, 4),
('fare-una-voltura', 'Fare una voltura', 'voltura', 'text', U&'Per fare una voltura:\000A1. Apri \201CAltre Prestazioni\201D \2192 \201CSearch for Consumer\201D\000A2. Inserisci i dati fiscali del cliente che deve intestarsi l\2019utenza\000A3. Seleziona l\2019anagrafica (se non c\2019\00E8, creala)\000A4. Clicca sul nome del cliente (in blu)\000A5. Sulla destra clicca GESTIONE OFFERTA\000A6. Aperta l\2019OP, vai avanti nel primo blocco, effettua il controllo SCIPAFI e inserisci POD o PDR per fare la voltura.', '', TRUE, 5),
('fare-un-subentro', 'Fare un subentro', 'subentro,contatore spento,attivazione gas', 'text', U&'Per fare un subentro:\000A1. Apri \201CAltre Prestazioni\201D \2192 \201CSearch for Consumer\201D\000A2. Inserisci i dati fiscali del cliente che deve intestarsi l\2019utenza\000A3. Seleziona l\2019anagrafica (se non c\2019\00E8, creala)\000A4. Clicca sul nome del cliente (in blu)\000A5. Sulla destra clicca GESTIONE OFFERTA\000A6. Aperta l\2019OP, vai avanti nel primo blocco, effettua il controllo SCIPAFI e inserisci POD o PDR\000A7. Seleziona la prestazione SUBENTRO o ATTIVAZIONE GAS\000A\000ARicorda di inserire i dati del titolo occupazionale (proprietario o locatario); se non li hai puoi metterli fittizi.', '', TRUE, 6),
('visionare-fatture-controllare-debiti-cli', 'Visionare fatture / controllare debiti cliente', 'fattura,fatture,debito,duplicato', 'text', U&'Per visionare le fatture del cliente:\000A1. Apri \201CAltre Prestazioni\201D \2192 \201CSearch for Consumer\201D\000A2. Inserisci i dati fiscali del cliente e seleziona l\2019anagrafica\000A3. Clicca sul nome del cliente (in blu)\000A4. Clicca sulla sezione FATTURE\000A\000ADa qui vedi le fatture e controlli i debiti. Per reinviare una fattura o un documento al cliente usa GESTIONE DUPLICATI.', '', TRUE, 7),
('controllare-utenze-aumento-potenza-lettu', 'Controllare utenze / aumento potenza / letture', 'utenz,aumento potenza,lettura,residente,contratti attivi', 'text', U&'Per controllare le utenze del cliente:\000A1. Apri \201CAltre Prestazioni\201D \2192 \201CSearch for Consumer\201D\000A2. Inserisci i dati fiscali del cliente e seleziona l\2019anagrafica\000A3. Clicca sul nome del cliente (in blu)\000A4. Vai nella sezione GESTIONE UTENZE\000A\000ADa qui controlli le utenze attive, fai aumento di potenza, cambio residente/non residente, inserimento lettura gas e controlli i contratti attivi o cessati (anche Wind3 luce e gas).', '', TRUE, 8),
('voltura-interna', 'Voltura interna (guida)', 'voltura interna', 'link', '', 'https://www.canva.com/design/DAHCIhSLzJs/TJp0nuJxjPUv9by7n8P4mw/view', TRUE, 9),
('cambio-prodotto-switch-da-pdc', 'Cambio prodotto / switch da PDC (guida)', 'cambio prodotto,cambio offerta,switch', 'link', '', 'https://sellf.acea.it/cambio-prodotto-gestione-modalita-operativa-acea-energia-point/', TRUE, 10),
('duplicato-fattura', 'Duplicato fattura (guida)', 'duplicato fattura', 'link', '', 'https://www.canva.com/design/DAHCJSIbzL4/ecxZnKlbkI1BengT8RX0_g/view', TRUE, 11),
('aumento-potenza', 'Aumento potenza (guida)', 'aumento potenza', 'link', '', 'https://www.canva.com/design/DAHCI7cFuLw/6eFHyRD2EFDGWNqF6ne7hA/view', TRUE, 12),
('autolettura-gas', 'Autolettura gas (guida)', 'autolettura', 'link', '', 'https://www.canva.com/design/DAHCJdRap9E/YTeNbcSeRhED2QCfaPoIIQ/view', TRUE, 13),
('cambio-residenza', 'Cambio residenza (guida)', 'cambio residenza,residenza', 'link', '', 'https://www.canva.com/design/DAHCJQVvk2o/x2bnSxPTE3Sq6S_u2BzHQA/view', TRUE, 14),
('cambio-metodo-di-pagamento', 'Cambio metodo di pagamento (guida)', 'pagamento,rid,bollettino,domiciliazione', 'link', '', 'https://www.canva.com/design/DAHCJuFcgdU/wkpRUW4VMVGAK2SWWNtigw/view', TRUE, 15),
('fissa-avanzamento', 'Risposta fissa - Richiesta avanzamento', 'avanzamento,non firmati,non firmato', 'text', 'L''avanzamento te lo manda Mario come sempre il LUN-MER-VEN, insieme agli eventuali KO o NON FIRMATI.', '', TRUE, 90),
('fissa-otp', 'Risposta fissa - OTP non arriva', 'otp non arriva,non riceve otp', 'text', U&'Se il cliente non riceve l''OTP: controlla che il numero di cellulare inserito sia corretto e attendi un paio di minuti. Poi fai riprovare l''invio del codice \2014 spesso alla seconda richiesta arriva. Se dopo questi tentativi non arriva ancora, ti conviene contattare il supporto.', '', TRUE, 91);

INSERT INTO offerta (nome, tipo, scadenza, durata, luce, gas, comm, attiva, sort_order) VALUES
('ACEA SPRINT (domestico)', 'Variabile', '30/09/2026', '12 mesi', U&'PUN + spread 0,014 \20AC/kWh', U&'PSV + spread 0,075 \20AC/Smc', U&'10 \20AC/mese', TRUE, 0),
('ACEA SPRINT (business)', 'Variabile', '30/09/2026', '12 mesi', U&'PUN + spread 0,016 \20AC/kWh', U&'PSV + spread 0,081 \20AC/Smc', U&'13 \20AC/mese', TRUE, 1),
('ACEA FLEX', 'Variabile', '30/09/2026', '24 mesi', U&'PUN + spread 0,03 \20AC/kWh', U&'PSV + spread 0,148 \20AC/Smc', U&'9 \20AC/mese', TRUE, 2),
('ACEA FIX (domestico)', 'Fissa', '20/07/2026', '12 mesi', U&'0,09 \20AC/kWh', U&'0,40 \20AC/Smc', U&'9,25 \20AC/mese', TRUE, 3);
