import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, checkTools } from './doctor.mjs';

const req = (overrides = {}) => ({
  name: 'tool',
  cmd: 'tool',
  versionArgs: ['--version'],
  versionPattern: '(\\d+\\.\\d+\\.\\d+)',
  required: true,
  install: 'brew install tool',
  ...overrides,
});

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
