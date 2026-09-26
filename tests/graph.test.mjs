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

test('calculateConnectionPaths connects flush to bottom of cards with 0 gap', async () => {
  const { calculateConnectionPaths, getNodeHeight } = await import('../src/utils/canvasMath.ts');
  const cardA = { id: 'a', type: 'concept', x: 100, y: 100, width: 280, title: 'Card A' };
  const cardB = { id: 'b', type: 'concept', x: 100, y: 300, width: 280, title: 'Card B' };
  const heightA = getNodeHeight(cardA);

  // Card A is at y: 100, heightA. Bottom of Card A is exactly 100 + heightA.
  const paths = calculateConnectionPaths([cardA, cardB], [{ id: 'e1', from: 'a', to: 'b' }]);
  assert.equal(paths.length, 1);
  const path = paths[0].path;
  // Must start at y = 100 + heightA
  const expectedStartY = 100 + heightA;
  assert.ok(path.startsWith(`M 240 ${expectedStartY}`), `Path should start flush at bottom of Card A (${expectedStartY}), got: ${path}`);
  // Must end at y = 300 (top of Card B)
  assert.ok(path.endsWith('240 300'), `Path should end flush at top of Card B (300), got: ${path}`);

  // Test reverse: Card B above Card A
  const reversePaths = calculateConnectionPaths([cardA, cardB], [{ id: 'e2', from: 'b', to: 'a' }]);
  assert.equal(reversePaths.length, 1);
  const reversePath = reversePaths[0].path;
  // Card B is at y: 300, Card A is at y: 100. Exit top of Card B (y=300), enter bottom of Card A (y=100+heightA)
  assert.ok(reversePath.startsWith('M 240 300'), `Reverse path should start at top of Card B (300), got: ${reversePath}`);
  assert.ok(reversePath.endsWith(`240 ${expectedStartY}`), `Reverse path should end flush at bottom of Card A (${expectedStartY}), got: ${reversePath}`);
});

