interface SynthexLogoProps {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}

/** Two overlapping squares: your note (ink) with the AI's draft (proof blue) pinned onto it. */
export function SynthexMark({ size = 18 }: { size?: number }) {
  return (
    <svg className="synthex-mark" width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="12" height="12" fill="#111214" />
      <rect className="synthex-mark-draft" x="8" y="8" width="10" height="10" fill="#1F3DFF" />
    </svg>
  );
}

export function SynthexLogo({ size = 18, withWordmark = true, className = '' }: SynthexLogoProps) {
  return (
    <span className={`synthex-logo ${className}`} aria-label={withWordmark ? undefined : 'Synthex'} role={withWordmark ? undefined : 'img'}>
      <SynthexMark size={size} />
      {withWordmark && <span className="synthex-wordmark" style={{ fontSize: Math.round(size * 0.95) }}>Synthex</span>}
    </span>
  );
}
