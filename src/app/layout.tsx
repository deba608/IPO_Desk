import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

const siteUrl = "https://ipodesk.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "IPO Desk — IPO Allotment Checker | Check Status Instantly",
    template: "%s | IPO Desk",
  },
  description:
    "Check IPO allotment status for single or multiple PANs instantly. Free IPO allotment checker supporting KFintech IPOs. Upload Excel for bulk checking and export results to CSV.",
  keywords: [
    "IPO allotment check",
    "PAN check IPO",
    "KFintech allotment",
    "IPO status checker",
    "bulk PAN checker",
    "IPO allotment status",
    "India IPO checker",
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
    title: "IPO Desk — IPO Allotment Checker",
    description: "Check IPO allotment status for multiple PANs instantly",
    url: siteUrl,
    siteName: "IPO Desk",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "IPO Desk — IPO Allotment Checker",
    description: "Check IPO allotment status for multiple PANs instantly",
  },
  alternates: {
    canonical: siteUrl,
  },
  category: "finance",
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className="antialiased min-h-screen bg-background"
      >
        {children}
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
