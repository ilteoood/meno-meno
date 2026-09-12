# Scraping live senza cache su disco

Lo scraping dei siti operatori viene eseguito ad ogni invocazione della skill; nessuno snapshot delle offerte viene persistito tra un'esecuzione e l'altra.

L'alternativa — cache su disco con TTL, o refresh schedulato via cron — è stata scartata perché il valore della skill è la freschezza del confronto (offerte e prezzi cambiano di settimana in settimana), e una cache introduce complessità di invalidazione e rischio di dati stantii senza un vantaggio percepibile di performance, dato che il collo di bottiglia è lo scraping parallelo, non l'I/O su disco.

Il trade-off è esplicito: invocazioni più lente (qualche secondo per il refresh live di N operatori in parallelo) in cambio di dati sempre aggiornati e zero infrastruttura di manutenzione (nessun cron, nessuna pulizia cache, nessuna gestione TTL). La resilienza ai fallimenti è gestita per operatore: timeout 15s, esclusione con warning se il sito non risponde, nessun retry.