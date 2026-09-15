import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import { Header } from "@/components/common/Header";
import { siteUrl } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "IPO Allotment Check — How to Check IPO Allotment Status by PAN",
  description:
    "Step-by-step guide to check IPO allotment status by PAN number. Covers KFintech, Link Intime, Bigshare and MUFG registrars. Free bulk PAN checker on IPO Desk (IPODESK).",
  keywords: [
    "IPO allotment check",
    "check IPO allotment status",
    "IPO allotment status by PAN",
    "how to check IPO allotment",
    "KFintech allotment check",
    "Link Intime allotment check",
    "Bigshare allotment check",
    "MUFG allotment check",
    "IPO allotment result",
    "IPO allotment date",
    "IPODESK allotment checker",
    "bulk PAN IPO checker",
    "India IPO allotment 2026",
  ],
  alternates: {
    canonical: `${siteUrl}/ipo-allotment-check`,
    languages: { "en-IN": `${siteUrl}/ipo-allotment-check`, "x-default": `${siteUrl}/ipo-allotment-check` },
  },
  openGraph: {
    title: "IPO Allotment Check — Verify Status by PAN | IPO Desk",
    description:
      "Free IPO allotment checker for KFintech, Link Intime, Bigshare and MUFG. Check single or bulk PANs instantly.",
    url: `${siteUrl}/ipo-allotment-check`,
    images: [{ url: `${siteUrl}/og-banner.jpg`, width: 1200, height: 630, alt: "IPO Allotment Check — IPO Desk" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "IPO Allotment Check — IPO Desk (IPODESK)",
    description: "Check IPO allotment status by PAN for any KFintech, Link Intime, Bigshare or MUFG IPO.",
    images: [`${siteUrl}/og-banner.jpg`],
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
    { "@type": "ListItem", position: 2, name: "IPO Allotment Check", item: `${siteUrl}/ipo-allotment-check` },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I check my IPO allotment status?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Visit IPO Desk (IPODESK), enter your PAN number and select the IPO. The checker queries the registrar in real time and shows your allotment result instantly — no login required.",
      },
    },
    {
      "@type": "Question",
      name: "When is the IPO allotment date?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "IPO allotment is typically finalized 6 days after the issue closes. The exact allotment date is listed on the IPO Calendar on IPO Desk for every current IPO.",
      },
    },
    {
      "@type": "Question",
      name: "Can I check allotment for multiple PANs at once?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. IPO Desk supports bulk PAN checking — upload an Excel file with multiple PAN numbers and get allotment results for all applicants in one go.",
      },
    },
    {
      "@type": "Question",
      name: "Which registrars does IPO Desk support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "IPO Desk supports all four major Indian IPO registrars: KFintech, Link Intime India, Bigshare Services, and MUFG Intime.",
      },
    },
    {
      "@type": "Question",
      name: "What if I do not get allotment?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "If you are not allotted shares, the blocked amount in your bank account is unblocked via ASBA/UPI mandate reversal within 1-2 business days after the allotment date.",
      },
    },
  ],
};

const REGISTRARS = [
  { name: "KFintech", formerly: "Karvy Fintech", ipos: "~40% of mainboard IPOs" },
  { name: "Link Intime India", formerly: "Link Intime", ipos: "~35% of mainboard IPOs" },
  { name: "Bigshare Services", formerly: "Bigshare", ipos: "Most SME IPOs on NSE Emerge" },
  { name: "MUFG Intime", formerly: "MUFG Intime India", ipos: "Select mainboard IPOs" },
];

export default function IpoAllotmentCheckPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Script
        id="schema-breadcrumb-allotment"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <Script
        id="schema-faq-allotment"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-br from-primary/5 via-background to-background px-4 py-12 sm:py-16">
          <div className="container mx-auto max-w-4xl">
            <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted-foreground">
              <ol className="flex items-center gap-1.5">
                <li><Link href="/" className="hover:text-foreground">Home</Link></li>
                <li aria-hidden>/</li>
                <li className="text-foreground">IPO Allotment Check</li>
              </ol>
            </nav>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              IPO Allotment Check —{" "}
              <span className="gradient-text">Verify Status by PAN</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground">
              Check your IPO allotment status instantly using your PAN number. IPO Desk (IPODESK)
              supports all four major Indian registrars — no login, no fees, results in seconds.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow transition-opacity hover:opacity-90"
              >
                Check Allotment Now
              </Link>
              <Link
                href="/calendar"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
              >
                IPO Calendar
              </Link>
            </div>
          </div>
        </section>

        {/* Content */}
        <article className="container mx-auto max-w-4xl px-4 py-10 sm:py-14">
          <div className="space-y-10">

            <section>
              <h2 className="text-xl font-bold text-foreground mb-4">How to Check IPO Allotment Status</h2>
              <p className="text-muted-foreground">
                After an IPO closes, the registrar finalises the basis of allotment within 6 business days.
                You can check whether you received shares using your PAN number.
              </p>
              <ol className="mt-4 space-y-3 list-decimal list-inside text-muted-foreground">
                <li>Go to the <Link href="/" className="text-primary hover:underline">IPO Desk allotment checker</Link> on the homepage.</li>
                <li>Select the IPO name from the dropdown or search box.</li>
                <li>Enter your 10-character PAN number (e.g. ABCDE1234F).</li>
                <li>Click <strong className="text-foreground">Check Status</strong> — results appear within 2 seconds.</li>
                <li>For family applications, use the bulk PAN uploader (Excel format supported).</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-4">Supported Registrars</h2>
              <p className="text-muted-foreground mb-4">
                Every Indian IPO appoints one of four SEBI-registered registrars. IPO Desk (IPODESK) connects to all four:
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-card">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Registrar</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Also Known As</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Coverage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {REGISTRARS.map((r) => (
                      <tr key={r.name} className="bg-background transition-colors hover:bg-card">
                        <td className="px-4 py-3 font-medium text-foreground">{r.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.formerly}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.ipos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-4">How IPO Allotment Works (SEBI Rules)</h2>
              <p className="text-muted-foreground">
                Indian IPOs use the ASBA (Application Supported by Blocked Amount) mechanism.
                Your bank blocks the application money until allotment.
                Under SEBI guidelines for the retail category:
              </p>
              <ul className="mt-4 space-y-2 list-disc list-inside text-muted-foreground">
                <li>If the retail portion is undersubscribed, all applicants receive their full lot quantity.</li>
                <li>If oversubscribed, allotment is done via a computerised lottery — each unique PAN gets one entry regardless of lot count applied.</li>
                <li>Applying for more lots with the same PAN does NOT improve your odds.</li>
                <li>Unallotted amounts are unblocked within 1-2 business days after the allotment date.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-6">Frequently Asked Questions</h2>
              <div className="space-y-4">
                {faqSchema.mainEntity.map((q) => (
                  <details key={q.name} className="rounded-lg border border-border bg-card p-4">
                    <summary className="cursor-pointer font-medium text-foreground list-none flex items-center justify-between gap-2">
                      {q.name}
                      <span className="text-muted-foreground text-lg leading-none select-none">+</span>
                    </summary>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                      {q.acceptedAnswer.text}
                    </p>
                  </details>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center">
              <h2 className="text-lg font-bold text-foreground">Ready to check your allotment?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                IPO Desk (IPODESK) is free, instant, and works for all Indian registrars.
              </p>
              <Link
                href="/"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow transition-opacity hover:opacity-90"
              >
                Check IPO Allotment Status Now
              </Link>
            </section>

          </div>
        </article>
      </main>

      <footer className="border-t border-border py-3">
        <div className="container mx-auto px-4 text-center">
          <p className="text-[10px] text-muted-foreground">
            2026 IPO Desk (IPODESK) - Allotment data sourced from official registrar systems.
          </p>
        </div>
      </footer>
    </div>
  );
}
