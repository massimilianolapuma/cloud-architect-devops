export const meta = {
  name: 'topic-design',
  description: 'Research a guideline topic in three lanes, draft design.md and a proposed ADR, then check the design against the research; stops for user approval',
  whenToUse: 'First half of a new guideline topic. args: { topic: "<section>/<topic>", title, brief }. Run topic-build only after the user approves design.md.',
  phases: [
    { title: 'Research', detail: 'three researcher agents in parallel: azure, gcp, onprem' },
    { title: 'Design', detail: 'architect-author writes .work/<topic>/design.md and a proposed ADR' },
    { title: 'Check', detail: 'adversarial-reviewer looks for design claims the research does not support' },
  ],
}

// Agents: 3 researcher + 1 architect-author + 1 adversarial-reviewer = 5.
// Nothing is committed here: the controller shows design.md, the ADR and the open
// questions to the user, and commits only after the user approves.

// The researcher model is set per call as well as in .claude/agents/researcher.md (keep the two equal).
// architect-author and adversarial-reviewer set none, so they run on the session model.
const TOPIC_RE = /^[a-z0-9-]+\/[a-z0-9-]+$/
const nonEmpty = (v) => typeof v === 'string' && v.trim() !== ''
const a = args || {}
const badArgs = []
if (!nonEmpty(a.topic) || !TOPIC_RE.test(a.topic)) badArgs.push('topic must match <section>/<topic> (lowercase letters, digits, hyphens), e.g. "00-foundations/docs-as-code"')
if (!nonEmpty(a.title)) badArgs.push('title must be a non-empty string')
if (!nonEmpty(a.brief)) badArgs.push('brief must be a non-empty string')
if (badArgs.length) throw new Error(`topic-design: invalid args: ${badArgs.join('; ')}`)

const topic = a.topic
const t = topic.split('/')[1]
const work = `.work/${t}`
const LANES = ['azure', 'gcp', 'onprem']
const NO_COMMIT = 'Do not commit: leave your changes uncommitted for the controller to review.'

// Agents may return absolute paths. The script has no cwd, so a path is made repo-relative
// on the string alone: cut everything before the first top-level entry of this repo. The
// prefix cut the first time is the repo root; later absolute paths must start with it.
// Returns null for a path with a '..' segment or one that cannot be normalised.
const TOP_DIRS = ['.work', 'website', 'diagrams', 'reference', 'templates', 'tools', '.claude', 'docs']
const TOP_FILES = ['Taskfile.yml', 'CLAUDE.md', 'README.md', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.gitignore']
let repoRoot = null
function repoPath(p) {
  if (typeof p !== 'string') return null
  const s = p.trim().replace(/^(\.\/)+/, '')
  if (!s || s.split('/').includes('..')) return null
  if (!s.startsWith('/')) return s
  if (repoRoot) return s.startsWith(repoRoot) && s.length > repoRoot.length ? s.slice(repoRoot.length) : null
  const segs = s.split('/')
  const i = segs.findIndex((x, k) => k > 0 && (k < segs.length - 1 ? TOP_DIRS.includes(x) : TOP_FILES.includes(x)))
  if (i < 0) return null
  repoRoot = `${segs.slice(0, i).join('/')}/`
  return segs.slice(i).join('/')
}
const pathProblem = (raw, expected) => (repoPath(raw) === null
  ? `returned "${raw}", which is not a path inside the repo`
  : `wrote ${repoPath(raw)}, expected ${expected}`)

const RESEARCH_SCHEMA = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'path of the research file you wrote' },
    findings: { type: 'integer', description: 'number of findings (F-ids) in the file' },
    unverified: { type: 'array', items: { type: 'string' }, description: 'the UNVERIFIED items, one line each' },
  },
  required: ['path', 'findings', 'unverified'],
}

const DESIGN_SCHEMA = {
  type: 'object',
  properties: {
    designPath: { type: 'string', description: 'path of design.md' },
    adrPath: { type: 'string', description: 'path of the proposed ADR, website/docs/adr/NNNN-kebab-title.md' },
    contentLint: { type: 'string', description: 'last line printed by task content:lint after writing the ADR' },
    openQuestions: { type: 'array', items: { type: 'string' }, description: 'the "Open questions" of design.md, one line each' },
  },
  required: ['designPath', 'adrPath', 'contentLint', 'openQuestions'],
}

const CHECK_SCHEMA = {
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
          summary: { type: 'string', description: 'one line: the claim and what is wrong with it' },
        },
        required: ['id', 'severity', 'summary'],
      },
    },
  },
  required: ['reviewPath', 'findings'],
}

phase('Research')
const research = await parallel(LANES.map((lane) => () =>
  agent(
    `topic: ${topic}\ntitle: ${a.title}\nlane: ${lane}\nbrief:\n${a.brief}`,
    { agentType: 'researcher', model: 'sonnet', label: `research:${lane}`, phase: 'Research', schema: RESEARCH_SCHEMA },
  )))

const failedLanes = []
LANES.forEach((lane, i) => {
  const r = research[i]
  const expected = `${work}/research-${lane}.md`
  if (!r) failedLanes.push(`${lane}: agent did not complete`)
  else if (repoPath(r.path) !== expected) failedLanes.push(`${lane}: ${pathProblem(r.path, expected)}`)
  else if (!(r.findings > 0)) failedLanes.push(`${lane}: no findings`)
  else log(`research ${lane}: ${r.findings} findings, ${r.unverified.length} unverified`)
})
if (failedLanes.length) {
  throw new Error(`topic-design: research incomplete, design not attempted (${failedLanes.join('; ')}). Fix or rerun the failed lanes, then resume.`)
}

phase('Design')
const design = await agent(
  `mode: design\ntopic: ${topic}\ntitle: ${a.title}\nbrief:\n${a.brief}\n\n${NO_COMMIT}`,
  { agentType: 'architect-author', label: 'design', phase: 'Design', schema: DESIGN_SCHEMA },
)
if (!design) throw new Error('topic-design: architect-author (design) did not complete; no design to check.')
const designPath = `${work}/design.md`
if (repoPath(design.designPath) !== designPath) {
  throw new Error(`topic-design: architect-author (design) ${pathProblem(design.designPath, designPath)}.`)
}
const adrPath = repoPath(design.adrPath)
if (!adrPath || !/^website\/docs\/adr\/\d{4}-[a-z0-9-]+\.md$/.test(adrPath)) {
  throw new Error(`topic-design: ADR path "${design.adrPath}" is not website/docs/adr/NNNN-kebab-title.md.`)
}

const openQuestions = [...design.openQuestions]
if (!/content lint OK/.test(design.contentLint)) {
  openQuestions.push(`content:lint did not pass after the design step: ${design.contentLint}`)
}

phase('Check')
// The reviewer gets only the topic and the mode: never the author's reply.
const check = await agent(
  `mode: design-check\ntopic: ${topic}`,
  { agentType: 'adversarial-reviewer', label: 'design-check', phase: 'Check', schema: CHECK_SCHEMA },
)
if (!check) {
  openQuestions.push('design-check did not complete: design.md has not been checked against the research files')
} else {
  const reviewPath = `${work}/review.md`
  if (repoPath(check.reviewPath) !== reviewPath) {
    openQuestions.push(`design-check ${pathProblem(check.reviewPath, reviewPath)}: its findings below may not be in ${reviewPath}`)
  }
  const where = repoPath(check.reviewPath) || check.reviewPath
  log(`design-check: ${check.findings.length} findings in ${where}`)
  for (const f of check.findings) {
    openQuestions.push(`design-check ${f.id} (${f.severity}): ${f.summary} [${where}]`)
  }
}

return { designPath, adrPath, openQuestions }
