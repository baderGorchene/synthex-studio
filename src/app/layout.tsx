import type { Metadata } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import "./typeset.css";

const grotesk = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });

export const metadata: Metadata = {
  title: "Synthex Studio — Grounded Semantic Knowledge Graph",
  description: "Build a connected knowledge graph, trace evidence, and extend research with grounded AI.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  const bodyContent = (
    <html lang="en" className={`h-full antialiased ${grotesk.variable}`}>
      <body className="h-full w-full overflow-hidden m-0 p-0 font-sans">
        {children}
      </body>
    </html>
  );

  if (hasClerk) {
    return <ClerkProvider>{bodyContent}</ClerkProvider>;
  }

  return bodyContent;
}
