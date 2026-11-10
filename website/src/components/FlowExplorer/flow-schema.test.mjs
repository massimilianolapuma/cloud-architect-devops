import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateFlow } from './flow-schema.mjs';

const L = (en, it = en) => ({ en, it });

function good() {
  return {
    id: 'demo',
    title: L('Demo', 'Demo'),
    nodes: [
      { id: 'a', label: L('A'), x: 0, y: 0 },
      { id: 'b', label: L('B'), x: 200, y: 0 },
    ],
    edges: [{ from: 'a', to: 'b' }],
    steps: [{ title: L('One'), body: L('First'), highlight: ['a'] }],
  };
}

test('a well-formed flow has no errors', () => {
  assert.deepEqual(validateFlow(good()), []);
});

test('edge pointing to an unknown node is reported with both ids', () => {
  const f = good();
  f.edges.push({ from: 'a', to: 'zzz' });
  const errors = validateFlow(f);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /a/);
  assert.match(errors[0], /zzz/);
});

test('step highlighting an unknown node is reported', () => {
  const f = good();
  f.steps[0].highlight.push('ghost');
  const errors = validateFlow(f);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /ghost/);
});

test('label missing the "it" text is reported with the node id', () => {
  const f = good();
  f.nodes[1].label = { en: 'B' };
  const errors = validateFlow(f);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /b/);
  assert.match(errors[0], /it/);
});

test('duplicate node ids are reported', () => {
  const f = good();
  f.nodes.push({ id: 'a', label: L('A2'), x: 0, y: 100 });
  const errors = validateFlow(f);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /duplicate/);
});

test('a flow with no steps is reported', () => {
  const f = good();
  f.steps = [];
  const errors = validateFlow(f);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /steps/);
});
