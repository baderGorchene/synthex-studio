import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CanvasNode, CanvasNodeType, CanvasTool, Connection, Coordinates, SectionResizeHandle } from '@/types/canvas';
import { SEED_CONNECTIONS, SEED_NODES } from '@/constants/seedData';
import {
  calculateBoundingBox,
  calculateConnectionPaths,
  calculateRubberBandPath,
  calculateSectionBoundingBox,
  getNodeHeight,
  isNodeInsideSection,
  screenToCanvas,
  snapCoord
} from '@/utils/canvasMath';
import { CURATED_ASSETS } from '@/constants/assets';

interface UseCanvasInteractionOptions {
  onShowToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onOpenSpotlight: () => void;
}

export function useCanvasInteraction({ onShowToast, onOpenSpotlight }: UseCanvasInteractionOptions) {
  const [nodes, setNodes] = useState<CanvasNode[]>(() => {
    if (typeof window === 'undefined') return SEED_NODES;
    try {
      const saved = localStorage.getItem('synthex_studio_nodes');
      if (!saved) return SEED_NODES;
      const parsed: CanvasNode[] = JSON.parse(saved);
      return parsed.map(node => {
        if (node.caption && (node.caption.includes('Changes icon') || node.caption.includes('stays white'))) {
          node.caption = undefined;
        }
        if (node.imageUrl && (node.imageUrl.includes('Changes icon') || node.imageUrl.includes('stays white'))) {
          node.imageUrl = undefined;
        }
        if (node.content && node.content.includes('Changes icon & border color')) {
          node.content = undefined;
        }
        return node;
      });
    } catch {
      return SEED_NODES;
    }
  });

  const [connections, setConnections] = useState<Connection[]>(() => {
    if (typeof window === 'undefined') return SEED_CONNECTIONS;
    try {
      const saved = localStorage.getItem('synthex_studio_connections');
      return saved ? JSON.parse(saved) : SEED_CONNECTIONS;
    } catch {
      return SEED_CONNECTIONS;
    }
  });

  const [activeTool, setActiveTool] = useState<CanvasTool>('hand');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Coordinates>({ x: 40, y: 30 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Coordinates>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [connectingMousePos, setConnectingMousePos] = useState<Coordinates | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Coordinates>({ x: 0, y: 0 });
  const [snapToGrid, setSnapToGrid] = useState(true);

  // Section interactions: hover pulse & sub-canvas modal
  const [hoveredSectionId, setHoveredSectionId] = useState<string | null>(null);
  const [activeSectionModalId, setActiveSectionModalId] = useState<string | null>(null);
  const [resizingSectionId, setResizingSectionId] = useState<string | null>(null);

  // Group dragging ref: stores member initial positions when a section group is moved
  const draggedGroupRef = useRef<{
    sectionId: string;
    sectionOrigin: Coordinates;
    members: { id: string; initialX: number; initialY: number }[];
  } | null>(null);

  // Manual section resizing ref
  const resizingSectionRef = useRef<{
    id: string;
    handle: SectionResizeHandle;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialWidth: number;
    initialHeight: number;
    minWidth: number;
    minHeight: number;
  } | null>(null);

  // Floating dock position (can be dragged freely via grip or Space + drag)
  const [dockPosition, setDockPosition] = useState<Coordinates | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('synthex_dock_pos');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef<CanvasNode[]>(nodes);
  const pendingUpdatesRef = useRef<Map<string, { timer: NodeJS.Timeout; fields: Partial<CanvasNode> }>>(new Map());
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Load initial elements from SQLite database on mount
  useEffect(() => {
    let isMounted = true;
    async function loadFromDb() {
      try {
        const res = await fetch('/api/canvas');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.nodes && data.nodes.length > 0) {
            setNodes(data.nodes);
            if (data.connections) {
              setConnections(data.connections);
            }
          }
        }
      } catch (err) {
        console.warn('Could not load from SQLite API, using local state:', err);
      }
    }
    loadFromDb();
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync state to localStorage as fast client-side backup
  useEffect(() => {
    try {
      localStorage.setItem('synthex_studio_nodes', JSON.stringify(nodes));
      localStorage.setItem('synthex_studio_connections', JSON.stringify(connections));
      if (dockPosition) {
        localStorage.setItem('synthex_dock_pos', JSON.stringify(dockPosition));
      }
    } catch (e) {
      console.warn('Storage sync failed', e);
    }
  }, [nodes, connections, dockPosition]);

  const deleteNode = useCallback((id: string) => {
    const pending = pendingUpdatesRef.current.get(id);
    if (pending) {
      clearTimeout(pending.timer);
      pendingUpdatesRef.current.delete(id);
    }
    setNodes(prev => prev.filter(n => n.id !== id));
    setConnections(prev => prev.filter(c => c.from !== id && c.to !== id));
    setSelectedNodeId(current => (current === id ? null : current));
    onShowToast('Card removed', 'info');

    // Persist deletion to SQLite database
    fetch(`/api/nodes?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }).catch(err => console.warn('Failed to delete node in SQLite:', err));
  }, [onShowToast]);

  const addConnection = useCallback((fromId: string, toId: string, label = '') => {
    if (fromId === toId) return;

    setConnections(prev => {
      const exists = prev.some(
        c => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId)
      );
      if (exists) {
        onShowToast('Connection already exists', 'warning');
        return prev;
      }
      onShowToast('Connected elements', 'success');
      const newConn: Connection = {
        id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        from: fromId,
        to: toId,
        label,
        arrowhead: 'end',
        lineStyle: 'curved',
        strokePattern: 'dashed',
        color: 'indigo',
        animated: true
      };

      // Persist connection to SQLite database
      fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConn)
      }).catch(err => console.warn('Failed to save connection in SQLite:', err));

      return [...prev, newConn];
    });
  }, [onShowToast]);

  const updateConnection = useCallback(
    (id: string, fields: Partial<Connection>) => {
      setConnections(prev =>
        prev.map(c => (c.id === id ? { ...c, ...fields } : c))
      );

      fetch('/api/connections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...fields })
      }).catch(err => console.warn('Failed to update connection in SQLite:', err));

      if (fields.label !== undefined) {
        onShowToast(fields.label ? `Arrow label: "${fields.label}"` : 'Arrow label cleared', 'info');
      } else if (fields.arrowhead) {
        onShowToast(`Arrowhead set to ${fields.arrowhead}`, 'info');
      } else if (fields.lineStyle) {
        onShowToast(`Line style: ${fields.lineStyle}`, 'info');
      } else if (fields.strokePattern) {
        onShowToast(`Stroke pattern: ${fields.strokePattern}`, 'info');
      } else if (fields.color) {
        onShowToast(`Arrow color: ${fields.color}`, 'info');
      } else if (fields.animated !== undefined) {
        onShowToast(fields.animated ? 'Flow animation enabled' : 'Flow animation disabled', 'info');
      }
    },
    [onShowToast]
  );

  const reverseConnection = useCallback(
    (id: string) => {
      setConnections(prev =>
        prev.map(c => {
          if (c.id !== id) return c;
          const updated: Connection = { ...c, from: c.to, to: c.from };
          fetch('/api/connections', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
          }).catch(err => console.warn('Failed to reverse connection in SQLite:', err));
          return updated;
        })
      );
      onShowToast('Reversed arrow direction', 'info');
    },
    [onShowToast]
  );

  const deleteConnection = useCallback((id: string) => {
    setConnections(prev => prev.filter(c => c.id !== id));
    setSelectedConnectionId(current => (current === id ? null : current));
    onShowToast('Connection removed', 'info');

    // Persist to SQLite
    fetch(`/api/connections?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }).catch(err => console.warn('Failed to delete connection in SQLite:', err));
  }, [onShowToast]);

  const duplicateNode = useCallback((node: CanvasNode) => {
    const clone: CanvasNode = {
      ...node,
      id: `node-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      x: node.x + 30,
      y: node.y + 30,
      title: `${node.title} (Copy)`,
      createdAt: Date.now()
    };
    setNodes(prev => [...prev, clone]);
    setSelectedNodeId(clone.id);
    onShowToast('Duplicated card', 'success');

    // Persist clone to SQLite database
    fetch('/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clone)
    }).catch(err => console.warn('Failed to save duplicated node in SQLite:', err));
  }, [onShowToast]);

  const updateNode = useCallback((id: string, fields: Partial<CanvasNode>) => {
    // 1. Immediately update React state for instant UI responsiveness
    setNodes(prev => prev.map(n => (n.id === id ? { ...n, ...fields } : n)));

    // 2. Debounce SQLite persistence to coalesce rapid keystrokes or dimension measurements
    const existing = pendingUpdatesRef.current.get(id);
    if (existing) {
      clearTimeout(existing.timer);
    }

    const mergedFields = { ...(existing?.fields || {}), ...fields };
    const timer = setTimeout(() => {
      pendingUpdatesRef.current.delete(id);
      fetch('/api/nodes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...mergedFields })
      }).catch(err => console.warn('Failed to update node in SQLite:', err));
    }, 250);

    pendingUpdatesRef.current.set(id, { timer, fields: mergedFields });
  }, []);

  // Element Navigation functions (Arrow tool in sidebar)
  const navigateToNode = useCallback((id: string) => {
    const target = nodesRef.current.find(n => n.id === id);
    if (!target) return;
    setSelectedNodeId(id);
    const rect = canvasRef.current?.getBoundingClientRect() || { width: 1200, height: 800 };
    const targetW = target.width || 300;
    const targetH = getNodeHeight(target);

    setPan({
      x: rect.width / 2 - (target.x + targetW / 2) * zoom,
      y: rect.height / 2 - (target.y + targetH / 2) * zoom
    });
    onShowToast(`Focused on "${target.title}"`, 'info');
  }, [zoom, onShowToast]);

  const navigateToNextNode = useCallback(() => {
    const currentNodes = nodesRef.current;
    if (currentNodes.length === 0) return;
    const currentIndex = selectedNodeId ? currentNodes.findIndex(n => n.id === selectedNodeId) : -1;
    const nextIndex = (currentIndex + 1) % currentNodes.length;
    navigateToNode(currentNodes[nextIndex].id);
  }, [selectedNodeId, navigateToNode]);

  const navigateToPrevNode = useCallback(() => {
    const currentNodes = nodesRef.current;
    if (currentNodes.length === 0) return;
    const currentIndex = selectedNodeId ? currentNodes.findIndex(n => n.id === selectedNodeId) : 0;
    const prevIndex = (currentIndex - 1 + currentNodes.length) % currentNodes.length;
    navigateToNode(currentNodes[prevIndex].id);
  }, [selectedNodeId, navigateToNode]);

  // Coordinate transforms
  const screenToCanvasCoords = useCallback(
    (screenX: number, screenY: number): Coordinates => {
      return screenToCanvas(screenX, screenY, pan, zoom);
    },
    [pan, zoom]
  );

  const groupSelectedNodes = useCallback(() => {
    const currentNodes = nodesRef.current;
    const targetNode = selectedNodeId ? currentNodes.find(n => n.id === selectedNodeId) : null;
    if (!targetNode) {
      onShowToast('Select a card to group into a new section', 'info');
      return;
    }

    const pad = 48;
    const targetW = targetNode.width || 300;
    const targetH = getNodeHeight(targetNode);
    const secX = snapCoord(targetNode.x - pad, 20);
    const secY = snapCoord(targetNode.y - pad - 30, 20);
    const secW = Math.max(snapCoord(targetW + pad * 2, 20), 560);
    const secH = Math.max(snapCoord(targetH + pad * 2 + 30, 20), 380);

    const newSection: CanvasNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'section',
      x: secX,
      y: secY,
      width: secW,
      height: secH,
      color: 'terracotta',
      title: 'Grouped Section',
      createdAt: Date.now()
    };

    setNodes(prev => [
      newSection,
      ...prev.map(n => (n.id === targetNode.id ? { ...n, sectionId: newSection.id } : n))
    ]);
    setSelectedNodeId(newSection.id);
    onShowToast(`Grouped "${targetNode.title}" into section`, 'success');

    fetch('/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSection)
    }).catch(err => console.warn('Failed to save grouped section to SQLite:', err));
  }, [selectedNodeId, onShowToast]);

  // Keyboard shortcuts (Photoshop-style: V for Move, H for Hand, C for Connect, Space for Pan, Enter for Section, Ctrl+G for Group)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenSpotlight();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g' && !isInput) {
        e.preventDefault();
        groupSelectedNodes();
        return;
      }

      if (e.key === 'Enter' && selectedNodeId && !isInput) {
        const selNode = nodesRef.current.find(n => n.id === selectedNodeId);
        if (selNode && selNode.type === 'section') {
          e.preventDefault();
          setActiveSectionModalId(selNode.id);
          onShowToast(`Opened "${selNode.title}" sub-canvas`, 'info');
          return;
        }
      }

      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        setIsSpacePressed(true);
      }

      if (!isInput) {
        if (e.key.toLowerCase() === 'h') {
          setActiveTool('hand');
          setConnectingFromId(null);
          setConnectingMousePos(null);
          onShowToast('Hand Tool: Grab elements & navigate canvas (H)', 'info');
        } else if (e.key.toLowerCase() === 'v' || e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'a') {
          setActiveTool('connect');
          onShowToast('Arrow Linker Tool (V / C) — click cards to link', 'info');
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          navigateToNextNode();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          navigateToPrevNode();
        }
      }

      if (e.key === 'Escape') {
        setSelectedNodeId(null);
        setSelectedConnectionId(null);
        setConnectingFromId(null);
        setConnectingMousePos(null);
        if (activeTool === 'connect') {
          setActiveTool('hand');
        }
      }

      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        !isInput
      ) {
        if (selectedConnectionId) {
          e.preventDefault();
          deleteConnection(selectedConnectionId);
          setSelectedConnectionId(null);
          return;
        }
        if (selectedNodeId) {
          e.preventDefault();
          deleteNode(selectedNodeId);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    selectedNodeId,
    selectedConnectionId,
    activeTool,
    deleteNode,
    deleteConnection,
    onOpenSpotlight,
    onShowToast,
    navigateToNextNode,
    navigateToPrevNode,
    groupSelectedNodes
  ]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const zoomFactor = 1.08;
      let newZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
      newZoom = Math.min(Math.max(newZoom, 0.25), 2.2);

      const rect = canvasRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
      const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    },
    [zoom, pan]
  );

  // Photoshop-Style Canvas Pointer Down
  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as HTMLElement;
      const isHandOrSpace = isSpacePressed || activeTool === 'hand' || e.button === 1;

      if (
        isHandOrSpace ||
        target === canvasRef.current ||
        target.classList.contains('canvas-surface')
      ) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        setSelectedConnectionId(null);
        if (!isHandOrSpace) {
          setSelectedNodeId(null);
        }
        setConnectingFromId(null);
        setConnectingMousePos(null);
      }
    },
    [isSpacePressed, activeTool, pan]
  );

  // Photoshop-Style Node Drag / Link Start
  const startDraggingNode = useCallback(
    (e: React.PointerEvent, node: CanvasNode) => {
      // If Space is pressed or middle mouse button: Pan the canvas instead!
      if (isSpacePressed || e.button === 1) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        return;
      }

      e.stopPropagation();

      // If in connect mode or connecting:
      if (activeTool === 'connect' || connectingFromId) {
        if (connectingFromId) {
          if (connectingFromId !== node.id) {
            addConnection(connectingFromId, node.id);
          }
          setConnectingFromId(null);
          setConnectingMousePos(null);
        } else {
          setConnectingFromId(node.id);
          const coords = screenToCanvasCoords(e.clientX, e.clientY);
          setConnectingMousePos(coords);
          onShowToast(`Linking from "${node.title}" — click target card`, 'info');
        }
        return;
      }

      setSelectedNodeId(node.id);
      const canvasCoords = screenToCanvasCoords(e.clientX, e.clientY);
      setDragOffset({
        x: canvasCoords.x - node.x,
        y: canvasCoords.y - node.y
      });
      setDraggedNodeId(node.id);

      // If dragging a section, calculate member offsets for synchronous group movement!
      if (node.type === 'section') {
        const memberCards = nodesRef.current.filter(
          n => n.type !== 'section' && (n.sectionId === node.id || isNodeInsideSection(n, node))
        );
        draggedGroupRef.current = {
          sectionId: node.id,
          sectionOrigin: { x: node.x, y: node.y },
          members: memberCards.map(m => ({ id: m.id, initialX: m.x, initialY: m.y }))
        };
      } else {
        draggedGroupRef.current = null;
      }
    },
    [isSpacePressed, activeTool, connectingFromId, addConnection, screenToCanvasCoords, onShowToast, pan.x, pan.y]
  );

  // Manual Section Resizing Grip Handler
  const startResizingSection = useCallback(
    (
      e: React.PointerEvent,
      section: CanvasNode,
      handle: SectionResizeHandle = 'se'
    ) => {
      e.stopPropagation();
      const members = nodesRef.current.filter(
        n => n.type !== 'section' && (n.sectionId === section.id || isNodeInsideSection(n, section))
      );
      let minW = 380;
      let minH = 240;
      if (members.length > 0) {
        const maxMemberRight = Math.max(...members.map(m => m.x + (m.width || 300)));
        const maxMemberBottom = Math.max(...members.map(m => m.y + getNodeHeight(m)));
        minW = Math.max(minW, maxMemberRight - section.x + 36);
        minH = Math.max(minH, maxMemberBottom - section.y + 36);
      }

      resizingSectionRef.current = {
        id: section.id,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        initialX: section.x,
        initialY: section.y,
        initialWidth: section.width || 640,
        initialHeight: section.height || 420,
        minWidth: minW,
        minHeight: minH
      };
      setResizingSectionId(section.id);
      setSelectedNodeId(section.id);
    },
    []
  );

  // Window-level smooth dragging with instant release, auto-scaling sections, & SQLite persistence
  useEffect(() => {
    if (!draggedNodeId && !isPanning && !connectingFromId && !resizingSectionId) return;

    let latestX = 0;
    let latestY = 0;

    const handleWindowPointerMove = (e: PointerEvent) => {
      if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y
        });
        return;
      }

      if (connectingFromId) {
        const coords = screenToCanvasCoords(e.clientX, e.clientY);
        setConnectingMousePos(coords);
      }

      // Manual Section Resizing (Multi-Directional)
      if (resizingSectionRef.current) {
        const {
          id,
          handle,
          startX,
          startY,
          initialX,
          initialY,
          initialWidth,
          initialHeight,
          minWidth,
          minHeight
        } = resizingSectionRef.current;

        const dx = (e.clientX - startX) / zoom;
        const dy = (e.clientY - startY) / zoom;

        let newX = initialX;
        let newY = initialY;
        let newWidth = initialWidth;
        let newHeight = initialHeight;

        if (handle.includes('e')) {
          newWidth = Math.max(snapCoord(initialWidth + dx, 20), minWidth);
        }
        if (handle.includes('s')) {
          newHeight = Math.max(snapCoord(initialHeight + dy, 20), minHeight);
        }
        if (handle.includes('w')) {
          const rawW = snapCoord(initialWidth - dx, 20);
          newWidth = Math.max(rawW, minWidth);
          newX = initialX + (initialWidth - newWidth);
        }
        if (handle.includes('n')) {
          const rawH = snapCoord(initialHeight - dy, 20);
          newHeight = Math.max(rawH, minHeight);
          newY = initialY + (initialHeight - newHeight);
        }

        setNodes(prev =>
          prev.map(n =>
            n.id === id ? { ...n, x: newX, y: newY, width: newWidth, height: newHeight } : n
          )
        );
        return;
      }

      if (draggedNodeId) {
        window.getSelection()?.removeAllRanges();

        const pos = screenToCanvasCoords(e.clientX, e.clientY);
        let newX = pos.x - dragOffset.x;
        let newY = pos.y - dragOffset.y;

        if (snapToGrid) {
          newX = snapCoord(newX, 20);
          newY = snapCoord(newY, 20);
        }

        latestX = newX;
        latestY = newY;

        const currentGroup = draggedGroupRef.current;
        const isGroupDrag = currentGroup && currentGroup.sectionId === draggedNodeId;
        const deltaX = newX - (currentGroup?.sectionOrigin.x ?? 0);
        const deltaY = newY - (currentGroup?.sectionOrigin.y ?? 0);

        setNodes(prev =>
          prev.map(n => {
            if (n.id === draggedNodeId) {
              return { ...n, x: newX, y: newY };
            }
            if (isGroupDrag) {
              const member = currentGroup.members.find(m => m.id === n.id);
              if (member) {
                return { ...n, x: member.initialX + deltaX, y: member.initialY + deltaY };
              }
            }
            return n;
          })
        );

        // Micro-animation check: Is this element currently hovered over a section group?
        const movingNode = nodesRef.current.find(n => n.id === draggedNodeId);
        if (movingNode && movingNode.type !== 'section') {
          const testNode: CanvasNode = { ...movingNode, x: newX, y: newY };
          const targetSection = nodesRef.current.find(
            n => n.type === 'section' && n.id !== draggedNodeId && isNodeInsideSection(testNode, n)
          );
          setHoveredSectionId(targetSection ? targetSection.id : null);
        }
      }
    };

    const handleWindowPointerUp = () => {
      // Finish Section Resizing
      if (resizingSectionRef.current) {
        const { id } = resizingSectionRef.current;
        const currentSection = nodesRef.current.find(n => n.id === id);
        if (currentSection) {
          fetch('/api/nodes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id,
              x: currentSection.x,
              y: currentSection.y,
              width: currentSection.width,
              height: currentSection.height
            })
          }).catch(err => console.warn('Failed to save resized section in SQLite:', err));
        }
        resizingSectionRef.current = null;
        setResizingSectionId(null);
      }

      if (draggedNodeId) {
        const currentId = draggedNodeId;
        const currentNode = nodesRef.current.find(n => n.id === currentId);
        const finalX = latestX || (currentNode ? currentNode.x : 0);
        const finalY = latestY || (currentNode ? currentNode.y : 0);

        // 1. Persist group movement if a section was dragged with members
        if (
          draggedGroupRef.current &&
          draggedGroupRef.current.sectionId === currentId &&
          draggedGroupRef.current.members.length > 0
        ) {
          const deltaX = finalX - draggedGroupRef.current.sectionOrigin.x;
          const deltaY = finalY - draggedGroupRef.current.sectionOrigin.y;

          const batchUpdates = [
            { id: currentId, x: finalX, y: finalY },
            ...draggedGroupRef.current.members.map(m => ({
              id: m.id,
              x: m.initialX + deltaX,
              y: m.initialY + deltaY
            }))
          ];

          fetch('/api/nodes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batchUpdates)
          }).catch(err => console.warn('Failed to batch persist group positions:', err));
        } else {
          // Persist single node position
          fetch('/api/nodes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: currentId, x: finalX, y: finalY })
          }).catch(err => console.warn('Failed to persist position to SQLite:', err));
        }

        draggedGroupRef.current = null;

        // 2. Section Auto-Scaling: If this card was dropped inside a section, auto-scale section!
        if (currentNode && currentNode.type !== 'section') {
          const droppedNode: CanvasNode = { ...currentNode, x: finalX, y: finalY };
          const targetSection = nodesRef.current.find(
            n => n.type === 'section' && n.id !== currentId && isNodeInsideSection(droppedNode, n)
          );

          if (targetSection) {
            // Find all member cards inside this section
            const otherMembers = nodesRef.current.filter(
              n => n.type !== 'section' && n.id !== targetSection.id && n.id !== currentId && isNodeInsideSection(n, targetSection)
            );
            const allMembers = [...otherMembers, droppedNode];

            // Compute auto-expanded bounding box with 48px padding
            const newBounds = calculateSectionBoundingBox(targetSection, allMembers, 48);

            // Update section in state
            setNodes(prev =>
              prev.map(n => {
                if (n.id === targetSection.id) {
                  return { ...n, ...newBounds };
                }
                if (n.id === currentId) {
                  return { ...n, sectionId: targetSection.id };
                }
                return n;
              })
            );

            // Persist updated section dimensions to SQLite
            fetch('/api/nodes', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: targetSection.id, ...newBounds })
            }).catch(err => console.warn('Failed to auto-scale section in SQLite:', err));

            onShowToast(`Section "${targetSection.title}" auto-scaled to fit ${allMembers.length} cards`, 'success');
          }
        }
      }

      setIsPanning(false);
      setDraggedNodeId(null);
      setHoveredSectionId(null);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
    };
  }, [
    draggedNodeId,
    isPanning,
    connectingFromId,
    resizingSectionId,
    panStart,
    dragOffset,
    screenToCanvasCoords,
    snapToGrid,
    zoom,
    onShowToast
  ]);

  const zoomToFit = useCallback(() => {
    const currentNodes = nodesRef.current;
    if (currentNodes.length === 0) return;
    const padding = 100;
    const bounds = calculateBoundingBox(currentNodes);

    const rect = canvasRef.current?.getBoundingClientRect() || { width: 1200, height: 800 };
    const scaleX = (rect.width - padding * 2) / Math.max(bounds.width, 200);
    const scaleY = (rect.height - padding * 2) / Math.max(bounds.height, 200);
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.35), 1.2);

    setZoom(newZoom);
    setPan({
      x: (rect.width - bounds.width * newZoom) / 2 - bounds.minX * newZoom,
      y: (rect.height - bounds.height * newZoom) / 2 - bounds.minY * newZoom
    });
    onShowToast('Fitted to cards', 'info');
  }, [onShowToast]);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 40, y: 30 });
  }, []);

  const connectionPaths = useMemo(() => {
    return calculateConnectionPaths(nodes, connections);
  }, [nodes, connections]);

  // Live rubber-band path when dragging a connection
  const liveRubberBandPath = useMemo(() => {
    if (!connectingFromId || !connectingMousePos) return null;
    const fromNode = nodes.find(n => n.id === connectingFromId);
    if (!fromNode) return null;
    return calculateRubberBandPath(fromNode, connectingMousePos);
  }, [connectingFromId, connectingMousePos, nodes]);

  // Active section for modal sub-canvas
  const activeSection = useMemo(() => {
    return nodes.find(n => n.id === activeSectionModalId) || null;
  }, [activeSectionModalId, nodes]);

  // Create node with smart position and SQLite database persistence
  const createNode = useCallback(
    (type: CanvasNodeType, customProps: Partial<CanvasNode> = {}) => {
      const rect = canvasRef.current?.getBoundingClientRect() || { width: 1000, height: 700 };
      const center = screenToCanvasCoords(
        rect.width / 2 + (Math.random() * 80 - 40),
        rect.height / 2 + (Math.random() * 80 - 40)
      );

      const validColors = ['neutral', 'terracotta', 'sage', 'cobalt', 'lavender', 'rose'] as const;
      const randomColor = validColors[Math.floor(Math.random() * validColors.length)];

      const newNode: CanvasNode = {
        id: `node-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type,
        x: Math.round(center.x / 20) * 20,
        y: Math.round(center.y / 20) * 20,
        width: type === 'section' ? 640 : type === 'task' ? 290 : type === 'image' ? 320 : 300,
        height: type === 'section' ? 420 : undefined,
        color: randomColor,
        title:
          type === 'note'
            ? 'Idea Note'
            : type === 'task'
            ? 'Action Sprint'
            : type === 'image'
            ? 'Visual Mood'
            : type === 'section'
            ? 'Thematic Zone'
            : 'Web Reference',
        createdAt: Date.now(),
        ...customProps
      };

      if (type === 'note' && !customProps.content) {
        newNode.content = 'Document principles, research findings, or synthesis notes here...';
      } else if (type === 'task' && !customProps.items) {
        newNode.items = [
          { id: '1', text: 'Initial scope alignment', completed: false },
          { id: '2', text: 'Verify core constraints', completed: false }
        ];
      } else if (type === 'image' && !customProps.imageUrl) {
        newNode.imageUrl = CURATED_ASSETS[Math.floor(Math.random() * CURATED_ASSETS.length)];
        newNode.caption = 'Studio visual reference';
      } else if (type === 'link' && !customProps.url) {
        newNode.url = 'https://deepmind.google';
        newNode.domain = 'deepmind.google';
        newNode.description = 'Real-time discussions and technology discoveries.';
      }

      setNodes(prev => [...prev, newNode]);
      setSelectedNodeId(newNode.id);
      onShowToast(`Added ${type} card`, 'success');

      // Persist to SQLite
      fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNode)
      }).catch(err => console.warn('Failed to save node to SQLite:', err));
    },
    [screenToCanvasCoords, onShowToast]
  );

  const handleStartConnect = useCallback(
    (targetNodeId: string) => {
      if (connectingFromId) {
        if (connectingFromId !== targetNodeId) {
          addConnection(connectingFromId, targetNodeId);
        }
        setConnectingFromId(null);
        setConnectingMousePos(null);
      } else {
        const fromNode = nodesRef.current.find(n => n.id === targetNodeId);
        setConnectingFromId(targetNodeId);
        if (fromNode) {
          onShowToast(`Linking from "${fromNode.title}" — click target card`, 'info');
        }
      }
    },
    [connectingFromId, addConnection, onShowToast]
  );

  return {
    canvasRef,
    nodes,
    setNodes,
    connections,
    setConnections,
    connectionPaths,
    liveRubberBandPath,
    activeTool,
    setActiveTool,
    zoom,
    setZoom,
    pan,
    setPan,
    isPanning,
    isSpacePressed,
    selectedNodeId,
    setSelectedNodeId,
    selectedConnectionId,
    setSelectedConnectionId,
    updateConnection,
    reverseConnection,
    connectingFromId,
    setConnectingFromId,
    handleStartConnect,
    connectingMousePos,
    setConnectingMousePos,
    hoveredSectionId,
    resizingSectionId,
    activeSectionModalId,
    activeSection,
    setActiveSectionModalId,
    openSectionModal: (id: string) => setActiveSectionModalId(id),
    closeSectionModal: () => setActiveSectionModalId(null),
    draggedNodeId,
    snapToGrid,
    setSnapToGrid,
    dockPosition,
    setDockPosition,
    screenToCanvasCoords,
    handleWheel,
    handleCanvasPointerDown,
    startDraggingNode,
    startResizingSection,
    groupSelectedNodes,
    createNode,
    deleteNode,
    duplicateNode,
    updateNode,
    addConnection,
    deleteConnection,
    navigateToNode,
    navigateToNextNode,
    navigateToPrevNode,
    zoomToFit,
    resetZoom
  };
}
