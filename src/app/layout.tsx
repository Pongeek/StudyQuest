import type { Metadata, Viewport } from "next";
import { Inter, Press_Start_2P } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import "katex/dist/katex.min.css";

// Body + nav links + paragraph copy. Modern grotesk — carries the bulk of
// the type scale so the app stays readable on mobile.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Pixel display face — used only on the brand wordmark, level/XP/streak HUD
// chips, and a couple of headline moments. Press Start 2P is iconic 8-bit
// and unmistakably "game UI" — it should *not* be used for body copy.
const pixel = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pixel-display",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "StudyQuest — Turn Studying into an Adventure",
  description:
    "AI-powered gamified study platform. Upload your course material, earn XP, level up, and master any subject.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        suppressHydrationWarning
        // The app is dark-only — lock in the `.dark` class so shadcn variants
        // (e.g. button `outline` which uses `bg-background`) resolve against
        // the dark-mode tokens defined in globals.css. Without this, outline
        // buttons fall back to the light `--background` token and render
        // with a white background.
        className={`${inter.variable} ${pixel.variable} dark`}
      >
        <body className="font-sans antialiased">
          {children}
          <Toaster richColors position="top-right" />
        </body>
      </html>
    </ClerkProvider>
  );
}
