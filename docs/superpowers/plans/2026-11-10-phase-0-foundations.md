# Fase 0 — Fondazioni + macchina agentica: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare il repo vuoto a un sito di linee guida bilingue che compila, con cancelli di qualità automatici e una catena agentica (skill, agenti, due workflow) collaudata su due capitoli reali.

**Architecture:** Monorepo pnpm. Il sito Docusaurus vive in `website/` (contenuto EN in `website/docs/`, IT in `website/i18n/it/`). I cancelli sono piccoli script ESM in `tools/`, ciascuno con una funzione pura testata e una CLI sottile; `Taskfile.yml` è l'unico punto d'ingresso. La catena agentica sta in `.claude/` e produce solo file che i cancelli sanno controllare.

**Tech Stack:** Node 26 · pnpm 10 · Docusaurus 3.10.2 (TypeScript, tema Mermaid) · `@xyflow/react` 12.12.1 · `gray-matter` 4.0.3 · go-task · draw.io desktop CLI · minikube (driver podman) · `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-10-cloud-architect-devops-design.md` — leggerla prima di iniziare.

## Global Constraints

- **Nessuna risorsa cloud, nessuna credenziale cloud.** Tutto gira in locale sul Mac.
- Mai toccare il contesto kube `dol-lab-aks`. Mai fermare, modificare o cancellare il profilo minikube `minikube` esistente: questo progetto usa solo il profilo `cad`.
- Nessun `git push`. Commit solo sul branch `feat/phase-0-foundations`, messaggi Conventional Commits.
- Inglese sorgente canonica; italiano tradotto. Codice, nomi file, identificatori, commit: inglese.
- Contenuto delle linee guida in `website/docs/`; traduzione in `website/i18n/it/docusaurus-plugin-content-docs/current/` con lo stesso percorso relativo. `docs/` alla radice contiene solo `docs/superpowers/`.
- Script in `tools/`: ESM `.mjs`, nessun passo di build, test con `node --test`. I processi esterni si lanciano con `execFile` e array di argomenti, mai con stringhe passate a una shell.
- Versioni fissate: `@docusaurus/*` 3.10.2, `@xyflow/react` 12.12.1, `gray-matter` 4.0.3. Macchina: arm64, Node v26.13.0, pnpm 10.33.0.
- Ogni workflow salvato usa meno di 10 agenti.
- Modifiche alla macchina dell'utente (Homebrew, memoria della macchina Podman) solo dopo conferma esplicita nel passo che le prevede.
- Stato di fatto verificato il 2026-11-10: `drawio` è sul PATH ma **non funziona** (`/Applications/draw.io.app/Contents` è vuota); `task`, `argocd`, `kubeconform`, `tflint`, `act` non sono installati; macchina Podman a 7,45 GiB con il profilo `minikube` dell'utente già in esecuzione.

## Review Focus

1. **Testo EN modificato dopo la traduzione** → `task i18n:check` esce con 1 e nomina il file. (Task 4)
2. **`.drawio` modificato senza riesportare, o SVG cancellato a mano** → `task diagrams:check` esce con 1 e nomina il file. (Task 5)
3. **Percorsi con spazi o caratteri non ASCII** (`città multi tenant.drawio`) → gli script funzionano. (Task 4, Task 5)
4. **Strumento presente sul PATH ma rotto** (il caso attuale di `drawio`) → `task doctor` dice `broken` con il comando per reinstallare, senza stack trace. (Task 1)
5. **Diagramma illeggibile nel tema scuro** (SVG trasparente con tratti scuri) → nel sito i diagrammi hanno sempre fondo chiaro. (Task 5)

---

### Task 1: Toolchain e `task doctor`

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `Taskfile.yml`, `tools/toolchain.json`, `tools/doctor.mjs`
- Test: `tools/doctor.test.mjs`

**Interfaces:**
- Produces: `compareVersions(a: string, b: string): -1 | 0 | 1`
- Produces: `checkTools(requirements: Requirement[], probe: Probe): Promise<Result[]>` con
  `Requirement = { name, cmd, versionArgs: string[], versionPattern: string, min?: string, required: boolean, install: string }`,
  `Probe = (cmd: string, args: string[]) => Promise<{ found: boolean, ok: boolean, stdout: string }>`,
  `Result = { name, status: 'ok' | 'missing' | 'too-old' | 'broken', version?: string, required: boolean, install: string }`
- Produces: task `doctor`, `test:tools`. Cartella `.work/` ignorata da git (usata dalla catena dal Task 8).

- [ ] **Step 1: Chiedere conferma e installare ciò che serve in questa fase**

Chiedere all'utente l'ok, poi: `brew install go-task` e `brew reinstall --cask drawio`.
Deviazione voluta dalla spec: `argocd`, `kubeconform`, `tflint`, `act` si installano nella fase che li usa per prima, non ora.
Verifica: `task --version` stampa una versione; `ls /Applications/draw.io.app/Contents/MacOS/` elenca un eseguibile.

- [ ] **Step 2: Scrivere i test che falliscono**

```js
test('compareVersions orders numerically, not lexically', () => {
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('3.10.2', '3.10.2'), 0);
  assert.equal(compareVersions('10.0', '10.0.403'), -1);
});
test('version is extracted through versionPattern', async () => {
  const r = await checkTools([req({ versionPattern: 'v(\\d+\\.\\d+\\.\\d+)', min: '22.0.0' })],
    async () => ({ found: true, ok: true, stdout: 'v26.13.0\n' }));
  assert.deepEqual([r[0].status, r[0].version], ['ok', '26.13.0']);
});
test('command not on PATH is missing', async () => {
  const r = await checkTools([req()], async () => ({ found: false, ok: false, stdout: '' }));
  assert.equal(r[0].status, 'missing');
});
test('command on PATH that fails to run is broken', async () => {
  const r = await checkTools([req()], async () => ({ found: true, ok: false, stdout: '' }));
  assert.equal(r[0].status, 'broken');
});
test('version below min is too-old', async () => {
  const r = await checkTools([req({ versionPattern: '(\\d+\\.\\d+\\.\\d+)', min: '10.0.0' })],
    async () => ({ found: true, ok: true, stdout: '9.4.1' }));
  assert.equal(r[0].status, 'too-old');
});
```
`req(overrides)` è un helper del test che restituisce un `Requirement` valido.

- [ ] **Step 3: Eseguire e vedere il fallimento**

Run: `node --test "tools/**/*.test.mjs"` — Expected: FAIL, `doctor.mjs` non esporta nulla.

- [ ] **Step 4: Implementare `tools/doctor.mjs` e `tools/toolchain.json`**

`toolchain.json` — obbligatori (`required: true`): `node` (min 22.0.0), `pnpm` (min 10.0.0), `task`, `docker`, `minikube`, `kubectl`, `helm`, `drawio`. Facoltativi (`required: false`): `terraform`, `dotnet`, `uv`, `trivy`, `argocd`, `kubeconform`, `tflint`, `act`. Ogni voce ha `install` con il comando Homebrew esatto.
La sonda reale distingue "non sul PATH" (`found: false`) da "sul PATH ma l'esecuzione fallisce" (`found: true, ok: false`). Per `drawio` la sonda è `drawio --version`: se dopo la reinstallazione non stampa una versione, scegliere un altro argomento innocuo che esca con 0 e annotarlo in `toolchain.json`.
CLI: una riga per strumento (`ok node 26.13.0`, `broken drawio → brew reinstall --cask drawio`); esce con 1 se un obbligatorio non è `ok`; i facoltativi mancanti sono avvisi.

- [ ] **Step 5: Scrivere `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `Taskfile.yml`**

`package.json`: `"private": true`, `"type": "module"`, devDependency `gray-matter` 4.0.3. Workspace: `website`.
`.gitignore`: `node_modules/`, `website/build/`, `website/.docusaurus/`, `.work/`.
Task: `doctor` → `node tools/doctor.mjs`; `test:tools` → `node --test "tools/**/*.test.mjs"` (glob esplicito: non passare una directory a `node --test`).

- [ ] **Step 6: Verificare**

Run: `pnpm install && task test:tools` — Expected: 5 test PASS.
Run: `task doctor` — Expected: exit 0, `ok drawio ...`.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "chore: add toolchain doctor and task runner"`

---

### Task 2: Banco di prova locale (chiude i tre rischi segnalati nella spec)

**Files:**
- Create: `reference/testbed/smoke.sh`, `reference/testbed/RESULTS.md`
- Modify: `Taskfile.yml` (task `testbed:smoke`, `testbed:down`)

**Interfaces:**
- Consumes: task `doctor`.
- Produces: profilo minikube `cad` con CNI che applica le NetworkPolicy; `RESULTS.md` con i fatti su cui le fasi 1–5 si basano.

- [ ] **Step 1: Scrivere `smoke.sh` con le asserzioni prima dell'ambiente**

Lo script esce con 1 alla prima asserzione fallita e stampa quale. Asserzioni, in ordine:
1. `minikube start -p cad --driver=podman --container-runtime=containerd --cni=calico --memory=3g --cpus=2` va a buon fine.
2. Namespace `t-a` e `t-b`; in `t-b` un pod nginx con Service. Da un pod in `t-a` la richiesta al Service **riesce**.
3. Applicata in `t-b` una NetworkPolicy default-deny in ingresso, la stessa richiesta **va in timeout** (5 s). Il passo 2 prova che a bloccare è la policy e non un guasto di rete.
4. Container `postgres:17` risponde a `SELECT 1`.
5. Container `mongo:8` risponde a `db.runCommand({ ping: 1 })`.
6. Container `mcr.microsoft.com/mssql/server:2022-latest` risponde a `SELECT 1`. Se fallisce in modalità nativa, riprovare con `--platform linux/amd64` e registrare quale delle due ha funzionato.
7. Con cluster e tre database attivi insieme, memoria libera della macchina Podman registrata.
`testbed:down` rimuove i tre container e fa `minikube delete -p cad`. Nessun comando dello script nomina il profilo `minikube` o il contesto `dol-lab-aks`.

- [ ] **Step 2: Eseguire**

Run: `task testbed:smoke` — Expected: exit 0 con le 7 asserzioni verdi, oppure exit 1 con il nome di quella fallita.

- [ ] **Step 3: Decidere sui fallimenti — fermarsi e chiedere all'utente se serve**

- Asserzione 1 o 7 falliscono per memoria: proporre all'utente di portare la macchina Podman a 12 GiB (`podman machine stop && podman machine set --memory 12288 && podman machine start`). **Questo ferma anche il suo profilo `minikube`: farlo solo con il suo ok.**
- Asserzione 3 fallisce: riprovare con `--cni=cilium`; registrare quale CNI funziona.
- Asserzione 6 fallisce in entrambe le modalità: registrarlo e chiedere all'utente come procedere per SQL Server; non scegliere da soli un sostituto.

- [ ] **Step 4: Scrivere `RESULTS.md`**

Data, versioni, CNI che ha funzionato, modalità di SQL Server che ha funzionato, memoria misurata, e la regola che ne deriva per `task e2e` (quanti componenti possono girare insieme). Solo fatti osservati.

- [ ] **Step 5: Smontare e commit** — `task testbed:down`, poi `git commit -m "test: add local test bed smoke and record results"`

---

### Task 3: Sito Docusaurus bilingue che compila

**Files:**
- Create: `website/` (scaffold), `website/docusaurus.config.ts`, `website/sidebars.ts`, `website/docs/intro.md`, `website/i18n/it/docusaurus-plugin-content-docs/current/intro.md`
- Modify: `Taskfile.yml` (task `site:build`, `site:dev`)

**Interfaces:**
- Produces: `task site:build` → `website/build/index.html` (EN) e `website/build/it/index.html` (IT). Alias `@site` per importare da `website/src`.

- [ ] **Step 1: Scaffold e pulizia**

`pnpm create docusaurus@3.10.2 website classic --typescript`, poi eliminare blog, documenti tutorial e pagine di esempio. Resta un sito di sola documentazione.

- [ ] **Step 2: Configurare `docusaurus.config.ts`**

Valori fissati: `title: 'Cloud Architect & DevOps Guidelines'`; `url: 'https://example.invalid'`; `baseUrl: '/'`; `i18n: { defaultLocale: 'en', locales: ['en', 'it'] }`; docs con `routeBasePath: '/'`; `blog: false`; `onBrokenLinks: 'throw'`; link Markdown rotti in `throw` (nella 3.10 l'opzione sta sotto `markdown.hooks`: verificare sulla documentazione della versione installata); `markdown.mermaid: true` con `@docusaurus/theme-mermaid`; selettore lingua nella navbar.

- [ ] **Step 3: Scrivere `intro.md` in EN e in IT**

Frontmatter `doc_type: page`. Contenuto: a cosa serve il repo, i tre pubblici, le tre viste di ogni capitolo, un blocco Mermaid con il flusso `topic-design → approvazione → topic-build`.

- [ ] **Step 4: Verificare la build**

Run: `task site:build` — Expected: exit 0; esistono `website/build/index.html` e `website/build/it/index.html`.

- [ ] **Step 5: Verificare che un link rotto blocchi**

Aggiungere a `intro.md` il link `[x](./does-not-exist.md)`. Run: `task site:build` — Expected: exit ≠ 0 con il link nominato. Togliere il link e ricompilare: exit 0.

- [ ] **Step 6: Commit** — `git commit -m "feat(site): add bilingual Docusaurus site"`

---

### Task 4: Controllo di parità tra le due lingue

**Files:**
- Create: `tools/i18n-parity.mjs`, `tools/glossary.yaml`
- Test: `tools/i18n-parity.test.mjs`
- Modify: `Taskfile.yml` (task `i18n:check`), `website/i18n/it/.../intro.md` (timbro)

**Interfaces:**
- Produces: `checkParity({ enDir, itDir }): Promise<{ missing: string[], orphan: string[], stale: string[] }>` — percorsi relativi a `enDir`, solo `.md` e `.mdx`.
- Produces: `stamp({ enDir, itDir, relPath }): Promise<void>` — scrive nel frontmatter del file IT `source_sha256: <sha256 esadecimale dei byte del file EN>`, lasciando intatto il resto.
- Produces: CLI `node tools/i18n-parity.mjs check` e `... stamp <relPath>`. Non esiste `stamp --all`: maschererebbe le traduzioni vecchie.

- [ ] **Step 1: Scrivere i test che falliscono** (ogni test crea le due cartelle in una directory temporanea)

```js
test('EN file without IT counterpart is missing', ...)      // missing = ['a/b.md']
test('IT file without EN counterpart is orphan', ...)        // orphan = ['old.md']
test('IT file with no source_sha256 is stale', ...)          // stale = ['a.md']
test('after stamp the pair is clean', ...)                   // all three arrays empty
test('editing EN after stamp makes the pair stale again', ...)// stale = ['a.md']
test('stamp keeps the IT body and other frontmatter keys byte-identical', ...)
test('paths with spaces and non-ASCII characters work', ...) // 'città multi tenant.md'
test('non-markdown files are ignored', ...)                  // _category_.json, .png
```

- [ ] **Step 2: Eseguire e vedere il fallimento** — `node --test tools/i18n-parity.test.mjs` → FAIL

- [ ] **Step 3: Implementare `checkParity`, `stamp` e la CLI**

Directory predefinite della CLI: `website/docs` e `website/i18n/it/docusaurus-plugin-content-docs/current`. `check` stampa una riga per problema (`stale  a/b.md`) ed esce con 1 se una delle tre liste non è vuota.

- [ ] **Step 4: Scrivere `tools/glossary.yaml`**

Lista di voci `{ en, it, keep_english: boolean, note? }`. Voci iniziali con `keep_english: true`: tenant, control plane, rollback, deployment, pipeline, trunk-based, feature flag, GitOps, namespace, cluster. Con traduzione: business continuity → continuità operativa; disaster recovery → ripristino da disastro; noisy neighbour → vicino rumoroso.

- [ ] **Step 5: Timbrare `intro.md` e verificare**

Run: `node tools/i18n-parity.mjs stamp intro.md && task i18n:check` — Expected: exit 0.
Run: `task test:tools` — Expected: tutti PASS.

- [ ] **Step 6: Commit** — `git commit -m "feat(tools): add EN/IT parity check and glossary"`

---

### Task 5: Pipeline dei diagrammi draw.io

**Files:**
- Create: `tools/diagrams.mjs`, `diagrams/00-foundations/repo-map.drawio`, `diagrams/manifest.json`, `website/static/diagrams/00-foundations/repo-map.svg`
- Test: `tools/diagrams.test.mjs`
- Modify: `Taskfile.yml` (task `diagrams:export`, `diagrams:check`), `website/src/css/custom.css`, `intro.md` EN e IT

**Interfaces:**
- Produces: `planExports({ srcDir, outDir, manifest }): Promise<{ missing: string[], stale: string[], multiPage: string[], orphanSvg: string[] }>` — `manifest` è `Record<relPath, sha256>` dei sorgenti all'ultima esportazione.
- Produces: `runExport({ srcDir, outDir, manifestPath, exporter }): Promise<string[]>` con `exporter = (inPath: string, outPath: string) => Promise<void>`; restituisce i file esportati e aggiorna il manifest.
- Produces: per `diagrams/<p>.drawio` l'SVG è `website/static/diagrams/<p>.svg`, servito dal sito come `/diagrams/<p>.svg`.

- [ ] **Step 1: Verificare a mano i flag della CLI draw.io** (non verificati: l'installazione era rotta quando è stato scritto il piano)

Esportare un diagramma di prova fuori dal repo con `drawio --export --format svg --embed-diagram --border 10 --output out.svg in.drawio`. Expected: `out.svg` creato, apribile in draw.io come diagramma modificabile. Se i flag differiscono, usare quelli reali nell'esportatore.

- [ ] **Step 2: Scrivere i test che falliscono** (esportatore finto che scrive un file segnaposto)

```js
test('new .drawio with no SVG is missing', ...)
test('source changed since manifest hash is stale', ...)
test('deleted SVG is missing even when the manifest hash matches', ...)
test('SVG with no source is orphanSvg', ...)
test('a .drawio with two <diagram> elements is multiPage', ...)
test('runExport exports only missing and stale, then plan is clean', ...)
test('paths with spaces and non-ASCII characters reach the exporter unchanged', ...)
test('runExport refuses to export a multiPage file', ...)   // rejects, names the file
```

- [ ] **Step 3: Eseguire e vedere il fallimento** — `node --test tools/diagrams.test.mjs` → FAIL

- [ ] **Step 4: Implementare `planExports`, `runExport`, l'esportatore reale e la CLI**

Regola: un diagramma per file. `check` esce con 1 se una delle quattro liste non è vuota, una riga per problema. `export` usa l'esportatore reale (`execFile('drawio', [...])`).

- [ ] **Step 5: Disegnare `repo-map.drawio` e inserirlo in `intro.md`**

Contenuto: i tre pubblici → le tre viste (Understand / Decide / Copy) → le cartelle del repo che le alimentano (`website/docs`, `website/docs/adr`, `reference/`, `diagrams/`). Etichette in inglese. Inserirlo in `intro.md` EN e IT come immagine `/diagrams/00-foundations/repo-map.svg`, poi ritimbrare l'italiano.

- [ ] **Step 6: Fondo chiaro per i diagrammi**

In `custom.css`: le immagini il cui `src` contiene `/diagrams/` hanno sfondo `#fff`, padding 8px, raggio 6px, in entrambi i temi.

- [ ] **Step 7: Verificare**

Run: `task diagrams:export && task diagrams:check && task i18n:check && task site:build` — Expected: exit 0.
Run: modificare un'etichetta nel `.drawio` senza esportare, poi `task diagrams:check` — Expected: exit 1, `stale 00-foundations/repo-map.drawio`. Riesportare.
A mano: `task site:dev`, tema scuro, il diagramma è leggibile.

- [ ] **Step 8: Commit** — `git commit -m "feat(tools): add draw.io export pipeline and repo map"`

---

### Task 6: Forma di capitolo e ADR, con controllo automatico

**Files:**
- Create: `templates/chapter.en.md`, `templates/chapter.it.md`, `templates/adr.en.md`, `templates/adr.it.md`, `tools/content-lint.mjs`, `website/docs/compliance/traceability-matrix.md` e la sua traduzione
- Test: `tools/content-lint.test.mjs`
- Modify: `Taskfile.yml` (task `content:lint`)

**Interfaces:**
- Produces: `lintDoc(text: string, locale: 'en' | 'it', relPath: string): string[]` — messaggi di errore; vuoto se valido.
- Produces: contratto dei documenti (lo usano skill e agenti dal Task 8):

| `doc_type` | Frontmatter obbligatorio | Sezioni H2 obbligatorie EN | Sezioni H2 obbligatorie IT |
|---|---|---|---|
| `chapter` | `owner`, `status` ∈ `draft`·`reviewed`·`approved`, `last_reviewed` (`YYYY-MM-DD`) | `Understand`, `Decide`, `Copy`, `Verification status` | `Capire`, `Decidere`, `Copiare`, `Stato di verifica` |
| `adr` | `status` ∈ `proposed`·`accepted`·`superseded`, `date` (`YYYY-MM-DD`), `deciders` | `Context and Problem Statement`, `Considered Options`, `Decision Outcome` | `Contesto e problema`, `Opzioni considerate`, `Decisione` |
| `page` | — | — | — |

Gli ADR stanno in `website/docs/adr/` con nome `NNNN-kebab-title.md`. La sezione `Verification status` dice cosa è stato provato dal vivo in locale e cosa no.

- [ ] **Step 1: Scrivere i test che falliscono**

```js
test('every template passes its own lint', ...)             // the four files in templates/
test('missing doc_type is an error', ...)
test('unknown doc_type is an error', ...)
test('chapter without "Verification status" names that section', ...)
test('IT chapter with English headings fails', ...)
test('chapter with status "done" fails and lists allowed values', ...)
test('last_reviewed "10/11/2026" fails', ...)
test('ADR file named "first-adr.md" fails the NNNN-kebab rule', ...)
test('doc_type page has no structural rules', ...)
```

- [ ] **Step 2: Eseguire e vedere il fallimento** — `node --test tools/content-lint.test.mjs` → FAIL

- [ ] **Step 3: Scrivere i quattro template**

Capitolo: sotto `Understand` sintesi di una pagina e un diagramma; sotto `Decide` opzioni, matrice pesata (criterio · peso · punteggio per opzione), raccomandazione, "When to deviate", link all'ADR; sotto `Copy` link al pezzo eseguibile e checklist. ADR in formato MADR. Ogni sezione ha una riga di guida per chi scrive.

- [ ] **Step 4: Implementare `lintDoc` e la CLI**

La CLI scorre le due directory del Task 4 con la lingua giusta per ciascuna, una riga per errore (`website/docs/x.md: missing section "Copy"`), esce con 1 se ci sono errori.

- [ ] **Step 5: Scrivere lo scheletro della matrice di tracciabilità**

`doc_type: page`. Tabella vuota con colonne `Requirement · Source · Chapter · Control · Evidence · Verified live`, una frase su come si aggiunge una riga, e l'avvertenza: supporto tecnico alla conformità, non parere legale. Tradurre e timbrare.

- [ ] **Step 6: Verificare** — `task test:tools && task content:lint && task i18n:check && task site:build` → exit 0

- [ ] **Step 7: Commit** — `git commit -m "feat(content): add chapter and ADR templates with lint"`

---

### Task 7: Componente interattivo di base

**Files:**
- Create: `website/src/components/FlowExplorer/index.tsx`, `website/src/components/FlowExplorer/flow-schema.mjs`, `website/src/data/flows/agentic-chain.json`
- Test: `website/src/components/FlowExplorer/flow-schema.test.mjs`
- Modify: `website/package.json` (`@xyflow/react` 12.12.1), `Taskfile.yml` (task `flows:check`; `test:tools` esteso al glob `"website/src/**/*.test.mjs"`), `intro.md` → rinominato `intro.mdx` in EN e IT

**Interfaces:**
- Produces: tipo `Flow = { id: string, title: L, nodes: { id: string, label: L, x: number, y: number }[], edges: { from: string, to: string }[], steps: { title: L, body: L, highlight: string[] }[] }` con `L = { en: string, it: string }`.
- Produces: `validateFlow(flow: unknown): string[]`.
- Produces: `<FlowExplorer flow={flow} />`, importabile in MDX da `@site/src/components/FlowExplorer`.

- [ ] **Step 1: Scrivere i test che falliscono**

```js
test('a well-formed flow has no errors', ...)
test('edge pointing to an unknown node is reported with both ids', ...)
test('step highlighting an unknown node is reported', ...)
test('label missing the "it" text is reported with the node id', ...)
test('duplicate node ids are reported', ...)
test('a flow with no steps is reported', ...)
```

- [ ] **Step 2: Eseguire e vedere il fallimento** — `node --test "website/src/**/*.test.mjs"` → FAIL

- [ ] **Step 3: Implementare `validateFlow` e la CLI `flows:check`**

`flows:check` valida ogni JSON in `website/src/data/flows/`, una riga per errore, esce con 1 se ci sono errori.

- [ ] **Step 4: Implementare `FlowExplorer`** (caricare prima la skill `frontend-design:frontend-design`)

Tela React Flow in sola lettura, adattata al contenitore; sotto, titolo e testo del passo corrente con pulsanti Indietro/Avanti e indicatore `2 / 5`. I nodi in `highlight` sono evidenziati, gli altri attenuati. Lingua da `useDocusaurusContext().i18n.currentLocale`. Colori dalle variabili CSS del tema, così chiaro e scuro funzionano. Pulsanti raggiungibili da tastiera, stato disabilitato agli estremi. Utilizzabile a 375px di larghezza.

- [ ] **Step 5: Scrivere `agentic-chain.json` e inserirlo in `intro.mdx`**

Nodi: Research (Azure), Research (GCP), Research (on-prem/CNCF), Design, Your approval, Write, Diagrams, Runnable piece, Verify, Adversarial review, Translate. Un passo per fase del flusso, testi EN e IT. Ritimbrare l'italiano.

- [ ] **Step 6: Verificare**

Run: `task test:tools && task flows:check && task i18n:check && task site:build` — Expected: exit 0.
A mano con `task site:dev`: i passi scorrono, la lingua cambia con il selettore, il tema scuro è leggibile.

- [ ] **Step 7: Commit** — `git commit -m "feat(site): add FlowExplorer interactive component"`

---

### Task 8: Skill e agenti di progetto

**Files:**
- Create: `.claude/skills/{guideline-chapter,adr-author,drawio-diagram,interactive-diagram,reference-impl,bilingual-sync}/SKILL.md`
- Create: `.claude/agents/{researcher,architect-author,diagrammer,impl-builder,verifier,adversarial-reviewer,translator}.md`
- Create: `tools/agentic-lint.mjs` · Test: `tools/agentic-lint.test.mjs`
- Modify: `Taskfile.yml` (task `agentic:lint`)

**Interfaces:**
- Consumes: contratto dei documenti (Task 6), `stamp` (Task 4), `diagrams:export` (Task 5), `Flow` e `flows:check` (Task 7).
- Produces: `lintAgentic(rootDir: string): Promise<string[]>`.
- Produces: file di lavoro di un tema con slug `<section>/<topic>` (`<t>` = `<topic>`), tutti in `.work/<t>/`, non versionati:
  `research-azure.md`, `research-gcp.md`, `research-onprem.md`, `design.md`, `review.md`.

- [ ] **Step 1: Scrivere i test che falliscono** (alberi `.claude/` finti in directory temporanee)

```js
test('skill whose frontmatter name differs from its directory is reported', ...)
test('skill without description is reported', ...)
test('agent without name or description is reported', ...)
test('a missing expected skill or agent is reported by name', ...)  // the 6 + 7 above
test('workflow file not starting with "export const meta" is reported', ...)
test('a complete tree has no errors', ...)
```
I due workflow attesi sono `topic-design.js` e `topic-build.js`; finché il Task 9 non li crea, `agentic:lint` sul repo reale li segnala mancanti: è atteso.

- [ ] **Step 2: Eseguire e vedere il fallimento**, poi **implementare `lintAgentic` e la CLI** fino a PASS.

- [ ] **Step 3: Scrivere le sei skill** (caricare prima `superpowers:writing-skills`)

| Skill | Cosa fa fare | Termina solo quando |
|---|---|---|
| `guideline-chapter` | Scrive un capitolo EN da `design.md` partendo da `templates/chapter.en.md`. Ogni affermazione tecnica viene dai file di ricerca con la fonte; ciò che non ha fonte è marcato `UNVERIFIED` o tolto. `Verification status` riporta solo ciò che è stato davvero eseguito. | `task content:lint` passa |
| `adr-author` | Scrive un ADR MADR da `templates/adr.en.md`, numero = successivo libero, stato `proposed`. Solo l'utente lo porta ad `accepted`. | `task content:lint` passa |
| `drawio-diagram` | Genera XML mxGraph: un diagramma per file, etichette in inglese, in `diagrams/<section>/<name>.drawio`; poi esporta. | `task diagrams:check` passa |
| `interactive-diagram` | Scrive un `Flow` JSON in `website/src/data/flows/` con testi EN e IT e lo inserisce nel capitolo `.mdx`. | `task flows:check` e `task site:build` passano |
| `reference-impl` | Costruisce un pezzo eseguibile sotto `reference/` in TDD, con la sua verifica agganciata a `Taskfile.yml`. Mai risorse cloud. | la verifica aggiunta passa |
| `bilingual-sync` | Traduce EN → IT nel percorso speculare usando `tools/glossary.yaml`, con le intestazioni IT del contratto; non traduce codice, identificatori, nomi di file. Poi `stamp`. | `task i18n:check` e `task content:lint` passano |

- [ ] **Step 4: Scrivere i sette agenti**

Verificare il formato corrente del frontmatter degli agenti di Claude Code prima di scrivere (agente `claude-code-guide`).

| Agente | Legge | Scrive | Non può |
|---|---|---|---|
| `researcher` | documentazione ufficiale via web; per Azure anche skill `microsoft-docs` e MCP Azure | `.work/<t>/research-<lane>.md`: ogni affermazione con URL e data di accesso; non verificabile → `UNVERIFIED` | modificare il repo fuori da `.work/` |
| `architect-author` | i tre file di ricerca | `.work/<t>/design.md` (indice, opzioni, matrice pesata, raccomandazione, quando deviare, diagrammi previsti, pezzo eseguibile previsto oppure `none`, domande aperte); ADR; capitolo EN | creare risorse cloud |
| `diagrammer` | `design.md`, capitolo | `.drawio` + SVG, `Flow` JSON | cambiare il testo del capitolo oltre all'inserimento del diagramma |
| `impl-builder` | `design.md` | file sotto `reference/`, task di verifica | creare risorse cloud; toccare `dol-lab-aks` o il profilo `minikube` |
| `verifier` | — | niente: restituisce esito e output di `task verify` | modificare file |
| `adversarial-reviewer` | capitolo, ADR, file di ricerca. **Non riceve `design.md` né riassunti dell'autore.** | `.work/<t>/review.md`: rilievi con gravità `blocker`·`major`·`minor`, ciascuno con punto esatto e motivo | modificare file fuori da `.work/` |
| `translator` | capitolo e ADR EN, glossario | file IT, timbro | cambiare i file EN |

- [ ] **Step 5: Verificare** — `task test:tools` PASS; `task agentic:lint` segnala solo i due workflow mancanti.

- [ ] **Step 6: Commit** — `git commit -m "feat(agentic): add project skills and agents"`

---

### Task 9: Workflow salvati `topic-design` e `topic-build`

**Files:**
- Create: `.claude/workflows/topic-design.js`, `.claude/workflows/topic-build.js`

**Interfaces:**
- Consumes: agenti e file di lavoro del Task 8.
- Produces: `topic-design` — args `{ topic: string, title: string, brief: string }` → `{ designPath: string, adrPath: string, openQuestions: string[] }`.
- Produces: `topic-build` — args `{ topic: string, title: string }` → `{ verify: 'pass' | 'fail', openFindings: string[], files: string[] }`.

- [ ] **Step 1: Caricare la skill `workflow-authoring`** e seguirne API e avvertenze. Da lì si ricava come un passo del workflow usa una definizione in `.claude/agents/`; se non è possibile referenziarla, il prompt del passo dice all'agente di leggere quel file come proprie istruzioni.

- [ ] **Step 2: Scrivere `topic-design.js`** — 5 agenti

Fase `Research`: tre `researcher` in parallelo, corsie `azure`, `gcp`, `onprem`. Fase `Design`: `architect-author` scrive `design.md` e l'ADR `proposed`. Fase `Check`: `adversarial-reviewer` cerca in `design.md` affermazioni senza fonte nei file di ricerca (qui, e solo qui, legge `design.md`: sta controllando quello); i suoi rilievi finiscono in `openQuestions`. Il workflow non scrive il capitolo: si ferma per l'approvazione dell'utente.

- [ ] **Step 3: Scrivere `topic-build.js`** — 9 agenti

Fase `Build` in parallelo: `architect-author` (capitolo EN), `diagrammer`, `impl-builder` (saltato se `design.md` dice pezzo eseguibile `none`). Poi `Verify` (`verifier`) → `Review` (`adversarial-reviewer`) → `Fix` (`architect-author` risolve `blocker` e `major`; un solo giro) → `Translate` (`translator`) → `Final verify` (`verifier`). Se la verifica finale fallisce o restano `blocker`, il risultato è `verify: 'fail'` con l'elenco: il workflow non dichiara mai successo senza l'esito del verificatore.

- [ ] **Step 4: Verificare** — `task agentic:lint` → exit 0. La prova di comportamento è il Task 11.

- [ ] **Step 5: Commit** — `git commit -m "feat(agentic): add topic-design and topic-build workflows"`

---

### Task 10: `task verify` e `CLAUDE.md`

**Files:**
- Create: `CLAUDE.md`
- Modify: `Taskfile.yml` (task `verify`), `README.md`

**Interfaces:**
- Consumes: tutti i task precedenti.
- Produces: `task verify` = in ordine `doctor`, `test:tools`, `content:lint`, `i18n:check`, `diagrams:check`, `flows:check`, `agentic:lint`, `site:build`; si ferma al primo fallimento.

- [ ] **Step 1: Aggiungere `verify`** — Run: `task verify` → exit 0.

- [ ] **Step 2: Provare che `verify` blocca davvero**

Uno alla volta, ripristinando dopo ciascuno: aggiungere una riga a `website/docs/intro.mdx` (→ fallisce `i18n:check`); cancellare `website/static/diagrams/00-foundations/repo-map.svg` (→ `diagrams:check`); togliere `doc_type` da una pagina (→ `content:lint`). Expected: exit ≠ 0 ogni volta, con file e motivo.

- [ ] **Step 3: Scrivere `CLAUDE.md`** (inglese, sotto le 120 righe)

Contiene: scopo del repo e tre pubblici; mappa delle cartelle; regole fisse (nessuna risorsa cloud senza richiesta esplicita, mai `dol-lab-aks` né il profilo `minikube`, nessun push senza conferma, inglese canonico); contratto dei documenti con rimando ai template; come nasce un tema (`topic-design` → approvazione dell'utente → `topic-build`); `task verify` deve passare prima di dichiarare finito qualcosa; rimando a spec e piani in `docs/superpowers/`.

- [ ] **Step 4: Aggiornare `README.md`** — cos'è, come si avvia il sito (`task site:dev`), come si verifica (`task verify`).

- [ ] **Step 5: Commit** — `git commit -m "docs: add CLAUDE.md and aggregate verify task"`

---

### Task 11: Pilota — due capitoli veri attraverso la catena

**Files:**
- Create (via workflow): `website/docs/00-foundations/docs-as-code.mdx`, `website/docs/adr/0001-docs-as-code-bilingual.md`, `website/docs/00-foundations/governance.md`, traduzioni, diagrammi e flow che i design prevedono
- Modify: skill, agenti, workflow dove il pilota mostra difetti

**Interfaces:**
- Consumes: tutto.
- Produces: catena collaudata; capitolo F della spec (governo delle linee guida) pubblicato.

- [ ] **Step 1: `topic-design` sul primo tema**

Args: `topic: '00-foundations/docs-as-code'`, `title: 'Documentation as code'`, `brief`: perché linee guida come codice, Docusaurus rispetto alle alternative, inglese canonico con italiano tradotto e controllato, diagrammi draw.io + Mermaid + interattivi. Pezzo eseguibile: `none`.

- [ ] **Step 2: Cancello umano** — mostrare all'utente `design.md`, l'ADR `proposed` e le `openQuestions`. Procedere solo dopo la sua approvazione; integrare le sue correzioni in `design.md`.

- [ ] **Step 3: `topic-build` sul primo tema** — Expected: `verify: 'pass'`, `openFindings` vuoto o solo `minor`.

- [ ] **Step 4: Correggere la catena** — per ogni punto in cui un agente ha sbagliato formato, saltato un cancello o avuto bisogno di istruzioni che non aveva: correggere la skill o l'agente responsabile, non solo il capitolo. Elencare le correzioni nel messaggio di commit.

- [ ] **Step 5: Secondo tema con la catena corretta**

`topic: '00-foundations/governance'`, `title: 'Governing the guidelines'`, `brief`: chi possiede ogni capitolo, come si chiede un'eccezione, come si registra e quando scade, ciclo di revisione. Stessi passi 1–3 compreso il cancello umano. Atteso: nessuna nuova correzione alla catena; se ne servono, ripetere il passo 4.

- [ ] **Step 6: Verifica finale**

Run: `task verify` — Expected: exit 0.
A mano con `task site:dev`: i due capitoli esistono in EN e IT con le tre viste, l'ADR 0001 è raggiungibile dal capitolo, diagrammi leggibili in tema chiaro e scuro.
Limite dichiarato: la skill `reference-impl` e l'agente `impl-builder` non sono esercitati dal pilota (entrambi i temi hanno pezzo eseguibile `none`); il loro collaudo è il primo tema della fase 1.

- [ ] **Step 7: Commit** — `git commit -m "docs: add docs-as-code and governance chapters via agentic chain"`
