import type { Viewport } from 'next';

// The workspace is a full-screen app with its own pinch zoom. Stop the browser zooming the page
// (on iOS that also stops the zoom-in when a text field is focused), and let the layout reach
// under the notch and home bar so the bottom composer can pad itself with the safe area.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  // Android: the keyboard shrinks the layout, so the bottom composer rides above it.
  interactiveWidget: 'resizes-content',
};

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
