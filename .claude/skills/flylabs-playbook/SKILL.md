---
name: flylabs-playbook
description: Use before opening a PR or making a stack, style, copy, test, migration or operations choice in a FlyLabs web app, to check the work against the FlyLabs Playbook and the app's listed deviations.
---

# Controllo contro il Playbook FlyLabs

Il Playbook è in `flylabs-ai/flylabs-kit`, file `PLAYBOOK.md`. Se la repo non è nella sessione, leggilo da GitHub; se non è raggiungibile, dillo e prosegui senza inventare regole.

## Quando usarla
- prima di aprire una PR in un'app FlyLabs;
- prima di una scelta di stack, stile, testi, test, migrazioni, email o operatività.

## Passi
1. Leggi il blocco "FlyLabs Kit" nell'AGENTS.md dell'app e l'elenco degli scostamenti voluti.
2. Leggi i capitoli del Playbook che toccano il lavoro (stack 1, stile 2, testi 3, guida 4, qualità 5, dati 6, operatività 7, legale e AI 8, metodo 9).
3. Per ogni regola toccata scegli un esito: rispettata, scostamento elencato, oppure violata.
4. Una regola violata si corregge nel lavoro. Se la violazione è voluta, chiedi all'utente di aggiungerla agli scostamenti dell'AGENTS.md con il motivo; non aggiungerla da solo.
5. Se il lavoro contiene una soluzione che servirebbe a tutte le app, proponila come PR su flylabs-kit (regola o modulo del registro).

## Esito
Un elenco breve, una riga per regola toccata: numero della regola, esito, e cosa hai cambiato o cosa serve decidere. Niente righe per le regole che il lavoro non tocca.
