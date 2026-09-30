import Image from 'next/image';

interface SynthexLogoProps {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}

// Source artwork in public/brand, cropped from the same master so the lockup keeps its proportions.
const MARK = { src: '/brand/synthex-mark.png', width: 427, height: 382 };
const WORDMARK = { src: '/brand/synthex-wordmark.png', width: 642, height: 270 };
const MARK_SCALE = 2.1; // `size` stays the old 18-unit scale; the pinned note needs more room than two squares did

/** A pinned paper note (kept, in ink) with the AI's draft dashed in proof blue behind it, linked by one relation. */
export function SynthexMark({ size = 18 }: { size?: number }) {
  const height = Math.round(size * MARK_SCALE);
  const width = Math.round(height * MARK.width / MARK.height);
  return <Image className="synthex-mark" src={MARK.src} width={width} height={height} alt="" aria-hidden="true" priority />;
}

export function SynthexLogo({ size = 18, withWordmark = true, className = '' }: SynthexLogoProps) {
  const markHeight = Math.round(size * MARK_SCALE);
  const wordHeight = Math.round(markHeight * WORDMARK.height / MARK.height);
  const wordWidth = Math.round(wordHeight * WORDMARK.width / WORDMARK.height);
  return (
    <span className={`synthex-logo ${className}`} aria-label={withWordmark ? undefined : 'Synthex'} role={withWordmark ? undefined : 'img'}>
      <SynthexMark size={size} />
      {withWordmark && <Image className="synthex-wordmark" src={WORDMARK.src} width={wordWidth} height={wordHeight} alt="Synthex" priority />}
    </span>
  );
}
