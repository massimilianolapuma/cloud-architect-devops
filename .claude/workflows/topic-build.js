export const meta = {
  name: 'topic-build',
  description: 'Build an approved guideline topic: English chapter, diagrams and runnable piece, verify, adversarial review, one fix round, Italian translation, final verify',
  whenToUse: 'Second half of a guideline topic, only after the user approved .work/<topic>/design.md from topic-design. args: { topic: "<section>/<topic>", title }.',
  phases: [
    { title: 'Plan', detail: 'read design.md: chapter path, ADR path, runnable piece' },
    { title: 'Build', detail: 'architect-author (chapter), diagrammer, impl-builder in parallel' },
    { title: 'Verify', detail: 'verifier, pre-translation: every gate except i18n:check' },
    { title: 'Review', detail: 'adversarial-reviewer, never sees design.md' },
    { title: 'Fix', detail: 'architect-author resolves blocker and major findings, one round' },
    { title: 'Translate', detail: 'translator writes the Italian chapter and ADR' },
    { title: 'Final verify', detail: 'verifier runs every gate' },
  ],
}

// Agents: plan 1 + build 3 (2 when the runnable piece is none) + verify 1 + review 1
// + fix 1 (skipped when nothing to fix) + translate 1 + final verify 1 = at most 9.
// Nothing is committed here: the controller reviews the returned files and commits them.

const TOPIC_RE = /^[a-z0-9-]+\/[a-z0-9-]+$/
const nonEmpty = (v) => typeof v === 'string' && v.trim() !== ''
const a = args || {}
const badArgs = []
if (!nonEmpty(a.topic) || !TOPIC_RE.test(a.topic)) badArgs.push('topic must match <section>/<topic> (lowercase letters, digits, hyphens), e.g. "00-foundations/docs-as-code"')
if (!nonEmpty(a.title)) badArgs.push('title must be a non-empty string')
if (badArgs.length) throw new Error(`topic-build: invalid args: ${badArgs.join('; ')}`)

const topic = a.topic
const [section, t] = topic.split('/')
const work = `.work/${t}`
const designPath = `${work}/design.md`
const reviewPath = `${work}/review.md`
const researchPaths = ['azure', 'gcp', 'onprem'].map((lane) => `${work}/research-${lane}.md`)
const NO_COMMIT = 'Do not commit: leave your changes uncommitted for the controller to review.'

const strings = { type: 'array', items: { type: 'string' } }

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    missing: { ...strings, description: 'every listed path that does not exist' },
    chapterPath: { type: 'string', description: 'the "Chapter file:" path in design.md, exactly as written' },
    adrPath: { type: 'string', description: 'the ADR path in the "Draft ADR" section of design.md' },
    runnablePiece: { type: 'string', description: '"none" if "Planned runnable piece" says none; otherwise the reference/<area>/<piece>/ path it names' },
  },
  required: ['missing', 'chapterPath', 'adrPath', 'runnablePiece'],
}

const CHAPTER_SCHEMA = {
  type: 'object',
  properties: {
    files: { ...strings, description: 'every file you created or changed' },
    gateOutput: { type: 'string', description: 'output of the gates your skills require' },
  },
  required: ['files', 'gateOutput'],
}

const DIAGRAM_SCHEMA = {
  type: 'object',
  properties: {
    files: { ...strings, description: 'every file you created or changed' },
    embedsNotInserted: { ...strings, description: 'embed lines you could not insert (chapter missing or flow needs .mdx), exactly as they must appear' },
    gateOutput: { type: 'string' },
  },
  required: ['files', 'embedsNotInserted', 'gateOutput'],
}

const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['done', 'not exercised live', 'none', 'failed'] },
    task: { type: 'string', description: 'the ref:<piece> task name, or "" if none' },
    files: { ...strings, description: 'every file you created or changed' },
    output: { type: 'string', description: 'raw output of task ref:<piece>, or the reason it did not run' },
  },
  required: ['status', 'task', 'files', 'output'],
}

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['PASS', 'FAIL'] },
    gates: {
      type: 'array',
      items: {
        type: 'object',
        properties: { gate: { type: 'string' }, exit: { type: 'integer' }, resultLine: { type: 'string' } },
        required: ['gate', 'exit', 'resultLine'],
      },
      description: 'one entry per gate you ran',
    },
    report: { type: 'string', description: 'your complete reply in the exact shape your instructions define, including the raw output of failing gates' },
  },
  required: ['verdict', 'gates', 'report'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    reviewPath: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'R1, R2, ...' },
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          summary: { type: 'string', description: 'one line: where and what is wrong' },
        },
        required: ['id', 'severity', 'summary'],
      },
    },
  },
  required: ['reviewPath', 'findings'],
}

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    responses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          resolution: { type: 'string', enum: ['fixed', 'rejected'] },
          note: { type: 'string', description: 'what changed, or the reason and evidence for rejecting' },
        },
        required: ['id', 'resolution', 'note'],
      },
      description: 'one entry per blocker and major finding, as in your Author response',
    },
    gateFailuresNotFixed: { ...strings, description: 'failing gates from the verifier output you could not fix, with the reason' },
    files: { ...strings, description: 'every file you changed' },
    gateOutput: { type: 'string' },
  },
  required: ['responses', 'gateFailuresNotFixed', 'files', 'gateOutput'],
}

const TRANSLATE_SCHEMA = {
  type: 'object',
  properties: {
    files: { ...strings, description: 'every Italian file written' },
    stamped: strings,
    englishIssues: { ...strings, description: 'problems you noticed in the English files and did not change' },
    gateOutput: { type: 'string' },
  },
  required: ['files', 'stamped', 'englishIssues', 'gateOutput'],
}

// Collected deliverables (paths under .work/ are git-ignored and not listed).
const files = new Set()
const addFiles = (list) => (list || []).filter((f) => !f.startsWith('.work/')).forEach((f) => files.add(f))
// Lines that make the result 'fail' whatever the final verifier says.
const stepFailures = []
const finish = (verify, openFindings) => ({ verify, openFindings, files: [...files].sort() })

// A verifier result counts as PASS only if it says PASS and every gate it ran exited 0.
const failingGates = (v) => v.gates.filter((g) => g.exit !== 0)
const passed = (v) => v.verdict === 'PASS' && v.gates.length > 0 && failingGates(v).length === 0

// ---------------------------------------------------------------------------
phase('Plan')
// The workflow cannot read files, so one cheap read-only step extracts the facts it branches on.
const plan = await agent(
  `Read ${designPath} and report from it, without changing anything and without running any command (use only Read, Glob and Grep). ` +
  `Also check that these exist and list in "missing" any that does not: ${designPath}, ${researchPaths.join(', ')}, and the ADR path design.md names.`,
  { label: 'read design', phase: 'Plan', schema: PLAN_SCHEMA, effort: 'low' },
)
if (!plan) throw new Error('topic-build: could not read design.md; nothing built.')
if (plan.missing.length) throw new Error(`topic-build: missing inputs, run topic-design first: ${plan.missing.join(', ')}`)
const chapterRe = new RegExp(`^website/docs/${section}/${t}\\.mdx?$`)
if (!chapterRe.test(plan.chapterPath)) {
  throw new Error(`topic-build: design.md "Chapter file" is "${plan.chapterPath}", expected website/docs/${section}/${t}.md or .mdx`)
}
if (!/^website\/docs\/adr\/\d{4}-[a-z0-9-]+\.md$/.test(plan.adrPath)) {
  throw new Error(`topic-build: design.md names ADR "${plan.adrPath}", expected website/docs/adr/NNNN-kebab-title.md`)
}
const chapterPath = plan.chapterPath
const adrPath = plan.adrPath
const runnable = !/^none\b/i.test(plan.runnablePiece.trim())
log(`chapter ${chapterPath}, ADR ${adrPath}, runnable piece: ${runnable ? plan.runnablePiece : 'none (impl-builder skipped)'}`)

// ---------------------------------------------------------------------------
phase('Build')
const builders = [
  () => agent(
    `mode: chapter\ntopic: ${topic}\ntitle: ${a.title}\nchapter file: ${chapterPath}\nADR: ${adrPath}\n\n${NO_COMMIT}`,
    { agentType: 'architect-author', label: 'chapter', phase: 'Build', schema: CHAPTER_SCHEMA },
  ),
  () => agent(
    `topic: ${topic}\nchapter file: ${chapterPath}\n\n${NO_COMMIT}`,
    { agentType: 'diagrammer', label: 'diagrams', phase: 'Build', schema: DIAGRAM_SCHEMA },
  ),
]
if (runnable) {
  builders.push(() => agent(
    `topic: ${topic}\n\n${NO_COMMIT}`,
    { agentType: 'impl-builder', label: 'runnable piece', phase: 'Build', schema: IMPL_SCHEMA },
  ))
}
const [chapter, diagrams, impl] = await parallel(builders)

if (!diagrams) stepFailures.push('build: diagrammer did not complete')
else addFiles(diagrams.files)
if (runnable) {
  if (!impl) stepFailures.push('build: impl-builder did not complete')
  else {
    addFiles(impl.files)
    if (impl.status === 'failed') stepFailures.push(`build: impl-builder failed: ${impl.output.split('\n')[0]}`)
    else log(`runnable piece: ${impl.status}${impl.task ? ` (task ${impl.task})` : ''}`)
  }
}
if (!chapter) {
  return finish('fail', [...stepFailures, 'build: architect-author (chapter) did not complete; nothing to review'])
}
addFiles([chapterPath, adrPath, ...chapter.files])

// ---------------------------------------------------------------------------
phase('Verify')
// Italian files do not exist yet, so i18n:check is excluded by design; the final verify runs it.
const firstVerify = await agent(
  `Mode: pre-translation. The translator has not run yet: run every gate except task i18n:check.`,
  { agentType: 'verifier', label: 'verify (pre-translation)', phase: 'Verify', schema: VERIFY_SCHEMA },
)
const firstPassed = !!firstVerify && passed(firstVerify)
if (!firstVerify) log('pre-translation verify did not complete; continuing to review')
else log(`pre-translation verify: ${firstPassed ? 'PASS' : `FAIL (${failingGates(firstVerify).map((g) => g.gate).join(', ') || 'verdict FAIL'})`}`)

// ---------------------------------------------------------------------------
phase('Review')
// Isolation: only the topic, the chapter, the ADR and the research files. No design.md, no author text.
const review = await agent(
  `mode: build-review\ntopic: ${topic}\nchapter: ${chapterPath}\nADR: ${adrPath}\nresearch files: ${researchPaths.join(', ')}`,
  { agentType: 'adversarial-reviewer', label: 'review', phase: 'Review', schema: REVIEW_SCHEMA },
)
if (!review) {
  return finish('fail', [...stepFailures, 'review: adversarial-reviewer did not complete; nothing was fixed, translated or finally verified'])
}
if (review.reviewPath !== reviewPath) stepFailures.push(`review: written to ${review.reviewPath}, expected ${reviewPath}`)
const toFix = review.findings.filter((f) => f.severity === 'blocker' || f.severity === 'major')
log(`review: ${review.findings.length} findings, ${toFix.length} blocker/major`)

// ---------------------------------------------------------------------------
phase('Fix')
let fix = null
const needsFix = toFix.length > 0 || !firstPassed
if (needsFix) {
  const verifierInput = !firstVerify
    ? 'The pre-translation verifier did not complete: there is no gate output.'
    : firstPassed
      ? 'The pre-translation verifier passed every gate it ran.'
      : 'The pre-translation verifier (every gate except task i18n:check) failed. Fix the failures in files you may edit ' +
        `and list the others in gateFailuresNotFixed. Its raw output:\n\n${firstVerify.report}`
  const extra = []
  if (diagrams && diagrams.embedsNotInserted.length) {
    extra.push(`The diagrammer could not insert these embed lines; make sure each is in the chapter:\n${diagrams.embedsNotInserted.join('\n')}`)
  }
  fix = await agent(
    `mode: fix\ntopic: ${topic}\ntitle: ${a.title}\nchapter: ${chapterPath}\nADR: ${adrPath}\nreview: ${review.reviewPath}\n\n` +
    `${verifierInput}` +
    `${extra.length ? `\n\n${extra.join('\n\n')}` : ''}\n\n${NO_COMMIT}`,
    { agentType: 'architect-author', label: 'fix', phase: 'Fix', schema: FIX_SCHEMA },
  )
  if (!fix) {
    return finish('fail', [...stepFailures, ...toFix.map((f) => `${f.id} (${f.severity}): ${f.summary} — not addressed: fix step did not complete`)])
  }
  addFiles(fix.files)
  fix.gateFailuresNotFixed.forEach((g) => log(`fix: gate failure not fixed: ${g}`))
} else {
  log('fix skipped: no blocker or major finding and the pre-translation verify passed')
}

// Findings that stay open after the single fix round. A finding counts as resolved only
// if the author's response marks it fixed; the reasons are in review.md "Author response".
const responseById = new Map(((fix && fix.responses) || []).map((r) => [r.id, r]))
const openFindings = []
let openBlockers = 0
for (const f of review.findings) {
  if (f.severity === 'minor') {
    openFindings.push(`${f.id} (minor): ${f.summary} — not in fix scope`)
    continue
  }
  const r = responseById.get(f.id)
  if (r && r.resolution === 'fixed') continue
  if (f.severity === 'blocker') openBlockers++
  openFindings.push(`${f.id} (${f.severity}): ${f.summary} — ${r ? `rejected: ${r.note}` : 'not addressed'}`)
}

// ---------------------------------------------------------------------------
phase('Translate')
const translation = await agent(
  `Translate these English files:\n${chapterPath}\n${adrPath}\n\n${NO_COMMIT}`,
  { agentType: 'translator', label: 'translate', phase: 'Translate', schema: TRANSLATE_SCHEMA },
)
if (!translation) {
  return finish('fail', [...stepFailures, ...openFindings, 'translate: translator did not complete; final verify not run'])
}
addFiles(translation.files)
translation.englishIssues.forEach((i) => log(`translator noted in English: ${i}`))

// ---------------------------------------------------------------------------
phase('Final verify')
const finalVerify = await agent(
  'Run every gate. All steps, including the translation, have run.',
  { agentType: 'verifier', label: 'final verify', phase: 'Final verify', schema: VERIFY_SCHEMA },
)
if (!finalVerify) {
  return finish('fail', [...stepFailures, ...openFindings, 'final verify: verifier did not complete'])
}
const finalPassed = passed(finalVerify)
const gateLines = failingGates(finalVerify).map((g) => `gate ${g.gate} failed (exit ${g.exit}): ${g.resultLine}`)
if (!finalPassed && !gateLines.length) gateLines.push(`final verify: ${finalVerify.verdict} without a failing gate listed; see the verifier report`)

const ok = finalPassed && openBlockers === 0 && stepFailures.length === 0
log(`final verify: ${finalPassed ? 'PASS' : 'FAIL'}; open blockers: ${openBlockers}`)
return finish(ok ? 'pass' : 'fail', [...stepFailures, ...gateLines, ...openFindings])
