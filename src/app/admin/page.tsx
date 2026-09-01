import type { Metadata } from "next";
import { Header } from "@/components/common/Header";
import { AdminDashboard } from "@/features/admin/components/AdminDashboard";

export const metadata: Metadata = {
  title: "Admin & Operations Control Center — IPO Desk",
  description: "Monitor data pipelines, force registrar syncs, tail logs, and manage IPO catalogues.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <AdminDashboard />
      </main>
      <footer className="border-t border-border py-4">
        <div className="container mx-auto px-4 text-center">
          <p className="text-[11px] text-muted-foreground">
            © 2026 IPO Desk · Internal Administration & Telemetry Console.
          </p>
        </div>
      </footer>
    </div>
  );
}
