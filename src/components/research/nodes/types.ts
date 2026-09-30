import type { CanvasNode, SectionResizeHandle } from '@/types/canvas';
import type { CitationReference } from '@/utils/citation';
export interface NodeCardProps {
  node: CanvasNode; selected: boolean; isEditing: boolean; isGrabbed?: boolean; dragTilt?: number;
  isDraft?: boolean; isDetaching?: boolean; isKept?: boolean;
  /** Sitting on another note mid-drag or mid-resize: it will snap back if dropped here. */
  isBlocked?: boolean;
  /** Newly added and not pinned yet: it pins itself once it sits on free board. */
  isPlacing?: boolean;
  onToggleEdit: () => void; onUpdateContent: (content: string) => void;
  onPointerDown: (event: React.PointerEvent, node: CanvasNode) => void;
  onClick: (event: React.MouseEvent, node: CanvasNode) => void;
  onOpenLightbox?: (src: string, title?: string, caption?: string) => void;
  onOpenFileModal?: (file: { fileData?: string; fileName?: string; fileSize?: number; fileType?: string; content?: string; initialPage?: number; highlightExcerpt?: string }) => void;
  allNodesById?: Record<string, CanvasNode>; onOpenEvidenceCitation?: (evidence: CitationReference) => void;
  isResizeLocked?: boolean; onStartResize?: (event: React.PointerEvent, handle: SectionResizeHandle) => void;
  /** Present only while this is the single selected item: shows the Edit button that opens the full-screen editor. */
  onOpenEditor?: () => void;
}
