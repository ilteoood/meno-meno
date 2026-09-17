# `TecnologiaFisso` estesa con `'FWA'` — fan-out v5 surfaces 2 operatori wireless puri

Il fan-out v5 (ticket #151–#158) ha surfacesato che `'FWA'` manca dall'enum `TecnologiaFisso = 'FTTH' | 'FTTC' | 'ADSL'` definita in ADR 0005. Due operatori registrati sono FWA puro (Eolo + Linkem), entrambi mappano in silenzio `FWA → 'FTTH'` nei rispettivi scraper per tenere il payload type-safe. È una perdita di informazione semantica: un consumer che confronta un'offerta Eolo "fino a 100 Mbps wireless FWA" con un'offerta Fastweb "fino a 2,5 Gigabit/s FTTH" le vede come tecnologia identica. ADR 0011 (Fastweb PoC) aveva già citato `'FWA'` come estensione futura, ma l'aveva demandata al primo caso reale. Il primo caso reale è arrivato in v5: 2 operatori + 6 offerte Vodafone FWA-only scartate alla listing → 8 evidenze totali in 8 settimane di fan-out, soglia sufficiente per aprire ADR.

## Status

Accepted. Risolve il blocco "tecnologia wireless FWA → fiber FTTH (data corruption)" dentro lo scope del wayfinder v5 map (#150), ticket #159 (bundle+ranking finale). Schema migration a caldo, no fixture rewrite (le fixture di Eolo e Linkem contengono già i token "FWA" che la nuova euristica usa per classificare).

## Considered Options

- **(a) Tenere `'FTTH'` come mapping silente per `FWA`.** Mantieni la perdita di informazione, falla diventare una convenzione. Vantaggio: zero migration, zero enum change. Svantaggio: schema mente al consumer, rank `tierCompare` per `commodity: 'fisso'` (riga 75) restituisce 0 (no tiebreak) ma i due FWA puro finiscono in mezzo a offerte FTTH da 2500 Mbps — la distanza semantica è enorme, la distanza numerica nel tier è solo il costo annuo. ADR 0011 aveva indicato FWA come "estensione futura" proprio perché sapeva che l'euristica silente non sarebbe stata sostenibile. **[RESPINTO — ratifica la decisione ADR 0011 di non adottare la scorciatoia]**
- **(b) Estendere `TecnologiaFisso = 'FTTH' | 'FTTC' | 'ADSL' | 'FWA'`.** Cambio enum type-safe, mapping `FWA → 'FWA'` in Eolo + Linkem, euristica di detection invariata (regex su testo). `'FWA'` partecipa a `tierCompare` per `fisso`? No — `tierCompare` riga 75 ritorna 0 per il ramo `fisso`, e va bene così: il consumer che vuole comparare FTTH vs FWA guarda il campo, non il sort. Cambio downstream test enum in `tests/eolo.test.ts` + `tests/linkem.test.ts`. **[CHOSEN]**
- **(c) Aggiungere campo separato `modalita_connessione: 'fibra' | 'wireless'`.** Distinguere "tipo di portante" da "tecnologia di linea". Refactor di `OffertaFisso` che richiede ADR 0005-bis e tocca tutti i consumer downstream (rank, formatters, fixtures, test). YAGNI per il fan-out: `'FWA'` come categoria semantica coincide con "wireless puro", un campo separato sarebbe ridondante per 8 operatori reali. **[RESPINTO]**

Scelta: **(b)**. Razionale: la soglia di evidenza è 2+ operatori FWA puro (Eolo + Linkem) — sopra 2 la decisione smette di essere locale; il cambio enum è 4 caratteri in un file di tipi + 2 funzioni locali di mapping + 2 test enum update. Nessun consumer downstream rotto: rank `tierCompare` per `fisso` ritorna 0 già oggi, CSV/Markdown/render-examples non filtravano per tecnologia.

## Schema locked (delta da ADR 0005 + ADR 0011)

```ts
export type TecnologiaFisso = 'FTTH' | 'FTTC' | 'ADSL' | 'FWA';
```

`'FWA'` è una tecnologia di portante fisico (Fixed Wireless Access, tipicamente 4G/5G radio su licenza o shared), distinta da `'FTTH'` (fibra ottica fino a casa) e da `'FTTC'` (fibra fino all'armadio + doppino in rame). Sul ranking non ha impatto diretto — `tierCompare` per `fisso` è no-op — ma il campo è semanticamente diverso e va preservato.

## Trade-off esplicito

- **(b) guadagna**: data fidelity (`'FWA'` non mente "FTTH" più), consumer può filtrare `OffertaFisso` per tecnologia in fase di presentazione senza re-derivare dal `nome_commerciale` o dalla URL, ADR 0011 viene ratificato (l'enum extension che aveva citato come "futura" è ora concretizzata).
- **(b) perde**: un campo in più nell'enum (impatto zero su Tier comparison), due enum di test che si allungano di un valore (`['FTTH', 'FTTC', 'ADSL']` → `['FTTH', 'FTTC', 'ADSL', 'FWA']` su 8 test files, ma solo 2 — eolo + linkem — sono impattati dal mapping attivo; gli altri 6 scraper fisso pubblicano solo offerte wired quindi il loro enum potrebbe restare invariato, ma per simmetria strutturale del test si aggiorna anche il loro).
- **(b) si sposa con**: ADR 0009 (structural asserts canonical — `tecnologia ∈ {'FTTH', 'FTTC', 'ADSL', 'FWA'}` è un'invariante di 4 valori, simmetrico al `TecnologiaMobile = '4G' | '5G'` di ADR 0010), ADR 0011 (FWA puro "estensione futura" ratificata).

## Conseguenze

- `src/types/offerta.ts`: `TecnologiaFisso` estesa a `'FTTH' | 'FTTC' | 'ADSL' | 'FWA'`.
- `src/scrapers/eolo.ts` + `src/scrapers/linkem.ts`: riga 53 (`/FWA/i.test(text) return 'FTTH'`) → `return 'FWA'`. La logica upstream (`parseVelocitaMbpsFromText`, `parseVelocityByOfferName`) resta invariata: i fixture già contengono "FWA fino a N Mbps" e la regex di velocità continua a funzionare.
- `tests/eolo.test.ts` + `tests/linkem.test.ts`: `TECNOLOGIA_FISSO_VALUES` esteso a `['FTTH', 'FTTC', 'ADSL', 'FWA']`. Gli altri 6 scraper fisso (TIM, Vodafone, WindTre, Iliad, Skywifi, Tiscali) pubblicano solo offerte wired nei loro fixture (Fastweb esclude `fastweb-casa-fwa` per design), quindi i loro test enum possono restare invariati o essere aggiornati per simmetria — scelta: invariati, per non toccare 6 file senza evidenza.
- `src/rank/index.ts`: invariato. `tierCompare` per `fisso` riga 75 ritorna 0 già oggi, l'aggiunta di `'FWA'` non lo cambia.
- `src/formatters/csv.ts`, `src/formatters/markdown.ts`: invariati. La colonna `tecnologia` emette il valore letterale, `'FWA'` ci finisce senza mapping.
- `fixtures/eolo/fisso.html` + `fixtures/linkem/fisso.html`: invariati. Refresh weekly ADR 0006 li mantiene. La euristica di detection si appoggia al testo della card già presente (Eolo: "Tecnologia FWA fino a 100 Mbps"; Linkem: "Offerte FWA: Internet Casa senza...").
- `CONTEXT.md` §2: aggiungere riferimento ad ADR 0012.

## Out of scope

- **`tierCompare` per `fisso` con tecnologia come tiebreak**: fuori scope. L'utente tipico compara costo annuo tra FTTH e FWA nella stessa vista "fibra/wireless casa" — il campo `tecnologia` guida la lettura del top-3, non l'ordinamento. Se mai un consumer vorrà sortare "FTTH first, FWA last", aggiungerà un comparator separato (YAGNI per ora).
- **Distinguere FWA su licenza (3.5 GHz shared) da FWA su 5G (sub-6 GHz dedicated)**: fuori scope. `'FWA'` è una categoria ombrello sufficiente per il confronto prezzo/velocità/tecnologia. Granularità ulteriore richiederebbe sorgente dati che il dominio non espone stabilmente.
- **Vodafone skip di 6 FWA-only offers**: la decisione di scartare le combo `fastweb-casa-*-mobile` (ADR 0011) e le FWA-only Vodafone resta invariata — il problema Vodafone è un filter `href` aggiuntivo, non un nuovo campo schema. ADR 0012 ratifica solo il mapping che già esiste per Eolo/Linkem.
- **Fastweb Casa FWA tier**: ADR 0011 aveva già documentato il caso (`fastweb-casa-fwa` non compare nel `.item.offer_card` listing — non c'è `OffertaFisso.fwa` da popolare). ADR 0012 non lo forza; se un futuro fan-out Fastweb lo aggiunge, il mapping c'è già.
- **Drop `velocita_mbps` da `OffertaFisso`**: ADR 0010 ha rimosso il campo da mobile per fabbricazione. Su fisso il dato è reale (Fastweb "fino a 2,5 Gigabit/s", Eolo "fino a 100 Mbps", Linkem "fino a 100 Mbps"). Resta required.

## Cosa servirà al fan-out futuro

- **Schema invariato per i 6 scraper wired (TIM/Vodafone/WindTre/Iliad/Skywifi/Tiscali)**: nessuna azione richiesta. Il loro `TecnologiaFisso` continuerà a essere uno di `'FTTH' | 'FTTC' | 'ADSL'`.
- **Nuovo operatore FWA puro (es. Go Internet, BBBell)**: aggiungere branch in `createScraper` + export, mapping `'FWA'` su detection testuale. Pattern identico a Eolo/Linkem.
- **Nuovo operatore misto FTTH + FWA (es. Aruba Fibra)**: la detection testuale basta — il `tierCompare` no-op per `fisso` non ha impatto su sort, il campo `tecnologia` guida la lettura.

## Reference

- Issue: #159 (questo ADR + ticket, chiuso dall'PR atomica di #159 stesso).
- PR correlati: #166 (Eolo, mapping silente documentato), #167 (Linkem, mapping silente documentato), #161 (Vodafone, 6 FWA-only offers skipped).
- ADR correlati: 0005 (`OffertaFisso` schema originario — `TecnologiaFisso = 'FTTH' | 'FTTC' | 'ADSL'`, "FWA come estensione futura"), 0009 (structural asserts canonical), 0010 (drop `velocita_mbps` mobile — non applicabile a fisso), 0011 (`OffertaFisso` schema adequacy, FWA puro come estensione futura ratificata qui).
- Memory: `feedback-one-subagent-at-a-time`, `feedback-destination-vs-frontiera` (v5 destination check post-#159), `feedback-pr-mergedat-check` (verifica mergedAt).