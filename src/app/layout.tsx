import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { CommandPalette } from "@/components/common/CommandPalette";
import { AuthSessionProvider } from "@/components/auth/AuthSessionProvider";
import "./globals.css";

const siteUrl = "https://ipodesk.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "IPO Desk — IPO Allotment Checker | Check Status Instantly",
    template: "%s | IPO Desk",
  },
  description:
    "Check IPO allotment status instantly for any PAN. Free IPO checker for KFintech, Link Intime, Bigshare & MUFG IPOs. Bulk PAN upload, Excel export, live GMP, IPO calendar & AI research reports for Indian investors.",
  keywords: [
    "IPO allotment check",
    "IPO allotment status",
    "PAN check IPO",
    "KFintech allotment",
    "Link Intime allotment",
    "Bigshare allotment",
    "MUFG allotment",
    "IPO status checker",
    "bulk PAN checker",
    "India IPO checker",
    "IPO GMP today",
    "grey market premium IPO",
    "IPO calendar India 2026",
    "upcoming IPO India",
    "IPO subscription status",
    "mainboard IPO",
    "SME IPO",
    "IPO listing gain",
    "IPO allotment date",
    "IPO Desk",
  ],
  authors: [{ name: "IPO Desk" }],
  creator: "IPO Desk",
  publisher: "IPO Desk",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon-180.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "IPO Desk — IPO Allotment Checker & Research Platform",
    description:
      "Check IPO allotment status for multiple PANs instantly. Live GMP, AI research reports, subscription tracker & IPO calendar for Indian investors.",
    url: siteUrl,
    siteName: "IPO Desk",
    type: "website",
    locale: "en_IN",
    images: [
      {
        url: `${siteUrl}/og-banner.jpg`,
        width: 1200,
        height: 630,
        alt: "IPO Desk — India's Smartest IPO Research & Allotment Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "IPO Desk — IPO Allotment Checker & Research Platform",
    description:
      "Check IPO allotment for any PAN. Live GMP, AI research, subscription tracker & IPO calendar.",
    images: [`${siteUrl}/og-banner.jpg`],
  },
  alternates: {
    canonical: siteUrl,
    languages: {
      "en-IN": siteUrl,
    },
  },
  category: "finance",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#6366f1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN" className="dark">
      <body
        className="antialiased min-h-screen bg-background"
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <AuthSessionProvider>
          <div id="main-content">{children}</div>
        </AuthSessionProvider>
        <CommandPalette />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "hsl(222 47% 11%)",
              border: "1px solid hsl(217 33% 17%)",
              color: "hsl(210 40% 98%)",
            },
          }}
        />
      </body>
    </html>
  );
}
