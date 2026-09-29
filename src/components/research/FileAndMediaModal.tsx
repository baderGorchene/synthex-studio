'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Download,
  ExternalLink,
  File,
  FileCode,
  FileJson,
  FileSpreadsheet,
  FileText,
  Images,
  Maximize2,
  Quote,
  RotateCw,
  Search,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { formatFileSize } from '@/types/canvas';
import { formatPdfPageUrl } from '@/utils/citation';

export type FileCategory = 'pdf' | 'json' | 'txt' | 'csv' | 'md' | 'code' | 'image' | 'file';

export interface FileMetaInfo {
  category: FileCategory;
  label: string;
  badgeBg: string;
  badgeColor: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
}

export function getFileCategory(fileName?: string, fileType?: string): FileMetaInfo {
  const name = (fileName || '').toLowerCase();
  const type = (fileType || '').toLowerCase();

  if (name.endsWith('.pdf') || type.includes('pdf')) {
    return {
      category: 'pdf',
      label: 'PDF',
      badgeBg: 'rgba(239, 68, 68, 0.12)',
      badgeColor: '#dc2626',
      icon: FileText
    };
  }
  if (name.endsWith('.json') || type.includes('json')) {
    return {
      category: 'json',
      label: 'JSON',
      badgeBg: 'rgba(245, 158, 11, 0.12)',
      badgeColor: '#d97706',
      icon: FileJson
    };
  }
  if (name.endsWith('.csv') || name.endsWith('.tsv') || type.includes('csv')) {
    return {
      category: 'csv',
      label: 'CSV / Data',
      badgeBg: 'rgba(16, 185, 129, 0.12)',
      badgeColor: '#059669',
      icon: FileSpreadsheet
    };
  }
  if (name.endsWith('.md') || name.endsWith('.markdown')) {
    return {
      category: 'md',
      label: 'Markdown',
      badgeBg: 'rgba(139, 92, 246, 0.12)',
      badgeColor: '#7c3aed',
      icon: FileCode
    };
  }
  if (name.endsWith('.txt') || type.includes('plain')) {
    return {
      category: 'txt',
      label: 'Text',
      badgeBg: 'rgba(59, 130, 246, 0.12)',
      badgeColor: '#2563eb',
      icon: FileText
    };
  }
  if (name.match(/\.(js|jsx|ts|tsx|py|html|css|sql|sh|yaml|yml)$/)) {
    return {
      category: 'code',
      label: 'Code',
      badgeBg: 'rgba(99, 102, 241, 0.12)',
      badgeColor: '#4f46e5',
      icon: FileCode
    };
  }
  if (name.match(/\.(png|jpg|jpeg|gif|webp|svg|bmp)$/) || type.includes('image')) {
    return {
      category: 'image',
      label: 'Image',
      badgeBg: 'transparent',
      badgeColor: '#111214',
      icon: Images
    };
  }
  return {
    category: 'file',
    label: 'File',
    badgeBg: 'rgba(107, 114, 128, 0.12)',
    badgeColor: '#4b5563',
    icon: File
  };
}

export function decodeDataUrlText(dataUrl: string): string {
  try {
    if (dataUrl.startsWith('data:')) {
      const base64Index = dataUrl.indexOf(';base64,');
      if (base64Index !== -1) {
        const base64 = dataUrl.substring(base64Index + 8);
        return decodeURIComponent(escape(atob(base64)));
      }
      const commaIndex = dataUrl.indexOf(',');
      if (commaIndex !== -1) {
        return decodeURIComponent(dataUrl.substring(commaIndex + 1));
      }
    }
  } catch (err) {
    console.warn('Could not decode data url to text', err);
  }
  return dataUrl;
}

/**
 * Image Viewer Modal with zoom, rotate, copy, and download options
 */
export function ImageViewerModal({
  src,
  title,
  caption,
  onClose
}: {
  src: string;
  title?: string;
  caption?: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [copied, setCopied] = useState(false);

  const safeTitle = title && !title.includes('Changes icon') && !title.includes('stays white') ? title : undefined;
  const safeCaption = caption && !caption.includes('Changes icon') && !caption.includes('stays white') ? caption : undefined;

  const handleZoomIn = () => setZoom(z => Math.min(3, z + 0.25));
  const handleZoomOut = () => setZoom(z => Math.max(0.4, z - 0.25));
  const handleResetZoom = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation(r => (r + 90) % 360);

  const handleCopy = async () => {
    try {
      if (src.startsWith('data:image/')) {
        await navigator.clipboard.writeText(src);
      } else {
        await navigator.clipboard.writeText(src);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="media-viewer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image and Figure Viewer"
    >
      <div className="media-viewer-container" onClick={e => e.stopPropagation()}>
        {/* Top Control Bar */}
        <div className="media-viewer-header">
          <div className="media-viewer-title-group">
            <span className="media-viewer-badge">
              <Images size={14} />
              <span>Media & Figure</span>
            </span>
            <strong className="media-viewer-filename">{safeTitle || safeCaption || 'Figure Preview'}</strong>
          </div>

          <div className="media-viewer-actions">
            <div className="media-viewer-zoom-group">
              <button
                type="button"
                className="media-viewer-btn"
                onClick={handleZoomOut}
                title="Zoom Out (-)"
              >
                <ZoomOut size={15} />
              </button>
              <button
                type="button"
                className="media-viewer-btn text-xs font-mono"
                onClick={handleResetZoom}
                title="Reset zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                className="media-viewer-btn"
                onClick={handleZoomIn}
                title="Zoom In (+)"
              >
                <ZoomIn size={15} />
              </button>
            </div>

            <button
              type="button"
              className="media-viewer-btn"
              onClick={handleRotate}
              title="Rotate 90 degrees"
            >
              <RotateCw size={15} />
            </button>

            <button
              type="button"
              className="media-viewer-btn"
              onClick={handleCopy}
              title="Copy image link / data"
            >
              {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
            </button>

            <a
              href={src}
              download={title || 'figure.png'}
              className="media-viewer-btn"
              title="Download image"
            >
              <Download size={15} />
            </a>

            <button
              type="button"
              className="media-viewer-btn close-btn"
              onClick={onClose}
              title="Close viewer (Esc)"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Viewport Frame */}
        <div className="media-viewer-viewport">
          <div
            className="media-viewer-stage"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={safeCaption || safeTitle || 'Enlarged figure'}
              className="media-viewer-image"
            />
          </div>
        </div>

        {/* Caption bar */}
        {safeCaption && (
          <div className="media-viewer-caption-bar">
            <p>{safeCaption}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * File Viewer Modal supporting PDF, TXT, JSON, CSV, MD, Code
 */
export function FileViewerModal({
  fileData,
  fileName,
  fileSize,
  fileType,
  content,
  initialPage,
  highlightExcerpt,
  onClose
}: {
  fileData?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  content?: string;
  initialPage?: number;
  highlightExcerpt?: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [userPage, setUserPage] = useState<number | null>(null);
  const [lastInitialPage, setLastInitialPage] = useState<number | undefined>(initialPage);

  if (lastInitialPage !== initialPage) {
    setLastInitialPage(initialPage);
    setUserPage(null);
  }

  const currentPage = userPage ?? initialPage ?? 1;
  const setCurrentPage = (pageOrFn: number | ((p: number) => number)) => {
    const newPage = typeof pageOrFn === 'function' ? pageOrFn(currentPage) : pageOrFn;
    setUserPage(Math.max(1, newPage));
  };
  const meta = getFileCategory(fileName, fileType);
  const IconComponent = meta.icon;

  const [fetchedText, setFetchedText] = useState<string>('');

  useEffect(() => {
    if (!content && fileData && (fileData.startsWith('/') || fileData.startsWith('http'))) {
      if (['json', 'txt', 'csv', 'md', 'code'].includes(meta.category)) {
        fetch(fileData)
          .then(res => res.text())
          .then(txt => setFetchedText(txt))
          .catch(() => {});
      }
    }
  }, [content, fileData, meta.category]);

  // Extract readable text if file is text-based (JSON, TXT, CSV, MD)
  const decodedText = useMemo(() => {
    if (content && content.trim()) return content;
    if (fetchedText && fetchedText.trim()) {
      if (meta.category === 'json') {
        try {
          return JSON.stringify(JSON.parse(fetchedText), null, 2);
        } catch {
          return fetchedText;
        }
      }
      return fetchedText;
    }
    if (fileData) {
      if (meta.category === 'json' || meta.category === 'txt' || meta.category === 'csv' || meta.category === 'md' || meta.category === 'code') {
        const text = fileData.startsWith('data:') ? decodeDataUrlText(fileData) : '';
        if (meta.category === 'json' && text) {
          try {
            const parsed = JSON.parse(text);
            return JSON.stringify(parsed, null, 2);
          } catch {
            return text;
          }
        }
        return text;
      }
    }
    return '';
  }, [content, fetchedText, fileData, meta.category]);

  const lines = useMemo(() => {
    if (!decodedText) return [];
    return decodedText.split('\n');
  }, [decodedText]);

  const filteredLines = useMemo(() => {
    if (!searchTerm.trim()) return lines;
    const needle = searchTerm.toLowerCase();
    return lines.filter(line => line.toLowerCase().includes(needle));
  }, [lines, searchTerm]);

  const handleCopy = async () => {
    try {
      if (decodedText) {
        await navigator.clipboard.writeText(decodedText);
      } else if (fileData) {
        await navigator.clipboard.writeText(fileData);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const pdfSourceUrl = useMemo(() => {
    if (!fileData) return '';
    return formatPdfPageUrl(fileData, currentPage);
  }, [fileData, currentPage]);

  const isPdf = meta.category === 'pdf';
  const isTextual = Boolean(decodedText && meta.category !== 'pdf');

  return (
    <div
      className="file-viewer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${fileName || 'File'} Viewer`}
    >
      <div className="file-viewer-container" onClick={e => e.stopPropagation()}>
        {/* Header Bar */}
        <div className="file-viewer-header">
          <div className="file-viewer-meta">
            <span
              className="file-type-pill"
              style={{ backgroundColor: meta.badgeBg, color: meta.badgeColor }}
            >
              <IconComponent size={14} />
              <span>{meta.label}</span>
            </span>
            <strong className="file-viewer-title" title={fileName}>{fileName || 'Attached Document'}</strong>
            {fileSize ? <span className="file-viewer-size">{formatFileSize(fileSize)}</span> : null}
            {isTextual && lines.length > 0 && (
              <span className="file-viewer-stats">{lines.length} lines</span>
            )}
          </div>

          <div className="file-viewer-header-actions">
            {isPdf && fileData && (
              <div className="pdf-page-controls">
                <button
                  type="button"
                  className="file-page-nav-btn"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  title="Previous page"
                >
                  <ChevronLeft size={14} />
                </button>
                <div className="file-page-input-wrapper">
                  <span className="file-page-label">p.</span>
                  <input
                    type="number"
                    min={1}
                    value={currentPage}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val > 0) setCurrentPage(val);
                    }}
                    className="file-page-number-input"
                    title="Jump to page number"
                  />
                </div>
                <button
                  type="button"
                  className="file-page-nav-btn"
                  onClick={() => setCurrentPage(p => p + 1)}
                  title="Next page"
                >
                  <ChevronRight size={14} />
                </button>
                {initialPage && (
                  <button
                    type="button"
                    className="file-citation-jump-pill"
                    onClick={() => setCurrentPage(initialPage)}
                    title={`Jump to cited evidence on page ${initialPage}`}
                  >
                    <Bookmark size={11} />
                    <span>Cited p. {initialPage}</span>
                  </button>
                )}
              </div>
            )}

            {isTextual && (
              <div className="file-search-box">
                <Search size={13} />
                <input
                  type="text"
                  placeholder="Find in file..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="file-search-input"
                />
                {searchTerm && (
                  <button type="button" onClick={() => setSearchTerm('')} className="file-search-clear">
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            {isTextual && (
              <button
                type="button"
                className="file-action-btn"
                onClick={handleCopy}
                title="Copy contents"
              >
                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            )}

            {fileData && (
              <a
                href={fileData}
                download={fileName || `document.${meta.category}`}
                className="file-action-btn primary"
                title="Download file"
              >
                <Download size={14} />
                <span>Download</span>
              </a>
            )}

            {fileData && isPdf && (
              <a
                href={pdfSourceUrl || fileData}
                target="_blank"
                rel="noreferrer"
                className="file-action-btn"
                title="Open in new browser tab"
              >
                <ExternalLink size={14} />
                <span>Open in Tab</span>
              </a>
            )}

            <button
              type="button"
              className="file-action-btn close-btn"
              onClick={onClose}
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="file-viewer-body">
          {isPdf ? (
            <div className="pdf-embed-wrapper">
              {highlightExcerpt && (
                <div className="pdf-citation-callout">
                  <div className="pdf-citation-header">
                    <Quote size={13} className="text-amber-500" />
                    <span className="pdf-citation-badge">Linked Evidence</span>
                    {initialPage && (
                      <span className="pdf-citation-loc">Page {initialPage}</span>
                    )}
                  </div>
                  <p className="pdf-citation-excerpt">“{highlightExcerpt}”</p>
                </div>
              )}
              {fileData ? (
                <iframe
                  key={pdfSourceUrl}
                  src={pdfSourceUrl}
                  title={fileName || 'PDF Document'}
                  className="pdf-preview-frame"
                />
              ) : (
                <div className="file-empty-state">
                  <FileText size={36} className="text-slate-400" />
                  <p>PDF data not available for inline viewing</p>
                </div>
              )}
            </div>
          ) : isTextual ? (
            <div className="text-file-viewer">
              <pre className="text-content-pre">
                <code>
                  {filteredLines.map((line, idx) => (
                    <div key={idx} className="code-line-row">
                      <span className="line-num">{idx + 1}</span>
                      <span className="line-content">{line || ' '}</span>
                    </div>
                  ))}
                </code>
              </pre>
            </div>
          ) : (
            <div className="file-fallback-viewer">
              <IconComponent size={44} style={{ color: meta.badgeColor }} />
              <h3>{fileName || 'Attached File'}</h3>
              <p>Binary or unsupported file format for inline rendering.</p>
              {fileData && (
                <a
                  href={fileData}
                  download={fileName || 'attachment'}
                  className="file-action-btn primary"
                >
                  <Download size={14} />
                  <span>Download file ({formatFileSize(fileSize)})</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Enhanced Attached File Badge to render on Canvas Cards & Inspector
 */
export function AttachedFileBadge({
  fileName,
  fileSize,
  fileType,
  onOpenPreview
}: {
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  fileData?: string;
  content?: string;
  onOpenPreview: () => void;
}) {
  const meta = getFileCategory(fileName, fileType);
  const IconComp = meta.icon;

  return (
    <div
      className="attached-file-badge"
      onClick={e => {
        e.stopPropagation();
        onOpenPreview();
      }}
      title="Click to expand file"
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenPreview();
        }
      }}
    >
      <div className="attached-file-badge-main">
        <span
          className="attached-file-tag"
          style={{ backgroundColor: meta.badgeBg, color: meta.badgeColor }}
        >
          <IconComp size={13} />
          <span>{meta.label}</span>
        </span>
        <div className="attached-file-info">
          <strong title={fileName}>{fileName || 'Attached File'}</strong>
          {fileSize ? <small>{formatFileSize(fileSize)}</small> : null}
        </div>
      </div>

      <button
        type="button"
        className="attached-file-expand-btn"
        onClick={e => {
          e.stopPropagation();
          onOpenPreview();
        }}
        title="Expand and view file"
        aria-label="Expand and view file"
      >
        <Maximize2 size={13} />
      </button>
    </div>
  );
}
