# Scraper per operatore hardcoded nella skill

Ogni operatore (Enel, Edison, TIM, Vodafone, …) ha un modulo di codice dedicato nella skill che conosce la struttura HTML del sito e produce offerte normalizzate, anziché un generico motore di scraping guidato da configurazione esterna.

L'alternativa rifiutata — URL + selettori CSS in `operators.json` — è risultata fragile nella pratica: ogni operatore ha layout, tecnologie di rendering (SPA, A/B test, anti-bot) e strutture dati diverse, e una configurazione generica avrebbe richiesto workaround per operatore, finendo per replicare in JSON la complessità che il codice esprime in modo più chiaro.

Aggiungere un operatore richiede quindi scrivere un nuovo modulo `scrapers/<operatore>.ts`; non è un cambio di config. Questa scelta è coerente con la decisione di non dipendere da fonti istituzionali (ARERA/AGCOM) e dall'uso di scraping live senza cache: lo scraping è la fonte unica di verità e merita codice dedicato per ciascuna fonte.