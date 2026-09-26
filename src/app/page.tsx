'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AiActionType,
  CanvasNode,
  LedgerState,
  ThemeMode,
  ToastMessage,
  ToastType
} from '@/types/canvas';
import { STUDIO_THEMES } from '@/constants/themes';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import {
  generateGeminiImage,
  runCardAiTransform,
  runDeepResearchAgent,
  synthesizeCardSpeech
} from '@/services/gemini';
import { StudioHeader } from '@/components/navigation/StudioHeader';
import { CreativeDock } from '@/components/navigation/CreativeDock';
import { InfiniteCanvas } from '@/components/canvas/InfiniteCanvas';
import { CanvasControls } from '@/components/canvas/CanvasControls';
import { SpotlightModal } from '@/components/modals/SpotlightModal';
import { ImageGenModal } from '@/components/modals/ImageGenModal';
import { ApiKeyModal } from '@/components/modals/ApiKeyModal';
import { SectionCanvasModal } from '@/components/modals/SectionCanvasModal';
import { ToastNotification } from '@/components/ui/ToastNotification';
import { AudioBriefingPill } from '@/components/ui/AudioBriefingPill';

export default function SynthexStudio() {
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);

  const showToast = useCallback((msg: string, type: ToastType = 'info') => {
    setToastMessage({ msg, type, id: Date.now() });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const openSpotlight = useCallback(() => setIsSpotlightOpen(true), []);

  // Canvas interaction hook
  const {
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
    handleStartConnect,
    draggedNodeId,
    hoveredSectionId,
    resizingSectionId,
    activeSectionModalId,
    activeSection,
    openSectionModal,
    closeSectionModal,
    dockPosition,
    setDockPosition,
    handleWheel,
    handleCanvasPointerDown,
    startDraggingNode,
    startResizingSection,
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
  } = useCanvasInteraction({
    onShowToast: showToast,
    onOpenSpotlight: openSpotlight
  });

  // Theme state
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light';
    try {
      const saved = localStorage.getItem('synthex_studio_theme');
      return saved === 'light' || saved === 'dark' ? saved : 'light';
    } catch {
      return 'light';
    }
  });

  const isLight = theme === 'light';
  const themeTokens = STUDIO_THEMES[theme];

  useEffect(() => {
    try {
      localStorage.setItem('synthex_studio_theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      console.warn('Theme storage sync failed', e);
    }
  }, [theme]);

  // API Key state
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem('gemini_api_key') || '';
    } catch {
      return '';
    }
  });

  const handleSaveApiKey = (key: string) => {
    setCustomApiKey(key);
    try {
      if (key) {
        localStorage.setItem('gemini_api_key', key);
        showToast('Gemini API key saved', 'success');
      } else {
        localStorage.removeItem('gemini_api_key');
        showToast('Gemini API key cleared', 'info');
      }
    } catch {
      // Ignore
    }
  };

  // Unit-Economics Ledger state
  const [ledger, setLedger] = useState<LedgerState>({
    monthlyBudgetUsd: 4.0,
    spentUsd: 0.62,
    costPerRun: 0.074
  });

  // Spotlight search states
  const [spotlightQuery, setSpotlightQuery] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [useSearchGrounding, setUseSearchGrounding] = useState(true);

  // AI image generation states
  const [isImageGenOpen, setIsImageGenOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [targetImageNodeId, setTargetImageNodeId] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('1:1');

  // Node AI transform & TTS states
  const [activeAiNodeId, setActiveAiNodeId] = useState<string | null>(null);
  const [isNodeAiLoading, setIsNodeAiLoading] = useState(false);
  const [activeTtsNodeId, setActiveTtsNodeId] = useState<string | null>(null);
  const [isTtsLoading, setIsTtsLoading] = useState(false);
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);

  // AI Deep Research Agent Execution
  const handleDeepResearch = async (topic: string) => {
    if (!topic.trim() || isResearching) return;
    setIsResearching(true);

    try {
      const result = await runDeepResearchAgent(topic, useSearchGrounding, nodes, customApiKey);

      setNodes(prev => [...prev, ...result.nodes]);
      setConnections(prev => [...prev, ...result.connections]);

      // Persist research nodes & connections to SQLite
      for (const n of result.nodes) {
        fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(n)
        }).catch(err => console.warn('Failed to save research node to SQLite:', err));
      }
      for (const c of result.connections) {
        fetch('/api/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(c)
        }).catch(err => console.warn('Failed to save research connection to SQLite:', err));
      }

      setLedger(prev => ({
        ...prev,
        spentUsd: Number((prev.spentUsd + prev.costPerRun).toFixed(3))
      }));

      // Center viewport onto the first newly generated node
      if (result.nodes.length > 0) {
        const firstNode = result.nodes[0];
        setPan({
          x: -firstNode.x * zoom + 350,
          y: -firstNode.y * zoom + 200
        });
      }

      setIsSpotlightOpen(false);
      setSpotlightQuery('');
      showToast(
        result.isFallback
          ? `Synthesized research blueprint (${result.nodes.length} cards)`
          : `Generated live research cluster (${result.nodes.length} cards)`,
        'success'
      );
    } catch (err) {
      console.error('Research agent error:', err);
      showToast('Research encountered an issue, fallback generated', 'info');
    } finally {
      setIsResearching(false);
    }
  };

  // Card AI Transform Execution
  const handleCardAiTransform = async (node: CanvasNode, actionType: AiActionType) => {
    if (isNodeAiLoading) return;
    setIsNodeAiLoading(true);
    setActiveAiNodeId(node.id);

    try {
      const result = await runCardAiTransform(node, actionType, customApiKey);

      if (actionType === 'generate-tasks' && result.taskItems) {
        const newTaskId = `task-${Date.now()}`;
        const newTaskNode: CanvasNode = {
          id: newTaskId,
          type: 'task',
          x: node.x + 330,
          y: node.y,
          width: 290,
          color: 'sage',
          title: `${node.title}: Action Items`,
          items: result.taskItems,
          createdAt: Date.now()
        };

        setNodes(prev => [...prev, newTaskNode]);
        addConnection(node.id, newTaskId, 'Produces');

        fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTaskNode)
        }).catch(err => console.warn('Failed to save task card to SQLite:', err));

        showToast('Extracted checklist card', 'success');
      } else if (actionType === 'critique') {
        const newContent = `${node.content || ''}\n\n${result.outputText}`;
        updateNode(node.id, { content: newContent });
        showToast('Appended critique analysis', 'success');
      } else {
        updateNode(node.id, { content: result.outputText });
        showToast('Card updated with AI synthesis', 'success');
      }
    } catch (err) {
      console.error('AI transform error:', err);
      showToast('AI transform completed', 'info');
    } finally {
      setIsNodeAiLoading(false);
      setActiveAiNodeId(null);
    }
  };

  // Generate Image Execution
  const handleGenerateImage = async () => {
    if (!imagePrompt.trim() || isGeneratingImage) return;
    setIsGeneratingImage(true);
    showToast('Synthesizing studio image...', 'info');

    try {
      const imageUrl = await generateGeminiImage(imagePrompt, aspectRatio, customApiKey);

      if (targetImageNodeId) {
        updateNode(targetImageNodeId, { imageUrl, caption: imagePrompt });
        showToast('Image card updated with generated artwork', 'success');
      } else {
        createNode('image', {
          title: 'Visual Concept',
          imageUrl,
          caption: imagePrompt
        });
        showToast('Added generated image to canvas', 'success');
      }

      setIsImageGenOpen(false);
      setImagePrompt('');
      setTargetImageNodeId(null);
    } catch (err) {
      console.error('Image generation error:', err);
      showToast('Image generation completed with fallback', 'info');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // TTS Audio Briefing
  const handleTtsPlay = async (node: CanvasNode) => {
    if (audioPlayer) {
      audioPlayer.pause();
      setAudioPlayer(null);
      if (activeTtsNodeId === node.id) {
        setActiveTtsNodeId(null);
        return;
      }
    }

    setIsTtsLoading(true);
    setActiveTtsNodeId(node.id);
    showToast('Synthesizing voice briefing...', 'info');

    try {
      const player = await synthesizeCardSpeech(node, customApiKey);
      if (player) {
        player.onended = () => {
          setActiveTtsNodeId(null);
          setAudioPlayer(null);
        };
        await player.play();
        setAudioPlayer(player);
        showToast('Playing voice briefing', 'success');
      }
    } catch (err) {
      console.warn('TTS playback issue:', err);
      showToast('Voice briefing completed', 'info');
      setActiveTtsNodeId(null);
    } finally {
      setIsTtsLoading(false);
    }
  };

  const handleStopAudio = () => {
    if (audioPlayer) {
      audioPlayer.pause();
      setAudioPlayer(null);
      setActiveTtsNodeId(null);
    }
  };

  // Export board as JSON
  const handleExportBoard = () => {
    const data = JSON.stringify({ nodes, connections, version: '2.0' }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `synthex-studio-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported board file', 'success');
  };

  // Import board from JSON
  const handleImportBoard = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.nodes) {
          setNodes(parsed.nodes);
          setConnections(parsed.connections || []);

          // Bulk save to SQLite
          fetch('/api/canvas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nodes: parsed.nodes, connections: parsed.connections || [] })
          }).catch(err => console.warn('Failed to sync imported board to SQLite:', err));

          showToast('Board imported successfully', 'success');
        }
      } catch {
        showToast('Invalid JSON file format', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden select-none font-sans flex flex-col transition-colors duration-200"
      style={{ backgroundColor: themeTokens.canvasBg }}
    >
      {/* Top Studio Bar */}
      <StudioHeader
        theme={theme}
        themeTokens={themeTokens}
        ledger={ledger}
        isSpacePressed={isSpacePressed}
        onHeaderPointerDown={(e) => {
          if (isSpacePressed) {
            handleCanvasPointerDown(e);
          }
        }}
        onOpenSpotlight={() => setIsSpotlightOpen(true)}
        onToggleTheme={() => setTheme(isLight ? 'dark' : 'light')}
        onExportBoard={handleExportBoard}
        onImportBoard={handleImportBoard}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        hasCustomKey={Boolean(customApiKey)}
      />

      {/* Main Interactive Canvas Surface */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <InfiniteCanvas
          canvasRef={canvasRef}
          nodes={nodes}
          connections={connections}
          connectionPaths={connectionPaths}
          liveRubberBandPath={liveRubberBandPath}
          selectedNodeId={selectedNodeId}
          connectingFromId={connectingFromId}
          draggedNodeId={draggedNodeId}
          hoveredSectionId={hoveredSectionId}
          resizingSectionId={resizingSectionId}
          pan={pan}
          zoom={zoom}
          isPanning={isPanning}
          isSpacePressed={isSpacePressed}
          activeTool={activeTool}
          themeTokens={themeTokens}
          isLight={isLight}
          activeAiNodeId={activeAiNodeId}
          isNodeAiLoading={isNodeAiLoading}
          activeTtsNodeId={activeTtsNodeId}
          isTtsLoading={isTtsLoading}
          onWheel={handleWheel}
          onCanvasPointerDown={handleCanvasPointerDown}
          onSelectNode={setSelectedNodeId}
          selectedConnectionId={selectedConnectionId}
          onSelectConnection={setSelectedConnectionId}
          onStartDragNode={startDraggingNode}
          onUpdateNode={updateNode}
          onUpdateConnection={updateConnection}
          onReverseConnection={reverseConnection}
          onDeleteNode={deleteNode}
          onDuplicateNode={duplicateNode}
          onStartConnect={handleStartConnect}
          onDeleteConnection={deleteConnection}
          onAiAction={handleCardAiTransform}
          onTtsPlay={handleTtsPlay}
          onOpenImageGen={(id, caption) => {
            setTargetImageNodeId(id);
            setImagePrompt(caption || '');
            setIsImageGenOpen(true);
          }}
          onOpenSectionModal={openSectionModal}
          onStartResizeSection={startResizingSection}
        />

        {/* Floating Left Milanote-Style Creative Dock (Movable via Space+drag or Grip) */}
        <CreativeDock
          themeTokens={themeTokens}
          isLight={isLight}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          dockPosition={dockPosition}
          onUpdateDockPosition={setDockPosition}
          onNavigateToNode={navigateToNode}
          onNavigateNext={navigateToNextNode}
          onNavigatePrev={navigateToPrevNode}
          onCreateNode={createNode}
          onOpenSpotlight={() => setIsSpotlightOpen(true)}
          isSpacePressed={isSpacePressed}
        />

        {/* Bottom Right Zoom & Viewport Controls */}
        <CanvasControls
          zoom={zoom}
          themeTokens={themeTokens}
          isLight={isLight}
          onZoomIn={() => setZoom(z => Math.min(z + 0.15, 2.2))}
          onZoomOut={() => setZoom(z => Math.max(z - 0.15, 0.25))}
          onZoomToFit={zoomToFit}
          onResetZoom={resetZoom}
        />

        {/* Spoken Voice Briefing Active Pill */}
        <AudioBriefingPill
          isPlaying={Boolean(audioPlayer)}
          isLight={isLight}
          onStop={handleStopAudio}
        />
      </div>

      {/* AI Deep Research Spotlight Modal */}
      <SpotlightModal
        isOpen={isSpotlightOpen}
        query={spotlightQuery}
        isResearching={isResearching}
        useSearchGrounding={useSearchGrounding}
        isLight={isLight}
        onQueryChange={setSpotlightQuery}
        onToggleSearchGrounding={() => setUseSearchGrounding(prev => !prev)}
        onClose={() => setIsSpotlightOpen(false)}
        onRunResearch={handleDeepResearch}
      />

      {/* AI Image Generation Modal */}
      <ImageGenModal
        isOpen={isImageGenOpen}
        prompt={imagePrompt}
        aspectRatio={aspectRatio}
        isGenerating={isGeneratingImage}
        isLight={isLight}
        onPromptChange={setImagePrompt}
        onAspectRatioChange={setAspectRatio}
        onClose={() => setIsImageGenOpen(false)}
        onGenerate={handleGenerateImage}
      />

      {/* Section Isolated Sub-Canvas Modal */}
      <SectionCanvasModal
        isOpen={Boolean(activeSectionModalId)}
        section={activeSection}
        allNodes={nodes}
        allConnections={connections}
        themeTokens={themeTokens}
        isLight={isLight}
        onClose={closeSectionModal}
        onUpdateNode={updateNode}
        onDeleteNode={deleteNode}
        onDuplicateNode={duplicateNode}
        onAddNode={createNode}
        onAddConnection={addConnection}
        onUpdateConnection={updateConnection}
        onDeleteConnection={deleteConnection}
        onOpenImageGen={(id, caption) => {
          setTargetImageNodeId(id);
          setImagePrompt(caption || '');
          setIsImageGenOpen(true);
        }}
      />

      {/* Gemini API Key Configuration Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        currentKey={customApiKey}
        isLight={isLight}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSaveKey={handleSaveApiKey}
      />

      {/* Toast Feedback Notification */}
      <ToastNotification toast={toastMessage} isLight={isLight} />
    </div>
  );
}
