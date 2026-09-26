import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addNode,
  addRelationship,
  exportContextMarkdown,
  exportMermaid,
  neighborhood,
  normalizeGraph,
  removeNode
} from '../src/lib/graph.ts';

const concept = (id, title = id, type = 'concept') => ({ id, type, x: 0, y: 0, title, createdAt: 1 });
const relation = (id, from, to, label = 'supports') => ({ id, from, to, label });

test('normalizes a graph and rejects duplicate or dangling ids', () => {
  const graph = normalizeGraph([concept('a'), concept('b')], [relation('e', 'a', 'b')]);
  assert.deepEqual(Object.keys(graph.nodesById), ['a', 'b']);
  assert.throws(() => normalizeGraph([concept('a'), concept('a')], []), /Duplicate node/);
  assert.throws(() => normalizeGraph([concept('a')], [relation('e', 'a', 'missing')]), /missing node/);
});

test('graph operations keep edges valid and traverse neighbors', () => {
  let graph = normalizeGraph([concept('a'), concept('b')], []);
  graph = addNode(graph, concept('c'));
  graph = addRelationship(graph, relation('e1', 'a', 'b'));
  graph = addRelationship(graph, relation('e2', 'b', 'c', 'derived from'));
  assert.deepEqual([...neighborhood(graph, 'a', 2)].sort(), ['a', 'b', 'c']);
  assert.throws(() => addRelationship(graph, relation('e3', 'a', 'missing')), /endpoints/);
  graph = removeNode(graph, 'b');
  assert.deepEqual(Object.keys(graph.edgesById), []);
});

test('Mermaid ids are stable and labels are escaped', () => {
  const graph = normalizeGraph(
    [concept('claim / 1', 'A "quoted" claim | with newline\nnext'), concept('source:1', 'Source')],
    [relation('e1', 'source:1', 'claim / 1', 'supports | confirms')]
  );
  const output = exportMermaid(graph);
  assert.match(output, /^graph TD\n/);
  assert.match(output, /&quot;quoted&quot;/);
  assert.match(output, /supports &#124; confirms/);
  assert.equal(output, exportMermaid(graph));
});

test('context export is deterministic and includes provenance and sources', () => {
  const graph = normalizeGraph(
    [
      { ...concept('c', 'RAG'), content: 'Retrieval supplies external context.', metadata: { origin: 'ai', rationale: 'Derived from the source.' } },
      { ...concept('s', 'Retrieval paper', 'source'), url: 'https://example.org/paper', description: 'A research paper.' },
      concept('q', 'How should retrieval be evaluated?', 'question')
    ],
    [relation('e', 's', 'c', 'supports')]
  );
  const output = exportContextMarkdown(graph, 'RAG research');
  assert.match(output, /# RAG research/);
  assert.match(output, /Provenance: Derived from the source\./);
  assert.match(output, /https:\/\/example\.org\/paper/);
  assert.match(output, /How should retrieval be evaluated\?/);
  assert.equal(output, exportContextMarkdown(graph, 'RAG research'));
});
