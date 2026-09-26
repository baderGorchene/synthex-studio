import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Synthex Research Workspace",
  description: "Build a connected knowledge graph, trace evidence, and extend research with grounded AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full w-full overflow-hidden m-0 p-0 font-sans">
        {children}
      </body>
    </html>
  );
}
