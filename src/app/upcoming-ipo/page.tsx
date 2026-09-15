import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import { getCalendar } from "@/features/ipo-calendar/lib/calendar.service";
import { siteUrl } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Upcoming IPO India 2026 — All Mainboard & SME IPOs This Week",
  description:
    "Complete list of upcoming IPOs in India for 2026. Check opening dates, price bands, lot sizes, issue sizes and GMP for all mainboard and SME IPOs. Track new IPOs with IPO Desk (IPODESK).",
  keywords: [
    "upcoming IPO India 2026",
    "upcoming IPO this week",
    "new IPO India 2026",
    "IPO open today",
    "IPO opening date",
    "upcoming mainboard IPO",
    "upcoming SME IPO",
    "new IPO listing 2026",
    "IPODESK upcoming IPO",
    "IPO next week India",
    "IPO schedule 2026",
  ],
  alternates: {
    canonical: `${siteUrl}/upcoming-ipo`,
    languages: { "en-IN": `${siteUrl}/upcoming-ipo`, "x-default": `${siteUrl}/upcoming-ipo` },
  },
  openGraph: {
    title: "Upcoming IPO India 2026 — Full Schedule | IPO Desk",
    description:
      "Track all upcoming mainboard and SME IPOs in India. Opening dates, price bands, lot sizes and GMP.",
    url: `${siteUrl}/upcoming-ipo`,
    images: [{ url: `${siteUrl}/og-banner.jpg`, width: 1200, height: 630, alt: "Upcoming IPO India 2026 — IPO Desk" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Upcoming IPO India 2026 — IPODESK",
    description: "Full list of upcoming mainboard & SME IPOs in India for 2026.",
    images: [`${siteUrl}/og-banner.jpg`],
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
    { "@type": "ListItem", position: 2, name: "Upcoming IPO India 2026", item: `${siteUrl}/upcoming-ipo` },
  ],
};

function formatBand(band: { min: number; max: number }): string {
  return band.min === band.max ? `Rs ${band.max}` : `Rs ${band.min}-${band.max}`;
}

function formatCr(cr: number): string {
  return `Rs ${cr.toLocaleString("en-IN")} Cr`;
}

export default async function UpcomingIpoPage() {
  let upcomingIpos: Awaited<ReturnType<typeof getCalendar>>["ipos"] = [];
  let openIpos: typeof upcomingIpos = [];
  let itemListSchema: object = {};

  try {
    const { ipos } = await getCalendar();
    upcomingIpos = ipos.filter((i) => i.lifecycle === "upcoming");
    openIpos = ipos.filter((i) => i.lifecycle === "open");

    const allDisplayed = [...openIpos, ...upcomingIpos];
    itemListSchema = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Upcoming IPO India 2026",
      description: "List of upcoming and open IPOs in India for 2026",
      url: `${siteUrl}/upcoming-ipo`,
      numberOfItems: allDisplayed.length,
      itemListElement: allDisplayed.map((ipo, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        name: `${ipo.name} IPO`,
        url: `${siteUrl}/ipo/${ipo.id}`,
        description: `${ipo.name} IPO: ${formatBand(ipo.priceBand)}, lot size ${ipo.lotSize}, opens ${ipo.openDate}`,
      })),
    };
  } catch {
    // fallback gracefully
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Script
        id="schema-breadcrumb-upcoming"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {Object.keys(itemListSchema).length > 0 && (
        <Script
          id="schema-itemlist-upcoming"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
        />
      )}

      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-foreground">
            IPO Desk
          </Link>
          <nav className="hidden items-center gap-4 text-sm sm:flex">
            <Link href="/calendar" className="text-muted-foreground hover:text-foreground transition-colors">Calendar</Link>
            <Link href="/ipo-gmp-today" className="text-muted-foreground hover:text-foreground transition-colors">GMP Today</Link>
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">Check Allotment</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-br from-primary/5 via-background to-background px-4 py-12 sm:py-16">
          <div className="container mx-auto max-w-5xl">
            <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted-foreground">
              <ol className="flex items-center gap-1.5">
                <li><Link href="/" className="hover:text-foreground">Home</Link></li>
                <li aria-hidden>/</li>
                <li className="text-foreground">Upcoming IPOs 2026</li>
              </ol>
            </nav>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Upcoming IPO India 2026 —{" "}
              <span className="gradient-text">Full Schedule</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground">
              Complete list of upcoming and open IPOs in India for 2026. Track opening dates, price
              bands, lot sizes, issue sizes, GMP and subscription status — all in one place on
              IPO Desk (IPODESK).
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/calendar"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow transition-opacity hover:opacity-90"
              >
                Full IPO Calendar
              </Link>
              <Link
                href="/ipo-gmp-today"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
              >
                IPO GMP Today
              </Link>
            </div>
          </div>
        </section>

        <div className="container mx-auto max-w-5xl px-4 py-10 sm:py-14 space-y-10">

          {/* Open IPOs */}
          {openIpos.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-foreground mb-1">IPOs Open for Subscription Now</h2>
              <p className="text-sm text-muted-foreground mb-5">
                These IPOs are currently accepting applications. Apply via your broker before the close date.
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-card">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">IPO Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Price Band</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Lot Size</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Issue Size</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Closes</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Board</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {openIpos.map((ipo) => (
                      <tr key={ipo.id} className="bg-background transition-colors hover:bg-card">
                        <td className="px-4 py-3">
                          <Link href={`/ipo/${ipo.id}`} className="font-medium text-primary hover:underline">
                            {ipo.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatBand(ipo.priceBand)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{ipo.lotSize} shares</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatCr(ipo.issueSizeCr)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{ipo.closeDate}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ipo.board === "mainboard" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {ipo.board === "mainboard" ? "Mainboard" : "SME"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Upcoming IPOs */}
          {upcomingIpos.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-foreground mb-1">Upcoming IPOs — Opening Soon</h2>
              <p className="text-sm text-muted-foreground mb-5">
                These IPOs are confirmed or announced but not yet open for subscription.
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-card">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">IPO Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Price Band</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Lot Size</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Issue Size</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Opens</th>
                      <th className="px-4 py-3 text-left font-semibold text-foreground">Board</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {upcomingIpos.map((ipo) => (
                      <tr key={ipo.id} className="bg-background transition-colors hover:bg-card">
                        <td className="px-4 py-3">
                          <Link href={`/ipo/${ipo.id}`} className="font-medium text-primary hover:underline">
                            {ipo.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatBand(ipo.priceBand)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{ipo.lotSize} shares</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatCr(ipo.issueSizeCr)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{ipo.openDate}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ipo.board === "mainboard" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {ipo.board === "mainboard" ? "Mainboard" : "SME"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {openIpos.length === 0 && upcomingIpos.length === 0 && (
            <div className="rounded-lg border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">No upcoming IPOs found at this time. Check back soon or visit the</p>
              <Link href="/calendar" className="mt-2 inline-block text-primary hover:underline">full IPO Calendar</Link>
            </div>
          )}

          {/* Info Section */}
          <section>
            <h2 className="text-xl font-bold text-foreground mb-4">How to Apply for Upcoming IPOs</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { step: "1", title: "Track the Opening Date", desc: "Save the IPO opening date from the calendar. Set a reminder 1 day before." },
                { step: "2", title: "Check Price Band & Lot Size", desc: "Calculate minimum investment: Lot size × Cap price. Ensure you have funds ready." },
                { step: "3", title: "Apply via Your Broker", desc: "Use your stock broker's app (Zerodha, Groww, Upstox, HDFC Securities, etc.) to apply on day 1." },
                { step: "4", title: "Approve UPI Mandate", desc: "Approve the UPI payment mandate in your bank app within 24 hours of application." },
                { step: "5", title: "Track with Family Checklist", desc: "Use IPO Desk's Family Checklist to track applications across multiple PANs." },
                { step: "6", title: "Check Allotment", desc: "Once allotment is finalised, check your PAN status instantly on IPO Desk." },
              ].map((item) => (
                <div key={item.step} className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {item.step}
                  </div>
                  <p className="font-medium text-foreground text-sm">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center">
            <h2 className="text-lg font-bold text-foreground">Never Miss an IPO</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Use the family checklist to track all your bids across multiple PANs and UPI IDs.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link href="/apply" className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow transition-opacity hover:opacity-90">
                Family IPO Checklist
              </Link>
              <Link href="/calendar" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40">
                Full IPO Calendar
              </Link>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-border py-3">
        <div className="container mx-auto px-4 text-center">
          <p className="text-[10px] text-muted-foreground">
            2026 IPO Desk (IPODESK) - IPO data is for informational purposes only, not investment advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
