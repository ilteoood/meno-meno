# Output della skill in Markdown, CSV e JSON

La skill produce tre rappresentazioni della stessa uscita nella stessa invocazione: una tabella Markdown per la lettura nel terminale Claude Code, un CSV per la rielaborazione in fogli di calcolo, e un JSON strutturato con le offerte normalizzate per integrazioni future.

L'alternativa rifiutata — solo Markdown — avrebbe privilegiato la leggibilità conversazionale ma avrebbe costretto l'utente a ricopiare o riparsare l'output per qualsiasi uso non discorsivo (confronto storico, condivisione, import in altri tool).

Il prezzo di questa scelta è la presenza di tre formatters nel codice (uno per destinazione) e la necessità che gli scraper producano dati sufficientemente strutturati da alimentare tutti e tre senza perdita di informazione — il che a sua volta giustifica la separazione tra scrapers e formatters come strati distinti.