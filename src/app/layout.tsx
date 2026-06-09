import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IPO Desk — IPO Allotment Checker | Check Status Instantly",
  description:
    "Check IPO allotment status for multiple PANs simultaneously. Supports KFintech IPOs. Upload Excel files for bulk checking. Free and instant results.",
  keywords: ["IPO allotment", "PAN check", "KFintech", "IPO status", "allotment checker", "IPO Desk"],
  icons: {
    icon: [
      { url: "/logo.png", sizes: "32x32", type: "image/png" },
      { url: "/logo.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/logo.png", sizes: "180x180" }],
    shortcut: "/logo.png",
  },
  openGraph: {
    title: "IPO Desk — IPO Allotment Checker",
    description: "Check IPO allotment status for multiple PANs instantly",
    type: "website",
  },
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}
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
