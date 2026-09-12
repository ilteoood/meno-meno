# Output della skill in Markdown, CSV e JSON

La skill produce tre rappresentazioni della stessa uscita nella stessa invocazione: una tabella Markdown per la lettura nel terminale Claude Code, un CSV per la rielaborazione in fogli di calcolo, e un JSON strutturato con le offerte normalizzate per integrazioni future.

L'alternativa rifiutata — solo Markdown — avrebbe privilegiato la leggibilità conversazionale ma avrebbe costretto l'utente a ricopiare o riparsare l'output per qualsiasi uso non discorsivo (confronto storico, condivisione, import in altri tool).

Il prezzo di questa scelta è la presenza di tre formatters nel codice (uno per destinazione) e la necessità che gli scraper producano dati sufficientemente strutturati da alimentare tutti e tre senza perdita di informazione — il che a sua volta giustifica la separazione tra scrapers e formatters come strati distinti.

## Bundle luce+gas come entità di prima classe

Le combinazioni luce+gas proposte dagli operatori diventano record `OffertaBundle` distinti dalle singole componenti, paralleli a `OffertaLuce` e `OffertaGas` nello schema normalizzato:

```ts
interface OffertaBundle {
  operatore_id: string;
  nome_commerciale: string;
  componenti: Offerta[];
  sconto_bundle_euro_anno: number | null;
}
```

Il campo `sconto_bundle_euro_anno` rappresenta il risparmio promesso dall'operatore normalizzato su base annua. `null` segnala assenza di valore numerico esposto (marketing puro) o bundle di nome ma non di sostanza (es. Sorgenia Next Energy Plus con bonus dual-fuel a 0€).

Mapping dei casi reali rilevati da R6:

| Operatore | Caso | Valore normalizzato |
|---|---|---|
| Edison World | Bonus one-shot | `80` |
| Hera Hybrid | Bonus one-shot | `200` |
| TIM Energia + TIM WiFi Fibra | Sconto mensile condizionale | `60` (= 5€/mese × 12) |
| A2A / Plenitude / Enel | Marketing puro | `null` |
| Sorgenia Next Energy Plus | Bundle nominale, bonus 0€ | `null` |

<!-- ponytail: perse ricorrenza (one-shot vs mensile) e condizioni (es. richiede Fibra attiva). Caso TIM WiFi Fibra mostra 60 ma lo sconto spesso non si materializza. Ripristinare in v2 con tipo polimorfico se l'utente chiede sconti effettivi. -->

L'output Markdown espone i bundle in una sezione dedicata dopo gli esclusi/non disponibili, come lista `{Operatore} — {Nome}: componenti}`. Nessun calcolo di risparmio annuo confrontato tra bundle (vedi G6).