# Scraping `--live` non funzionante: fixture sintetiche ≠ siti reali

Il 2026-09-15 l'utente ha richiesto la skill `meno-meno` per offerte mobile in modalità `--live`. Risultato: **12/12 operatori mobile in fail**. Indagando si è scoperto che la causa non è drift di markup (siti che cambiano selettori nel tempo) ma un **disallineamento architetturale al bootstrap del progetto**: le 24 fixture in `fixtures/<operatore>/<commodity>.html` non sono snapshot reali dei siti, sono **mini-HTML sintetici (3.2-3.4 KB ciascuno, stessa timestamp di generazione 2026-09-13 12:36:57)** scritti a mano per matchare i selettori `article[data-offer]` + `.offer-name / .offer-price / .offer-gb / .offer-minuti / .offer-tech` che i 12 scraper usano. Gli stessi 12 scraper sono cloni strutturali al 100% costruiti su quel pattern (ADR 0004 esenta solo Edison + WindTre, ma Edison è luce e il caso WindTre mobile resta in posizione isolata: usa Playwright, non il pattern "synthetic fixture"). I test `tests/<op>.test.ts` (uno per operatore, 99/99 verdi) confrontano il risultato dello scraper contro assert hardcoded su `codice_offerta`, `nome_commerciale`, prezzi specifici — tutti derivati dalle fixture sintetiche. Risultato: nessuno scraper v1 ha mai funzionato in live, e il "v1 destination reached 24/24" dichiarato in precedenza è da intendersi come "24/24 scrapers-committed-and-passing-on-synthetic-fixtures", non come "24/24 scraping-i-siti-veri". ADR 0001 ("uno scraper per operatore hardcoded") e ADR 0006 (refresh weekly) restano valide come scelte di design; il problema è che il "canonical sample" non è mai stato catturato dal sito reale prima di costruire lo scraper, quindi nessun scraper sa cosa matchare in live.

## Status

Accepted. Risolve la nuova entry "scraping `--live` mobile rotto" scoperta il 2026-09-15.

## Considered Options

- **(a) Riscrivere i 12 selettori mobile + i 12 test contro siti reali.** Per ogni operatore: scaricare HTML live con curl + DESKTOP_UA, identificare il vero selettore, ristrutturare `parseOfferCards`, sostituire gli assert hardcoded di `tests/<op>.test.ts` con assert strutturali (`count === N`, campi non vuoti), rigenerare le fixture reali e re-testare. WindTre mobile richiede `npx playwright install chromium` che il workflow CI attuale non installa — da aggiungere. Stesso lavoro per i 12 scraper luce/gas è da valutare separatamente. Costo: giorni-uomo, PR multi-scopo ad alto rischio.
- **(b) Refresh fixtures come da ADR 0006 e basta.** Eseguire `npm run download-fixtures.ts` (stessa UA desktop dei 12 scraper, stessi timeout, nessun Playwright per WindTre mobile). Risultato atteso: `00 fixtures scaricate correttamente` per i siti protetti da anti-bot, oppure HTML reale che non matcha più i selettori attuali → sia i 12 test che i 12 scraper si rompono. Costo: basso, ma non risolve nulla.
- **(c) Documentare e deferire.** Scrivere questo ADR, marcare il drift come debito tecnico noto, lasciare v1 nello stato attuale (24/24 verde su fixture sintetiche, `--live` non funzionante). Il fix reale si farà in v2.

Scelta: **(c)**. La scope di (a) è incompatibile con la natura del rilascio v1 (frontiera chiusa, fixtures "destinazione" soddisfatte); forzarlo ora aprirebbe un'epica fuori scope e rischierebbe di rompere i 99/99 test verdi che sono il contratto attuale. (b) è peggio di non fare nulla perché produce l'illusione di un fix.

## Evidenze raccolte

Esecuzione `npm run scrape -- --operatore <op> --commodity mobile --live` su tutti i 12 operatori mobile, output reale:

| Operatore | URL | HTTP | Errore |
|---|---|---|---|
| tim | https://www.tim.it/fisso-e-mobile/mobile | 200 | no offer cards parsed from source |
| vodafone | https://privati.vodafone.it/mobile/telefonia-mobile | 200 | no offer cards parsed from source |
| iliad | https://www.iliad.it/offerte-iliad-mobile.html | 200 | no offer cards parsed from source |
| fastweb | https://www.fastweb.it/adsl-fibra-ottica/offerta-mobile | 200 | no offer cards parsed from source |
| skywifi | https://www.sky.it/wifi | 200 | no offer cards parsed from source |
| postemobile | https://www.postemobile.it/privati/offerte-telefonia-mobile | 200 | no offer cards parsed from source |
| ho | https://www.ho-mobile.it/tutte-le-offerte | 200 | no offer cards parsed from source |
| kena | https://www.kenamobile.it/offerte-mobile | **404** | URL cambiata (kenamobile non è piu sotto `/offerte-mobile`) |
| very | https://verymobile.it/offerte | 200 | no offer cards parsed from source |
| tiscali | https://casa.tiscali.it/mobile/ | 200 | no offer cards parsed from source |
| dimensione | https://www.dimensione.it/offerte-mobile | 200 | no offer cards parsed from source |
| windtre | https://www.windtre.it/offerte-mobile | — | browser unavailable (Playwright non installato in dev mode `npm run scrape`) |

Markup live osservato (es. ho-mobile): `<div class="offerCarousel__slider__card" data-offerlink="/flussi-attivazione.138.html">` con carousel BEM-style — nessuna occorrenza di `<article data-offer>`.

Fixture attuali: tutte 12 le `fixtures/<op>/mobile.html` sono lunghe 3.2-3.4 KB, mtime identico 2026-09-13 12:36:57, contengono un blocco JSON-LD `application/ld+json` con `schema.org/Offer` + 3 `<article data-offer data-offer-code="...">` con classi dell'era bootstrap-style. Non sono dump live.

## Consequences

- `npm run scrape -- --live` continuerà a fallire su 12/12 operatori mobile fino a che (a) non verrà eseguita la scope di (a) oppure una scope ridotta selezionata. Skill `meno-meno` continua a funzionare correttamente in modalità fixture (default), come da ADR 0002 e ADR 0003.
- I 99/99 test restano verdi e misurano il contratto "scraper + fixture sintetica" — non vanno toccati in questa PR.
- `doctor` (`src/cli/doctor-cli.ts`) etichetta già correttamente il problema come "no offer cards parsed from source" — il messaggio è onesto, non un fail di regressione.
- ADR 0006 (refresh weekly GitHub Action) resta valida: quando (a) verrà eseguita e produrrà fixture reali, la weekly action inizierà a fare il suo lavoro. Fino ad allora le sue run saranno no-op (diff vuoto) — falso negativo atteso, da non confondere con "tutto sincronizzato".
- Memory project: `v1 destination reached` esistente va riletto con la precisazione "24/24 scrapers committed and passing on synthetic fixtures; live scraping not verified"; si aggiorna in fase di v2 quando il fix (a) entrerà in scope.
- Ticket di tracking: fuori da v1 (frontiera chiusa, wayfinder map #1 già in stato `24/24 / frontiera empty`). Aprire in v2 come parte del backlog `gas / fisso / ranking` + `live scraping correctness`.

## Reference

- Memory: `project-v1-destination-reached.md`, `feedback-destination-vs-frontiera.md`, `cn-bot-block-403-live-gate.md`.
- ADR correlati: 0001 (scraper per operatore hardcoded), 0002 (scraping live senza cache), 0004 (eccezione playwright edison-windtre), 0006 (fixture refresh weekly GitHub Action), 0007 (skill doctor CLI e sub-skill).
