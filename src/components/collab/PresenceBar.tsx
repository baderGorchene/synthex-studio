'use client';

import { useEffect, useRef, useState } from 'react';
import { Crosshair } from 'lucide-react';
import type { CollabStatus, PresencePeer, PresenceUser } from './useCollaboration';

const MAX_AVATARS = 4;

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** One entry per person, even when they have the map open in several tabs. */
export function uniquePeople(peers: PresencePeer[]): PresencePeer[] {
  const seen = new Map<string, PresencePeer>();
  for (const peer of peers) {
    const current = seen.get(peer.user.id);
    // Prefer the tab that is actually pointing at the board.
    if (!current || (!current.cursor && peer.cursor)) seen.set(peer.user.id, peer);
  }
  return [...seen.values()];
}

const STATUS_LABEL: Record<Exclude<CollabStatus, 'off'>, string> = {
  connecting: 'Connecting…',
  live: 'Live',
  reconnecting: 'Reconnecting…'
};

/** Who's on this map right now, in the top bar: a live dot, stacked avatars and a list to jump to anyone's cursor. */
export function PresenceBar({ status, peers, self, onJumpTo, titleOf }: {
  status: CollabStatus;
  peers: PresencePeer[];
  self: PresenceUser | null;
  onJumpTo: (peer: PresencePeer) => void;
  /** Title of the note a peer is working on, for the list. */
  titleOf: (id: string) => string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!anchor.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', escape); };
  }, [open]);

  if (status === 'off') return null;
  const people = uniquePeople(peers).filter(peer => peer.user.id !== self?.id);
  const shown = people.slice(0, MAX_AVATARS);
  const extra = people.length - shown.length;
  const summary = people.length === 0 ? 'Only you' : `${people.length + 1} here`;

  return (
    <div className={`presence-bar is-${status}`} ref={anchor}>
      <button
        type="button"
        className="presence-trigger"
        aria-expanded={open}
        aria-label={`${STATUS_LABEL[status]}. ${summary} on this map. Show who's here`}
        title={`${STATUS_LABEL[status]} · ${summary}`}
        onClick={() => setOpen(value => !value)}
      >
        <span className="presence-status"><i aria-hidden="true" />{STATUS_LABEL[status]}</span>
        <span className="presence-avatars" aria-hidden="true">
          {shown.map(peer => (
            <span key={peer.user.id} className="presence-avatar" style={{ ['--peer' as string]: peer.user.color }}>{initialsOf(peer.user.name)}</span>
          ))}
          {extra > 0 && <span className="presence-avatar is-more">+{extra}</span>}
          {self && <span className="presence-avatar is-self" style={{ ['--peer' as string]: self.color }}>{initialsOf(self.name)}</span>}
        </span>
      </button>

      {open && (
        <div className="menu-popover presence-menu" role="dialog" aria-label="People on this map">
          <p className="presence-menu-title">On this map now</p>
          <ul>
            {self && (
              <li>
                <span className="presence-avatar" style={{ ['--peer' as string]: self.color }}>{initialsOf(self.name)}</span>
                <span className="presence-who"><strong>{self.name}</strong><small>You</small></span>
              </li>
            )}
            {people.map(peer => {
              const editing = peer.editing ? titleOf(peer.editing) : undefined;
              const selected = !editing && peer.selection.length ? titleOf(peer.selection[0]) : undefined;
              return (
                <li key={peer.user.id}>
                  <span className="presence-avatar" style={{ ['--peer' as string]: peer.user.color }}>{initialsOf(peer.user.name)}</span>
                  <span className="presence-who">
                    <strong>{peer.user.name}</strong>
                    <small>{editing ? `Writing in “${editing}”` : selected ? `Looking at “${selected}”` : peer.cursor ? 'On the board' : 'Viewing'}</small>
                  </span>
                  <button
                    type="button"
                    className="icon-button presence-jump"
                    aria-label={`Jump to ${peer.user.name}`}
                    title={`Jump to ${peer.user.name}`}
                    disabled={!peer.cursor && !peer.selection.length}
                    onClick={() => { onJumpTo(peer); setOpen(false); }}
                  >
                    <Crosshair size={16} strokeWidth={1.75} />
                  </button>
                </li>
              );
            })}
          </ul>
          {people.length === 0 && <p className="note-meta presence-empty">Share this map with your team and you’ll see them here as they work.</p>}
          {status === 'reconnecting' && <p className="note-meta presence-empty">Connection lost. Your changes are kept and will sync when you’re back.</p>}
        </div>
      )}
    </div>
  );
}
