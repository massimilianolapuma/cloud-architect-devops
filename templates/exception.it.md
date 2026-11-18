---
doc_type: exception
id: exc-0000              # exc- e quattro cifre, unico tra tutti i record; il file si chiama <id>.md
title: Breve descrizione della deroga
guideline: SECTION/CHAPTER e la regola, tra virgolette finché le regole non hanno identificatori
scope: Una classe di sistema, per esempio "il livello database di un carico di lavoro"
category: waiver          # waiver o mitigated
status: proposed          # proposed, approved, rejected, withdrawn, closed, replaced
requested_by: Nome di chi richiede
requested_on: 2026-01-01
approved_by:              # compilato da chi approva
approved_on:              # compilato da chi approva
expires: 2026-07-01       # obbligatorio; al massimo 6 mesi dopo approved_on
replaces:                 # per un rinnovo: l'id del record che sostituisce
restricted_ref:           # facoltativo: l'id di questo record nel repository privato, mai un URL
---

_Guidance: salva come `website/docs/exceptions/<section>/<chapter>/<id>.md` (la copia italiana va al percorso speculare sotto `website/i18n/it/`), dove `<section>/<chapter>` è il percorso del capitolo la cui regola viene derogata (per esempio `00-foundations/docs-as-code`), e inizia `guideline` con lo stesso percorso. Scrivi solo ciò che la sezione "What a record may contain" del capitolo sulla governance consente: il repository è pubblico. Ogni chiave del frontmatter resta, anche se vuota. `approved_by` e `approved_on` li compila chi approva, e sono obbligatori quando `status` è `approved`, `closed` o `replaced`. Elimina ogni riga "_Guidance:" prima di pubblicare. Mantieni identici i cinque titoli H2 qui sotto._

## Motivo

_Guidance: perché la regola non può essere rispettata, al livello della linea guida. Nessun nome di sistema, tenant, cliente o risorsa._

## Rischio

_Guidance: il rischio di concedere la deroga e il rischio di rifiutarla._

## Controllo compensativo

_Guidance: cosa riduce il rischio mentre la deroga è attiva._

## Piano di conformità

_Guidance: cosa verrà fatto per rispettare la regola prima della data di scadenza._

## Oggetti di piattaforma

_Guidance: il tipo di ogni oggetto di piattaforma che applica questa deroga (per esempio un'esenzione di Azure Policy o una `PolicyException` di Kyverno) e i passi generici per rimuoverlo. Nessun identificatore: quelli vanno nel repository privato._
