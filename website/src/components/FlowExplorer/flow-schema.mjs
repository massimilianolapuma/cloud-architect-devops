// Pure validation for FlowExplorer data. No React or browser imports, so both
// `node --test` and the component can load it.

const LOCALES = ['en', 'it'];

function isObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function checkL(value, where, errors) {
  if (!isObject(value)) {
    errors.push(`${where}: expected an object with "en" and "it" text`);
    return;
  }
  for (const loc of LOCALES) {
    if (typeof value[loc] !== 'string' || value[loc].trim() === '') {
      errors.push(`${where}: missing "${loc}" text`);
    }
  }
}

export function validateFlow(flow) {
  const errors = [];
  if (!isObject(flow)) return ['flow: expected an object'];

  if (typeof flow.id !== 'string' || flow.id === '') errors.push('flow: missing "id"');
  checkL(flow.title, 'flow title', errors);

  const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
  if (!Array.isArray(flow.nodes) || nodes.length === 0) errors.push('flow: "nodes" must be a non-empty array');
  const ids = new Set();
  for (const [i, n] of nodes.entries()) {
    if (!isObject(n) || typeof n.id !== 'string' || n.id === '') {
      errors.push(`node #${i}: missing "id"`);
      continue;
    }
    if (ids.has(n.id)) errors.push(`node ${n.id}: duplicate node id`);
    ids.add(n.id);
    checkL(n.label, `node ${n.id} label`, errors);
    if (typeof n.x !== 'number' || typeof n.y !== 'number') errors.push(`node ${n.id}: "x" and "y" must be numbers`);
  }

  const edges = Array.isArray(flow.edges) ? flow.edges : [];
  if (!Array.isArray(flow.edges)) errors.push('flow: "edges" must be an array');
  for (const [i, e] of edges.entries()) {
    if (!isObject(e)) {
      errors.push(`edge #${i}: expected an object`);
      continue;
    }
    for (const end of ['from', 'to']) {
      if (!ids.has(e[end])) errors.push(`edge ${e.from} -> ${e.to}: unknown node "${e[end]}" in "${end}"`);
    }
  }

  const steps = Array.isArray(flow.steps) ? flow.steps : [];
  if (steps.length === 0) errors.push('flow: "steps" must be a non-empty array');
  for (const [i, s] of steps.entries()) {
    const where = `step ${i + 1}`;
    if (!isObject(s)) {
      errors.push(`${where}: expected an object`);
      continue;
    }
    checkL(s.title, `${where} title`, errors);
    checkL(s.body, `${where} body`, errors);
    if (!Array.isArray(s.highlight)) {
      errors.push(`${where}: "highlight" must be an array of node ids`);
      continue;
    }
    for (const h of s.highlight) {
      if (!ids.has(h)) errors.push(`${where}: highlights unknown node "${h}"`);
    }
  }
  return errors;
}
