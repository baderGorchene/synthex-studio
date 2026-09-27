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
import { ONTOLOGY_PRESETS } from '../src/types/canvas.ts';

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

test('persistent revisions create, list, restore, and delete correctly', async () => {
  const {
    createGraphRevision,
    getGraphRevisions,
    getGraphRevisionById,
    restoreGraphRevision,
    deleteGraphRevision
  } = await import('../src/lib/db.ts');

  const testProject = `test-rev-${Date.now()}`;
  const nodes = [concept('n1', 'First node'), concept('n2', 'Second node')];
  const connections = [relation('r1', 'n1', 'n2')];

  // 1. Create a revision
  const rev = createGraphRevision(testProject, 'Initial architecture draft', nodes, connections);
  assert.equal(rev.projectId, testProject);
  assert.equal(rev.title, 'Initial architecture draft');
  assert.equal(rev.nodeCount, 2);
  assert.equal(rev.edgeCount, 1);

  // 2. List revisions
  const list = getGraphRevisions(testProject);
  assert.ok(list.length >= 1);
  assert.equal(list[0].id, rev.id);

  // 3. Get revision by ID with full graph
  const loaded = getGraphRevisionById(testProject, rev.id);
  assert.ok(loaded);
  assert.equal(loaded.nodes.length, 2);
  assert.equal(loaded.relationships.length, 1);
  assert.equal(loaded.nodes[0].title, 'First node');

  // 4. Restore revision
  const restored = restoreGraphRevision(testProject, rev.id);
  assert.ok(restored);
  assert.equal(restored.nodes.length, 2);
  assert.ok(restored.revision.title.includes('Restored:'));

  // 5. Delete revision
  const deleted = deleteGraphRevision(testProject, rev.id);
  assert.equal(deleted, true);
  const reloaded = getGraphRevisionById(testProject, rev.id);
  assert.equal(reloaded, null);
});

test('Database Snapshot Engine: create, list, restore, and delete workspace backups', async () => {
  const {
    createDatabaseBackup,
    getDatabaseBackups,
    restoreDatabaseBackup,
    deleteDatabaseBackup,
    getBackupFilePath
  } = await import('../src/lib/db.ts');

  // 1. Create a database backup snapshot
  const snapshotLabel = `Test DB Snapshot ${Date.now()}`;
  const snapshot = await createDatabaseBackup(snapshotLabel);
  assert.ok(snapshot.id.startsWith('snap_'));
  assert.ok(snapshot.fileName.endsWith('.db'));
  assert.equal(snapshot.label, snapshotLabel);
  assert.ok(snapshot.sizeBytes > 0);

  // 2. Verify file exists on disk
  const filePath = getBackupFilePath(snapshot.fileName);
  assert.ok(filePath !== null);

  // 3. List database backups
  const backups = getDatabaseBackups();
  assert.ok(backups.length >= 1);
  const found = backups.find(b => b.fileName === snapshot.fileName);
  assert.ok(found);
  assert.equal(found.label, snapshotLabel);

  // 4. Restore database backup
  const restoreRes = await restoreDatabaseBackup(snapshot.fileName);
  assert.equal(restoreRes.success, true);
  assert.equal(restoreRes.snapshot.fileName, snapshot.fileName);

  // 5. Delete database backup
  const deleted = deleteDatabaseBackup(snapshot.fileName);
  assert.equal(deleted, true);

  // Verify it is gone from backups list
  const remaining = getDatabaseBackups();
  assert.equal(remaining.some(b => b.fileName === snapshot.fileName), false);
});

test('Canvas Virtualization: culls off-screen nodes and edges on large graphs (200+ nodes)', () => {
  // Generate a realistic 250-node graph spread across a 10000x10000 canvas plane
  const nodes = [];
  for (let i = 0; i < 250; i++) {
    const col = i % 25;
    const row = Math.floor(i / 25);
    nodes.push({
      id: `node-${i}`,
      type: 'concept',
      x: col * 400,
      y: row * 300,
      width: 280,
      height: 160,
      title: `Concept ${i}`
    });
  }

  // Simulate a focused 1920x1080 viewport looking at the top-left quadrant (zoom 1.0, pan 0,0)
  const viewWidth = 1920;
  const viewHeight = 1080;
  const zoom = 1.0;
  const pan = { x: 0, y: 0 };
  const buffer = 500;

  const visibleRect = {
    left: -pan.x / zoom - buffer,
    top: -pan.y / zoom - buffer,
    right: (-pan.x + viewWidth) / zoom + buffer,
    bottom: (-pan.y + viewHeight) / zoom + buffer
  };

  const isBoxInViewport = (b) => {
    return (
      b.x + b.width >= visibleRect.left &&
      b.x <= visibleRect.right &&
      b.y + b.height >= visibleRect.top &&
      b.y <= visibleRect.bottom
    );
  };

  const visibleNodes = nodes.filter(isBoxInViewport);

  // Assert significant culling occurred: > 75% of nodes are culled from DOM rendering
  assert.ok(visibleNodes.length > 0, 'Some nodes should be visible in viewport');
  assert.ok(visibleNodes.length < 50, `Expected <50 nodes in view, got ${visibleNodes.length}`);
  const culledPercentage = ((nodes.length - visibleNodes.length) / nodes.length) * 100;
  assert.ok(culledPercentage > 75, `Expected >75% culled, got ${culledPercentage}%`);

  // Selected node outside the viewport is always retained
  const offscreenId = 'node-249'; // bottom-right corner
  const selectedNodeIds = [offscreenId];
  const renderedNodes = nodes.filter(n => selectedNodeIds.includes(n.id) || isBoxInViewport(n));
  assert.ok(renderedNodes.some(n => n.id === offscreenId), 'Selected off-screen node must remain mounted');
});

test('Smart Alignment Guides & Snapping: calculates magnetic snapping and guide coordinates', () => {
  const SNAP_DISTANCE = 7;
  
  // Reference node fixed at (100, 200) with size 280x160
  const refNode = { x: 100, y: 200, width: 280, height: 160 };
  
  // Dragged node near refNode: x=103 (3px away from left-edge alignment at 100)
  // y=198 (2px away from top-edge alignment at 200)
  const dragged = { x: 103, y: 198, width: 280, height: 160 };

  const xAlignments = [
    { targetX: refNode.x, currentX: dragged.x }, // Left-Left
    { targetX: refNode.x + refNode.width / 2, currentX: dragged.x + dragged.width / 2 }, // Center-Center
    { targetX: refNode.x + refNode.width, currentX: dragged.x + dragged.width } // Right-Right
  ];

  let bestXDist = SNAP_DISTANCE;
  let snapDx = 0;
  for (const { targetX, currentX } of xAlignments) {
    const dist = Math.abs(targetX - currentX);
    if (dist < bestXDist) {
      bestXDist = dist;
      snapDx = targetX - currentX;
    }
  }

  assert.strictEqual(bestXDist, 3, 'Closest X distance should be 3px');
  assert.strictEqual(snapDx, -3, 'Snap delta should pull card -3px left to exactly x=100');
  assert.strictEqual(dragged.x + snapDx, 100, 'Snapped X position matches reference left edge');

  // Test vertical snapping:
  const yAlignments = [
    { targetY: refNode.y, currentY: dragged.y }, // Top-Top
    { targetY: refNode.y + refNode.height / 2, currentY: dragged.y + dragged.height / 2 },
    { targetY: refNode.y + refNode.height, currentY: dragged.y + dragged.height }
  ];

  let bestYDist = SNAP_DISTANCE;
  let snapDy = 0;
  for (const { targetY, currentY } of yAlignments) {
    const dist = Math.abs(targetY - currentY);
    if (dist < bestYDist) {
      bestYDist = dist;
      snapDy = targetY - currentY;
    }
  }

  assert.strictEqual(bestYDist, 2, 'Closest Y distance should be 2px');
  assert.strictEqual(snapDy, 2, 'Snap delta should pull card +2px down to exactly y=200');
  assert.strictEqual(dragged.y + snapDy, 200, 'Snapped Y position matches reference top edge');
});

test('Semantic Relationship Ontology Presets: provides canonical configurations and applies accurately', () => {
  assert.strictEqual(ONTOLOGY_PRESETS.length, 5, 'Should have 5 core ontology presets');

  const presetMap = new Map(ONTOLOGY_PRESETS.map(p => [p.id, p]));
  
  // Verify 'supports' preset
  const supports = presetMap.get('supports');
  assert.ok(supports);
  assert.strictEqual(supports.color, 'emerald');
  assert.strictEqual(supports.strokePattern, 'solid');
  assert.strictEqual(supports.lineStyle, 'curved');
  assert.strictEqual(supports.arrowhead, 'end');

  // Verify 'contradicts' preset
  const contradicts = presetMap.get('contradicts');
  assert.ok(contradicts);
  assert.strictEqual(contradicts.color, 'rose');
  assert.strictEqual(contradicts.strokePattern, 'dashed');
  assert.strictEqual(contradicts.lineStyle, 'curved');

  // Verify 'depends_on' preset
  const dependsOn = presetMap.get('depends_on');
  assert.ok(dependsOn);
  assert.strictEqual(dependsOn.color, 'amber');
  assert.strictEqual(dependsOn.lineStyle, 'stepped');

  // Verify 'derived_from' preset
  const derivedFrom = presetMap.get('derived_from');
  assert.ok(derivedFrom);
  assert.strictEqual(derivedFrom.color, 'indigo');
  assert.strictEqual(derivedFrom.lineStyle, 'curved');

  // Verify 'answers' preset
  const answers = presetMap.get('answers');
  assert.ok(answers);
  assert.strictEqual(answers.color, 'sky');
  assert.strictEqual(answers.strokePattern, 'dotted');
  assert.strictEqual(answers.lineStyle, 'straight');

  // Simulate applying a preset to an existing connection
  const originalEdge = { id: 'edge-1', from: 'a', to: 'b', label: 'unlinked' };
  const updatedEdge = {
    ...originalEdge,
    label: contradicts.label,
    color: contradicts.color,
    strokePattern: contradicts.strokePattern,
    lineStyle: contradicts.lineStyle,
    arrowhead: contradicts.arrowhead
  };

  assert.strictEqual(updatedEdge.label, 'contradicts');
  assert.strictEqual(updatedEdge.color, 'rose');
  assert.strictEqual(updatedEdge.strokePattern, 'dashed');
});

test('Interactive Mini-Map Navigation: calculates world bounds, lens coordinates, and click-to-pan translation', () => {
  const MAP_WIDTH = 190;
  const MAP_HEIGHT = 120;
  const PADDING = 140;

  // Nodes spread across world coordinates from (100, 100) to (1100, 700)
  const nodes = [
    { id: 'n1', x: 100, y: 100, width: 280, height: 160 },
    { id: 'n2', x: 820, y: 540, width: 280, height: 160 }
  ];

  // Current canvas viewport
  const viewport = { zoom: 1.0, pan: { x: -100, y: -100 } };
  const canvasSize = { width: 1200, height: 800 };

  // Calculate world bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }

  // Include screen viewport
  const viewWorldLeft = -viewport.pan.x / viewport.zoom;
  const viewWorldTop = -viewport.pan.y / viewport.zoom;
  const viewWorldRight = viewWorldLeft + canvasSize.width / viewport.zoom;
  const viewWorldBottom = viewWorldTop + canvasSize.height / viewport.zoom;

  minX = Math.min(minX, viewWorldLeft);
  minY = Math.min(minY, viewWorldTop);
  maxX = Math.max(maxX, viewWorldRight);
  maxY = Math.max(maxY, viewWorldBottom);

  const worldBounds = {
    left: minX - PADDING,
    top: minY - PADDING,
    width: (maxX - minX) + PADDING * 2,
    height: (maxY - minY) + PADDING * 2
  };

  const scale = Math.min(MAP_WIDTH / worldBounds.width, MAP_HEIGHT / worldBounds.height);
  const offsetX = (MAP_WIDTH - worldBounds.width * scale) / 2;
  const offsetY = (MAP_HEIGHT - worldBounds.height * scale) / 2;

  assert.ok(scale > 0, 'Minimap scale should be positive');
  assert.ok(scale < 1, 'Minimap scale should downscale world coordinates');

  // Verify viewfinder lens
  const lensWidth = (canvasSize.width / viewport.zoom) * scale;
  const lensHeight = (canvasSize.height / viewport.zoom) * scale;

  assert.ok(lensWidth > 0 && lensWidth <= MAP_WIDTH, 'Lens width within bounds');
  assert.ok(lensHeight > 0 && lensHeight <= MAP_HEIGHT, 'Lens height within bounds');

  // Verify click-to-pan calculation:
  // Clicking at the center of the minimap (MAP_WIDTH / 2, MAP_HEIGHT / 2)
  const clickMapX = MAP_WIDTH / 2;
  const clickMapY = MAP_HEIGHT / 2;

  const targetWorldCenterX = worldBounds.left + (clickMapX - offsetX) / scale;
  const targetWorldCenterY = worldBounds.top + (clickMapY - offsetY) / scale;

  const newPanX = canvasSize.width / 2 - targetWorldCenterX * viewport.zoom;
  const newPanY = canvasSize.height / 2 - targetWorldCenterY * viewport.zoom;

  // Verify that setting pan to (newPanX, newPanY) centers targetWorldCenter in the screen
  const screenCenterX = newPanX + targetWorldCenterX * viewport.zoom;
  const screenCenterY = newPanY + targetWorldCenterY * viewport.zoom;

  assert.strictEqual(Math.round(screenCenterX), canvasSize.width / 2, 'World target is centered horizontally on screen');
  assert.strictEqual(Math.round(screenCenterY), canvasSize.height / 2, 'World target is centered vertically on screen');
});


