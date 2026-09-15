import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "IPO GMP Today — Live Grey Market Premium for All Indian IPOs",
  description:
    "Track live IPO Grey Market Premium (GMP) for all mainboard and SME IPOs in India. Understand GMP meaning, how to interpret it, and see estimated listing prices on IPO Desk (IPODESK).",
  keywords: [
    "IPO GMP today",
    "IPO grey market premium",
    "IPO GMP live",
    "grey market premium today",
    "IPO GMP 2026",
    "IPO listing price estimate",
    "IPO GMP meaning",
    "how to check IPO GMP",
    "IPODESK GMP",
    "mainboard IPO GMP",
    "SME IPO GMP",
    "IPO premium today India",
  ],
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://ipo-desk.vercel.app"}/ipo-gmp-today`,
    languages: {
      "en-IN": `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://ipo-desk.vercel.app"}/ipo-gmp-today`,
      "x-default": `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://ipo-desk.vercel.app"}/ipo-gmp-today`,
    },
  },
  openGraph: {
    title: "IPO GMP Today — Live Grey Market Premium | IPO Desk",
    description:
      "Live IPO GMP for all mainboard and SME IPOs. See estimated listing price, GMP %, and historical trend.",
    url: `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://ipo-desk.vercel.app"}/ipo-gmp-today`,
    images: [{ url: `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://ipo-desk.vercel.app"}/og-banner.jpg`, width: 1200, height: 630, alt: "IPO GMP Today — IPO Desk" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "IPO GMP Today — Live Grey Market Premium | IPODESK",
    description: "Track live IPO GMP and estimated listing prices for all Indian IPOs.",
    images: [`${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://ipo-desk.vercel.app"}/og-banner.jpg`],
  },
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://ipo-desk.vercel.app";

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
    { "@type": "ListItem", position: 2, name: "IPO GMP Today", item: `${siteUrl}/ipo-gmp-today` },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is IPO GMP (Grey Market Premium)?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "IPO GMP (Grey Market Premium) is the price at which IPO shares are traded informally in the grey market — before the official stock exchange listing. A positive GMP means the market expects the shares to list above the issue price; a negative GMP signals expected listing below issue price.",
      },
    },
    {
      "@type": "Question",
      name: "How is estimated listing price calculated from GMP?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Estimated listing price = Issue price (upper end of price band) + GMP. For example, if an IPO has a price band of Rs 100-110 and a GMP of Rs 50, the estimated listing price is Rs 160 — a 45% listing gain.",
      },
    },
    {
      "@type": "Question",
      name: "Is IPO GMP reliable for predicting listing gains?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "GMP is indicative, not guaranteed. It reflects grey-market sentiment and is often directionally correct for high-demand IPOs. However, actual listing prices can differ significantly. Always consider subscription data, financials and market conditions alongside GMP.",
      },
    },
    {
      "@type": "Question",
      name: "Where can I see live GMP for all IPOs?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "IPO Desk (IPODESK) tracks live GMP for all ongoing mainboard and SME IPOs on the IPO Calendar page. Each IPO detail page shows the GMP chart and estimated listing price.",
      },
    },
  ],
};

export default function IpoGmpTodayPage() {
  // The actual live GMP data is on /calendar — this page provides SEO content
  // and links users to the live calendar.
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Script
        id="schema-breadcrumb-gmp"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <Script
        id="schema-faq-gmp"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* We inline Header to avoid circular imports in server component */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-foreground">
            IPO Desk
          </Link>
          <nav className="hidden items-center gap-4 text-sm sm:flex">
            <Link href="/calendar" className="text-muted-foreground hover:text-foreground transition-colors">Calendar</Link>
            <Link href="/upcoming-ipo" className="text-muted-foreground hover:text-foreground transition-colors">Upcoming IPOs</Link>
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">Check Allotment</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-br from-primary/5 via-background to-background px-4 py-12 sm:py-16">
          <div className="container mx-auto max-w-4xl">
            <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted-foreground">
              <ol className="flex items-center gap-1.5">
                <li><Link href="/" className="hover:text-foreground">Home</Link></li>
                <li aria-hidden>/</li>
                <li className="text-foreground">IPO GMP Today</li>
              </ol>
            </nav>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              IPO GMP Today —{" "}
              <span className="gradient-text">Live Grey Market Premium</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground">
              Track live Grey Market Premium (GMP) for all ongoing mainboard and SME IPOs in India.
              See estimated listing prices, GMP percentage, and trend charts — updated daily on IPO Desk (IPODESK).
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/calendar"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow transition-opacity hover:opacity-90"
              >
                View Live IPO GMP Now
              </Link>
              <Link
                href="/upcoming-ipo"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
              >
                Upcoming IPOs
              </Link>
            </div>
          </div>
        </section>

        {/* Content */}
        <article className="container mx-auto max-w-4xl px-4 py-10 sm:py-14">
          <div className="space-y-10">

            <section>
              <h2 className="text-xl font-bold text-foreground mb-4">What is IPO GMP (Grey Market Premium)?</h2>
              <p className="text-muted-foreground">
                IPO GMP, or Grey Market Premium, is the unofficial premium at which IPO shares trade in the informal
                grey market <strong className="text-foreground">before their official listing</strong> on NSE or BSE.
                The grey market is not regulated by SEBI and operates through word-of-mouth networks and financial grey-market operators.
              </p>
              <p className="mt-3 text-muted-foreground">
                A <strong className="text-foreground">positive GMP</strong> (e.g. Rs 80 premium on a Rs 400 issue) indicates
                the grey market expects shares to list at Rs 480 — a 20% listing gain.
                A <strong className="text-foreground">negative or zero GMP</strong> suggests weak demand and potential listing below issue price.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-4">How to Calculate Estimated Listing Price from GMP</h2>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-mono text-foreground">
                  Estimated Listing Price = Issue Price (Cap) + GMP
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Example: Price band Rs 300-320, GMP = Rs 50 ? Estimated listing = Rs 370 (15.6% gain)
                </p>
              </div>
              <p className="mt-3 text-muted-foreground">
                The GMP percentage is calculated as: <code className="text-xs bg-muted px-1 rounded">(GMP / Cap Price) × 100</code>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-4">Where to Track Live IPO GMP</h2>
              <p className="text-muted-foreground">
                IPO Desk (IPODESK) tracks live GMP for all active IPOs on the{" "}
                <Link href="/calendar" className="text-primary hover:underline">IPO Calendar page</Link>.
                Each IPO detail page includes:
              </p>
              <ul className="mt-3 space-y-2 list-disc list-inside text-muted-foreground">
                <li>Current GMP value and percentage</li>
                <li>Estimated listing price based on GMP</li>
                <li>GMP trend chart (historical GMP movement)</li>
                <li>Subscription data alongside GMP for context</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-4">Is GMP Reliable?</h2>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-sm text-amber-400 font-medium mb-1">Important Disclaimer</p>
                <p className="text-sm text-muted-foreground">
                  GMP is <strong className="text-foreground">indicative only</strong> and not a guarantee of listing performance.
                  It reflects grey-market sentiment which may not align with actual market conditions on listing day.
                  Do not make investment decisions based solely on GMP. Consider subscription levels, financial
                  performance, industry conditions, and your own risk appetite.
                </p>
              </div>
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
              <h2 className="text-lg font-bold text-foreground">See Live IPO GMP Now</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                All current IPOs with live GMP and estimated listing prices — updated daily.
              </p>
              <Link
                href="/calendar"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow transition-opacity hover:opacity-90"
              >
                View IPO Calendar with Live GMP
              </Link>
            </section>

          </div>
        </article>
      </main>

      <footer className="border-t border-border py-3">
        <div className="container mx-auto px-4 text-center">
          <p className="text-[10px] text-muted-foreground">
            2026 IPO Desk (IPODESK) - GMP figures are indicative, not investment advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
