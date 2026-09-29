import type { CanvasNode, SectionResizeHandle } from '@/types/canvas';
import type { CitationReference } from '@/utils/citation';
export interface NodeCardProps {
  node: CanvasNode; selected: boolean; isEditing: boolean; isGrabbed?: boolean; dragTilt?: number;
  onToggleEdit: () => void; onUpdateContent: (content: string) => void;
  onPointerDown: (event: React.PointerEvent, node: CanvasNode) => void;
  onClick: (event: React.MouseEvent, node: CanvasNode) => void;
  onOpenLightbox?: (src: string, title?: string, caption?: string) => void;
  onOpenFileModal?: (file: { fileData?: string; fileName?: string; fileSize?: number; fileType?: string; content?: string; initialPage?: number; highlightExcerpt?: string }) => void;
  allNodesById?: Record<string, CanvasNode>; onOpenEvidenceCitation?: (evidence: CitationReference) => void;
  isResizeLocked?: boolean; onStartResize?: (event: React.PointerEvent, handle: SectionResizeHandle) => void;
}
