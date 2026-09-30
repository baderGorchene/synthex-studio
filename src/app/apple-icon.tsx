import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// The 18-unit mark on the field, inset so iOS rounding never clips the squares.
export default function AppleIcon() {
  const u = 7; // 18 units * 7 = 126px, centred in 180
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#FAFAF8', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 27, top: 27, width: 12 * u, height: 12 * u, background: '#111214' }} />
        <div style={{ position: 'absolute', left: 27 + 8 * u, top: 27 + 8 * u, width: 10 * u, height: 10 * u, background: '#1F3DFF' }} />
      </div>
    ),
    size
  );
}
