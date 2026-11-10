---
doc_type: chapter
title: Titolo del capitolo
owner: team-o-persona
status: draft
last_reviewed: 2026-01-01
---

# Titolo del capitolo

_Guidance: elimina ogni riga che inizia con "_Guidance:" prima di pubblicare. Mantieni identici i quattro titoli H2 qui sotto; puoi aggiungere altre sezioni se servono._

## Capire

_Guidance: una pagina per chi deve capire. Descrivi il problema, perché conta e il risultato in termini semplici, spiegando ogni termine tecnico. Poi inserisci un diagramma; l'export va in `website/static/diagrams/<section>/<name>.svg`._

![Testo alternativo che descrive il diagramma](pathname:///diagrams/<section>/<name>.svg)

## Decidere

_Guidance: per l'architetto. Elenca le opzioni valutate, ciascuna con una riga che dice cos'è._

### Opzioni

- **Opzione A**: descrizione in una riga.
- **Opzione B**: descrizione in una riga.

### Matrice pesata

_Guidance: i criteri sono le forze che contano qui; i pesi sommano a 100; i punteggi vanno da 1 a 5. Mostra il calcolo nei totali._

| Criterio | Peso | Opzione A | Opzione B |
|---|---|---|---|
| Primo criterio | 40 | 4 | 3 |
| Secondo criterio | 60 | 2 | 5 |
| **Totale** | 100 | 280 | 420 |

### Raccomandazione

_Guidance: indica l'opzione e le due o tre ragioni che hanno deciso._

### Quando derogare

_Guidance: le condizioni, descritte in modo concreto, in cui un'altra opzione è preferibile._

### Registro della decisione

_Guidance: collega l'ADR che registra questa decisione._

Vedi [ADR 0001](../adr/0001-kebab-title.md).

## Copiare

_Guidance: per il team di delivery. Collega il pezzo eseguibile (percorso sotto `reference/` o `templates/`), di' in una frase cosa fa e indica il comando per eseguirlo. Poi la checklist di adozione._

Template eseguibile: [path/to/template](../../reference/path/to/template).

- [ ] Prerequisito o primo passo
- [ ] Adatta i parametri al tuo ambiente
- [ ] Esegui la verifica e registra l'esito

## Stato di verifica

_Guidance: sii onesto. Indica cosa è stato provato dal vivo in locale, con comando e data, e cosa NON è stato provato (per esempio tutto ciò che richiede un account cloud reale). Non dichiarare ciò che non è stato eseguito._

- **Provato dal vivo in locale:** cosa è stato eseguito, come e quando.
- **Non provato:** cosa è stato solo ragionato o letto dalla documentazione.
