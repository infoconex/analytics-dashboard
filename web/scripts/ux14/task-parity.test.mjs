import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tasks, decidePair, assertEvidenceSafe } from './task-parity.mjs';

test('all UX-12 tasks are classified exactly once and cannot be paired by default', () => {
  assert.deepEqual(tasks.map(task => task.id), [
    'T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10A', 'T10B', 'T11', 'T12', 'T13',
  ]);
  for (const task of tasks) assert.equal(decidePair(task, {}), task.excluded ? 'excluded' : 'unapproved');
});

test('T02 is conditional on real matching catalog-to-report paths and same synthetic data', () => {
  const task = tasks.find(item => item.id === 'T02');
  const eligible = { analytics: { completed: true, initial: 'dashboard-catalog', endpoint: 'revenue-view',
    fixtureSha: 'source-sha', role: 'read-only' }, kibana: { completed: true,
    initial: 'dashboard-catalog', endpoint: 'revenue-view', fixtureSha: 'source-sha', role: 'read-only' } };
  assert.equal(decidePair(task, eligible), 'conditional-scripted-pair');
  assert.equal(decidePair(task, { ...eligible, kibana: { ...eligible.kibana, initial: 'direct-dashboard-url' } }), 'unapproved');
  assert.equal(decidePair(task, { ...eligible, kibana: { ...eligible.kibana, fixtureSha: 'wrong' } }), 'unapproved');
  assert.equal(decidePair(task, { ...eligible, kibana: { ...eligible.kibana, completed: false } }), 'unapproved');
});

test('security, tenant switching, embedding and service-recovery tasks never become paired by matching flags', () => {
  const evidence = { analytics: { completed: true, initial: 'dashboard-catalog', endpoint: 'revenue-view', fixtureSha: 'same', role: 'read-only' },
    kibana: { completed: true, initial: 'dashboard-catalog', endpoint: 'revenue-view', fixtureSha: 'same', role: 'read-only' } };
  for (const id of ['T10A', 'T10B', 'T11', 'T12', 'T13']) {
    assert.equal(decidePair(tasks.find(task => task.id === id), evidence), 'excluded');
  }
});

test('review files must never include credential values or participant fields', () => {
  assert.doesNotThrow(() => assertEvidenceSafe({ participantCount: 0, role: 'read-only', task: 'T02' }));
  assert.throws(() => assertEvidenceSafe({ password: 'example' }), /unsafe/i);
  assert.throws(() => assertEvidenceSafe({ authorization: 'Bearer value' }), /unsafe/i);
  assert.throws(() => assertEvidenceSafe({ participantName: 'test' }), /unsafe/i);
});
