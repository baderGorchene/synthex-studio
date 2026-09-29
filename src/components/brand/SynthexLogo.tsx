import Image from 'next/image';

interface SynthexLogoProps {
  size?: number;
  className?: string;
  priority?: boolean;
}

export function SynthexLogo({ size = 28, className = '', priority = true }: SynthexLogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="Synthex Studio"
      width={size}
      height={size}
      priority={priority}
      className={`object-contain select-none ${className}`}
    />
  );
}
