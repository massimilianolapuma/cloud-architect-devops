# Piano — cloud-architect-devops: linee guida enterprise + macchina agentica

## Contesto

Il repo `cloud-architect-devops` è vuoto (solo `README.md`, un commit). Deve diventare la base di conoscenza
per progetti enterprise: linee guida, decisioni motivate, diagrammi e template eseguibili.
Primo tema: **architettura multi-tenant il più possibile agnostica rispetto al cloud provider**
(Azure, GCP, Rancher on-premise), con tutto ciò che la circonda: business continuity, branching,
repo strategy, Helm/Argo CD, rilasci con database e rollback garantito.

Il lavoro va costruito **una volta** come catena agentica riusabile: ogni tema successivo passa per
lo stesso flusso gestito da un orchestratore, e le stesse skill servono poi ai team sui progetti reali.

### Cosa hai deciso tu

| Tema | Decisione |
|---|---|
| Pubblico | Tre insieme: architetti (decidere), team delivery (copiare), stakeholder (capire) |
| CI/CD | Azure DevOps, GitHub, pipeline GCP |
| Linguaggi servizi | .NET, Node/TypeScript, Python |
| Database | PostgreSQL, SQL Server, MongoDB/documentale |
| Lingua | Bilingue italiano + inglese |
| Tenant | Livelli misti (standard condiviso / premium dedicato) + unità interne dello stesso gruppo |
| Orchestratore | Entrambi: far crescere il repo **e** skill per i team sui progetti reali |
| Ambienti di prova | **Tutto provabile in locale sul Mac, costo cloud zero all'inizio.** Sandbox Azure/GCP e Rancher di test esistono ma si usano solo più avanti, su tua richiesta esplicita |
| Branching | Trunk-based con feature branch brevi |
| "Agnostico" | Evitare lock-in quando richiesto e poter **migrare su un altro provider col minimo sforzo**. Non piattaforma attiva su più cloud insieme |
| Control plane | Servizio vero fin dalla prima versione, anche con pochi tenant |
| Settori | Finanza/assicurazioni, infrastrutture/PA, sanità → conformità e audit nel nucleo, non nel backlog |
| Rollback DB | Zero perdita di dati come regola; perdita solo su indicazione esplicita |

### Scelte mie (da confermare o rifiutare leggendo)

1. **"Pipeline GCP" = Cloud Build + Cloud Deploy.**
2. **Inglese sorgente canonica, italiano tradotto** dalla catena con glossario condiviso; un controllo
   automatico blocca se le due lingue divergono.
3. **Sito docs-as-code con Docusaurus** (i18n nativo, MDX per componenti interattivi React, Mermaid integrato).
4. **Copertura minima invece di matrice completa**: tre servizi di esempio che toccano ogni linguaggio e
   ogni database una volta sola — `.NET + PostgreSQL` (percorso golden, completo), `Python + SQL Server`,
   `TypeScript + MongoDB`. Non 9 combinazioni.
5. **Pipeline sottili**: la logica di build/test/release sta in un task runner portabile (Taskfile);
   i YAML di Azure DevOps, GitHub Actions e Cloud Build sono involucri che chiamano gli stessi task.
   Così tre CI costano poco e la scelta resta reversibile.
6. **IaC con Terraform** (compatibile OpenTofu): moduli con stessa interfaccia per Azure, GCP, on-prem.
7. **Cluster locale = minikube** (già installato); niente kind/k3d in più.
8. **"Helm vs Argo CD" riformulato**: non sono alternative (Helm impacchetta, Argo CD consegna).
   I confronti veri che tratteremo: Helm vs Kustomize; Argo CD vs Flux vs Rancher Fleet; push da
   pipeline vs pull GitOps. Ipotesi da validare in ADR: chart Helm + Argo CD con ApplicationSet.
9. **Multi-repo con umbrella mostrato come scheletro documentato** dentro `reference/`, non con repo
   separati reali. Questo repo è di per sé un monorepo.
10. **Forma del control plane** (il servizio l'hai deciso tu, la forma è mia ipotesi da validare in ADR):
    servizio `tenant-manager` (.NET + PostgreSQL) con API per onboarding, cambio tier, offboarding.
    Tiene il registro tenant e **scrive lo stato desiderato nel repo GitOps** (ogni cambio = commit
    tracciabile, utile in ambito regolato); Argo CD ApplicationSet crea gli oggetti Kubernetes; i passi
    che Kubernetes non copre (schema o database del tenant, identity provider, chiavi) li esegue un Job
    di provisioning idempotente. Alternative confrontate nell'ADR: operator con CRD `Tenant`, Crossplane.
12. **Finestra di rollback = fino al rilascio successivo** (non l'hai indicata: prendo la più severa).
    La pulizia dello schema slitta di un rilascio intero; le down-migration non cancellano dati scritti dalla v2.
13. **Prova di "agnostico" = prova di migrazione, fatta in locale**: lo stesso carico, dati compresi,
    spostato tra due cluster minikube distinti cambiando solo il modulo infrastruttura, con lo sforzo
    misurato e scritto. DR attivo-attivo tra cloud resta scenario documentato, non costruito.
14. **Sostituti locali dei servizi cloud**, tutti in container: MinIO (object storage), Keycloak
    (identità), Vault (segreti, via External Secrets), registry locale, i tre database.
    Modulo `infra/local` applicato per davvero su minikube, con la stessa interfaccia dei moduli
    `azure/` e `gcp/`. Questi ultimi in locale si verificano senza credenziali né risorse:
    `validate`, tflint, trivy e `terraform test` con provider simulati.
    **Limite dichiarato**: i servizi gestiti veri (AKS, GKE, DB gestiti, identità cloud) in locale non
    girano; ciò che dipende da loro è marcato nei capitoli come "non provato dal vivo".
15. **Pipeline in locale**: i task girano identici dal Taskfile; GitHub Actions eseguite con `act`.
    Azure DevOps e Cloud Build non hanno un esecutore locale fedele: per loro solo lint dei YAML,
    marcati "non eseguiti dal vivo".
16. **"MongoDB" = API MongoDB**: Cosmos DB e Atlas trattati come varianti gestite, non come motori a parte.
17. **Dove vive il contenuto** (precisazione emersa scrivendo il piano di fase 0): le linee guida stanno
    in `website/docs/` e la traduzione in `website/i18n/it/`, non in `docs/` e `i18n/it/` alla radice.
    Docusaurus vuole `i18n/` dentro la cartella del sito, e `docs/` alla radice resta riservata a
    `docs/superpowers/` (design e piani), che non va pubblicata nel sito.

## Struttura del repo

```
CLAUDE.md                     convenzioni, glossario, cancelli di qualità, regole lingua
Taskfile.yml                  unico punto d'ingresso: task verify / build / e2e
docs/                         contenuti EN (sorgente) — capitoli, ADR, schede scenario
i18n/it/                      traduzione IT
website/                      app Docusaurus + componenti interattivi (React Flow)
diagrams/                     sorgenti .drawio → SVG esportati (CLI drawio: installazione attuale rotta, va reinstallata in fase 0)
reference/
  control-plane/              tenant-manager (.NET+PG): registro tenant, API ciclo di vita
  services/                   catalog (.NET+PG), orders (Python+MSSQL), notify (TS+Mongo)
  charts/                     library chart, chart servizio, umbrella chart
  gitops/                     Argo CD app-of-apps, ApplicationSet, registro tenant
  infra/                      moduli Terraform: local/ azure/ gcp/ onprem/ con interfaccia comune
  pipelines/                  azure-devops/ github/ cloudbuild/ (involucri sottili)
  db/                         migrazioni di esempio per motore, test up/down/up
  multirepo-sample/           scheletro umbrella per il confronto mono vs multi-repo
.claude/
  skills/ agents/ workflows/  la macchina agentica (vedi sotto)
plugin/                       skill per i team, impacchettate (fase 6)
```

Ogni capitolo ha la stessa forma, con tre viste per i tre pubblici:
**Capire** (sintesi di una pagina + diagramma) · **Decidere** (opzioni, matrice pesata, raccomandazione,
"quando deviare", ADR in formato MADR) · **Copiare** (link al pezzo eseguibile + checklist).

## Contenuti

### A. Multi-tenant cloud-agnostico (primo tema)
- Modelli di isolamento: silo / pool / bridge, mappati sui tuoi casi (tier standard condiviso, premium
  dedicato, unità interne). Isolamento a livelli: namespace, vCluster, cluster dedicato; Capsule su Rancher.
- Dati per tenant: database dedicato / schema dedicato / riga con RLS (PostgreSQL, SQL Server),
  su MongoDB niente RLS: isolamento per database dedicato o imposto dall'applicazione. Chiavi di cifratura per tenant.
- Isolamento oltre il database: object storage, cache, ricerca, contesto tenant nei job asincroni e
  negli eventi, pool di connessioni come vicino rumoroso.
- Piano di controllo vs piano applicativo: registro tenant, onboarding/offboarding automatici,
  cancellazione dati, passaggio di tier da condiviso a dedicato (fermo minimo, misurato e dichiarato
  per motore — non promesso a zero).
- Accesso degli operatori ai dati dei tenant: break-glass, accesso just-in-time, audit per tenant.
- Tenant dedicati su versioni diverse: finestre di manutenzione, upgrade rinviati, versioni supportate.
- Identità e instradamento: OIDC con claim tenant (Entra ID / Keycloak), Gateway API, sottodominio o header.
- Vicini rumorosi: quote, limiti, rate limiting; policy con Kyverno; NetworkPolicy.
- Deployment stamp / celle e anelli di rilascio per tenant.
- **Regola "agnostico vs servizio nativo"**: matrice a punteggio (guadagno operativo, costo di uscita,
  disponibilità on-prem, standard aperto equivalente, rischio di licenza e supporto del componente
  open) + mappa capacità Azure ↔ GCP ↔ on-prem.
  Substrato comune: Kubernetes (AKS / GKE / RKE2), OCI, OpenTelemetry, Gateway API, External Secrets,
  cert-manager. Valutazioni esplicite: DB gestito vs CloudNativePG, Dapr come strato di portabilità, Crossplane.
- **Playbook di migrazione tra provider**: per ogni servizio nativo ammesso, costo di uscita stimato e
  passi per spostarlo (dati, identità, rete, DNS, segreti); registro dei punti di lock-in per progetto.

### B. Delivery
- **Branching**: trunk-based, feature branch brevi, feature flag (OpenFeature), build una volta e
  promuovi lo stesso artefatto, versioni SemVer + conventional commits, hotfix, policy di branch su
  Azure DevOps e GitHub, CODEOWNERS, ambienti effimeri per PR.
- **Monorepo vs multi-repo con umbrella**: matrice decisionale, e come si sviluppa in ciascuno
  (build incrementali per path, ownership, versioning, dipendenze condivise). Sempre: repo applicativo
  separato dal repo GitOps degli ambienti.
- **Packaging e GitOps**: i tre confronti del punto 8, promozione tra ambienti via PR, hub-and-spoke
  multi-cluster, vincoli on-prem/air-gapped (mirror registry Harbor), Argo Rollouts per canary/blue-green,
  segreti (External Secrets vs SOPS vs Sealed Secrets).

### C. Rilasci con database e rollback garantito
Regole che il capitolo fissa e l'implementazione dimostra:
1. Ogni rilascio è **sicuro al rollback applicativo**: lo schema N funziona con l'app N-1
   (expand/contract; la fase contract arriva almeno un rilascio dopo).
2. Migrazioni classificate: additive · di trasformazione (backfill + doppia lettura/scrittura dietro flag) ·
   distruttive (ritardate, con cancello di backup).
3. Migrazione **separata dall'avvio dell'app**: Job Kubernetes come hook PreSync / sync wave di Argo CD.
4. Quattro livelli di rollback, dal più economico: flag spento → rollback app (schema resta) →
   down-migration provata in CI. I primi tre **non perdono dati**: sono la regola. Quarto livello,
   ripristino point-in-time per tenant: perde dati, quindi ammesso solo come eccezione approvata e registrata.
5. Migrazione a **ondate per tenant** dove il tenant ha schema o database proprio: tenant canarino →
   standard → premium, stop al primo errore, versione schema tracciata per tenant. Nel tier condiviso
   con RLS lo schema è uno solo: lì l'ondata non esiste e il ripristino di un singolo tenant richiede
   export/import logico filtrato — limite dichiarato nella matrice di scelta del modello dati.
6. Tra microservizi: nessun DB condiviso; contratti API/eventi versionati, outbox + saga, test di contratto.
   Eventi già emessi dalla v2 non si ritirano: consumatori tolleranti alla versione + compensazione.
7. Backfill lunghi e DDL su tabelle grandi fuori dagli hook: Job separato a lotti, riprendibile, senza
   lock prolungati. Il migratore è idempotente: un rollback via git revert rilancia l'hook con il
   migratore vecchio, che su schema più avanti non deve fare nulla.
8. Strumenti (ADR): uno strumento unico trasversale ai linguaggi vs nativo per stack (EF Core, Alembic,
   migrate-mongo). Candidato: Liquibase. **Da verificare prima dell'ADR**, non dato per vero: copertura
   reale di MongoDB, rollback nell'edizione gratuita, licenza attuale.

### D. Business continuity
Tier RTO/RPO per livello di tenant; pattern backup-restore / pilot light / warm standby / attivo-attivo;
DR tra cloud e verso on-prem; GitOps come meccanismo di ricostruzione; Velero; replica DB;
dipendenze nascoste (identità, DNS, registry); esercitazioni DR e chaos; runbook.
Ripristino degli asset della piattaforma stessa: host git, CI, stato Terraform, secret store e chiavi
per tenant; backup immutabili contro ransomware. Un ripristino vale solo se riporta anche i dati,
non il solo namespace.

### F. Governo delle linee guida (fase 0)
Chi possiede ogni capitolo, come si chiede un'eccezione, come si registra e quando scade, ciclo di revisione.

### G. Conformità e audit per settori regolati (nucleo, trasversale a tutte le fasi)
- Tracciabilità dei cambi compatibile col trunk-based: approvazioni PR, separazione dei ruoli,
  commit e artefatti firmati, approvazione dei rilasci, evidenze raccolte in automatico dalla pipeline.
- Supply chain: SBOM, firma immagini, policy di ammissione, scansione.
- Residenza e sovranità dei dati per tenant; cifratura e chiavi gestite dal cliente.
- Test di resilienza e strategia di uscita dal provider collegati ai capitoli D e A.
- **Matrice di tracciabilità**: requisito (DORA, NIS2, GDPR, dati sanitari) → capitolo → controllo →
  evidenza. Ogni requisito citato con fonte ufficiale verificata dalla ricerca; supporto tecnico alla
  conformità, non parere legale.

### E. Scenari che non avevi elencato (backlog, ciascuno passa per la stessa catena)
Gestione segreti e workload identity ·
osservabilità e SLO per tenant · FinOps e costo per tenant · rete ibrida e landing zone ·
service mesh / zero trust · messaggistica agnostica (Kafka/NATS vs Service Bus/PubSub, CloudEvents) ·
strategia di test (contratto, carico, chaos) · ciclo di vita cluster e upgrade (Rancher, Fleet) ·
platform engineering / portale sviluppatori · esperienza di sviluppo locale ·
versioning API · metering/billing per tenant · frontend multi-tenant (white-label) ·
migrazione da single-tenant a multi-tenant · DR attivo-attivo tra cloud.

### Diagrammi
- **draw.io**: architetture formali, sorgente `.drawio` in git, SVG esportato dal task `diagrams`.
- **Mermaid**: flussi e sequenze semplici dentro i capitoli.
- **Interattivi** (React nel sito): esploratore modelli di tenancy · stepper expand/contract con punti di
  rollback · selettore pattern DR da RTO/RPO · flusso trunk-based → promozione · wizard decisionale
  (domande → architettura raccomandata).

## Macchina agentica

**Asset di progetto costruiti una volta** (in `.claude/`):

| Tipo | Elementi |
|---|---|
| Skill catena | `guideline-chapter` (forma capitolo + rubrica) · `adr-author` (MADR) · `drawio-diagram` (genera, valida, esporta) · `interactive-diagram` · `reference-impl` (crea pezzo eseguibile + sua verifica) · `bilingual-sync` (traduzione con glossario) |
| Agenti | ricercatore · architetto-autore · disegnatore · costruttore · verificatore · revisore avversario · traduttore |
| Workflow salvati | `topic-design` → **approvazione tua** → `topic-build` |

`topic-design`: ricerca in parallelo (Azure / GCP / on-prem-CNCF) → opzioni + matrice + bozza ADR.
Si ferma: l'indice e la raccomandazione li approvi tu.
`topic-build`: in parallelo testo EN, diagrammi, pezzo eseguibile → cancelli `task verify` → revisione
avversaria da agente fresco con rubrica → correzioni → traduzione IT → cancelli finali.
Meno di 10 agenti per workflow. Script scritti dopo aver caricato `workflow-authoring`.

**Skill già installate da usare** (nessuna da reinventare):
`superpowers:*` (writing-plans, subagent-driven-development, dispatching-parallel-agents,
verification-before-completion, writing-skills) · `engineering:architecture`, `system-design`,
`testing-strategy`, `documentation` · `azure:azure-enterprise-infra-planner`, `azure-kubernetes`,
`azure-reliability`, `azure-validate` + MCP Azure (wellarchitectedframework, resiliency) ·
`microsoft-docs` · MCP Terraform (registry) · `azure-devops-cli` · `security-review`, `semgrep` ·
`artifact-design`, `artifact-diagramming`, `frontend-design` · `skill-creator` · `anthropic-skills:deep-research`.

**Buchi coperti da skill nuove**: nessuna skill GCP né draw.io installata → `drawio-diagram` di progetto;
per GCP ricerca su documentazione ufficiale via web.

**Skill per i team** (fase 6, impacchettate come plugin in `plugin/`): `scaffold-service`, `onboard-tenant`,
`architecture-conformance-review`, `db-migration-review`, `release-readiness`.

**Cancelli umani fissi**: approvazione indice/raccomandazione di ogni tema · ogni creazione di risorse
cloud o spesa · ogni push o pubblicazione esterna.

## Fasi

| # | Fase | Consegna |
|---|---|---|
| 0 | Fondazioni + macchina | `CLAUDE.md`, scheletro repo, sito bilingue che compila, pipeline diagrammi, template capitolo/ADR, governo (F), scheletro matrice di tracciabilità (G), skill + agenti + workflow, `task verify`. **Pilota**: un capitolo piccolo passa per tutta la catena per collaudarla. |
| 1 | Multi-tenant agnostico (A) | Capitoli, ADR, diagrammi; su minikube: Argo CD, `tenant-manager`, due tenant creati via API (uno condiviso, uno dedicato), prova di isolamento |
| 2 | Delivery (B) | Capitoli, ADR; chart, GitOps, involucri pipeline per le tre CI con firma, SBOM ed evidenze di audit, scheletro multi-repo |
| 3 | Database e rollback (C) | Capitoli, ADR; migrazioni sui tre motori, prova rilascio v2 → rollback v1 senza perdita di dati |
| 4 | Business continuity (D) | Capitoli, ADR, runbook; esercitazione backup/ripristino di un tenant |
| 5 | Prova di migrazione in locale | Stesso carico e dati spostati da un cluster minikube a un altro cambiando solo il modulo infrastruttura; sforzo misurato; playbook di migrazione scritto |
| 6 | Skill per i team | Plugin installabile + prova su un progetto di esempio |
| ∞ | Backlog (E) | Un tema alla volta via `topic-design` / `topic-build` |
| opz. | Prova su cloud reali | **Fuori dal percorso iniziale, parte solo se la chiedi.** Stessa prova di migrazione su sandbox Azure → GCP → Rancher di test; chiude i punti "non provato dal vivo" |

Ogni fase parte con un piano di dettaglio (`superpowers:writing-plans`) e chiude con commit su branch
di feature; niente push senza tua conferma.

## Prerequisiti da te

- Fase 0: ok a installare via Homebrew `go-task`, `argocd`, `kubeconform`, `tflint`, `act` (mancanti).
- **Nessuna credenziale cloud richiesta nel percorso iniziale; nessuna risorsa cloud viene creata.**
  Il contesto `dol-lab-aks` esistente non viene mai toccato.
- Solo per la fase opzionale su cloud reali: ID subscription Azure sandbox, ID progetto GCP sandbox
  (+ installazione `gcloud`, assente), kubeconfig del Rancher di test, tetto di spesa.
  Per l'on-prem servono anche: virtualizzazione, storage, identity provider, come sono erogati
  SQL Server e MongoDB, se air-gapped.
- Rischi del banco di prova locale, da chiudere in fase 0 prima di tutto il resto (segnalati dal
  revisore, non ancora verificati da me):
  - `docker` gira su Podman Desktop, macchina con circa 7,5 GiB: stretta per Argo CD + tre motori →
    alzare la memoria o avviare i motori a turno. Con tutto in locale (due cluster nella prova di
    migrazione, più Keycloak, Vault, MinIO) questo è il vincolo principale: `task e2e` va diviso in
    scenari che girano uno alla volta, ciascuno entro la memoria disponibile.
  - Mac arm64: l'immagine Linux di SQL Server potrebbe essere solo amd64 → emulazione, oppure test
    SQL Server spostati su CI/sandbox.
  - La prova NetworkPolicy richiede un CNI che la applichi → minikube avviato con Calico o Cilium.

## Verifica

`task verify` deve passare prima di dichiarare chiusa qualsiasi fase:
- sito compila in EN e IT, nessun link rotto; controllo parità tra le due lingue
- ogni `.drawio` ha il suo SVG esportato; Mermaid si renderizza; componenti interattivi compilano
- `helm lint` + `helm template` + kubeconform; `terraform fmt -check` + `validate` + tflint + trivy config
- servizi: build e test unitari (.NET, Python, TypeScript)
- migrazioni: up → down → up su database in container, con dati, per i tre motori

`task e2e` su minikube (da fase 1, cresce per fase):
- Argo CD installa tutto dal repo GitOps; onboarding di un tenant nuovo = una chiamata a `tenant-manager`
  che produce un commit e porta il tenant a "pronto" senza interventi manuali
- rilascio v2 → scrittura dati → rollback a v1: i dati scritti dalla v2 sono ancora presenti e leggibili
- isolamento: richiesta cross-tenant rifiutata, NetworkPolicy blocca traffico tra namespace
- rilascio v2 con migrazione expand, poi rollback a v1: il servizio risponde e i dati sono integri
- rollback via git revert: l'hook di migrazione riparte e non modifica nulla
- esercitazione DR: backup e ripristino di un tenant, namespace **e dati**, con controllo di integrità

Fase 5 (locale): carico e dati presenti e integri sul secondo cluster dopo la migrazione; primo cluster spento.
Fase opzionale su cloud: `plan`, `apply` e `destroy` solo con tua conferma esplicita e tetto di spesa.
Ogni capitolo riporta in chiaro cosa è stato provato dal vivo in locale e cosa no.
Revisione finale di ogni capitolo: agente fresco con rubrica, senza accesso alle conclusioni dell'autore.
