"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { CalendarIPOWithStatus } from "@/types/calendar.types";
import { formatINR } from "@/features/ipo-calendar/lib/format";

interface Props {
  ipo: CalendarIPOWithStatus;
}

export function IpoFaq({ ipo }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: `What is the lot size and minimum investment for ${ipo.name}?`,
      a: `The retail lot size is ${ipo.lotSize} shares. At the upper cut-off price band of ₹${ipo.priceBand.max} per share, the minimum retail investment is ${formatINR(ipo.minInvestment)} per application lot.`,
    },
    {
      q: `When does ${ipo.name} IPO open and close for subscription?`,
      a: `The issue opens on ${ipo.openDate} and closes on ${ipo.closeDate}. The UPI mandate authorization window typically closes by 5:00 PM IST on the final closing day.`,
    },
    {
      q: `Who is the registrar for this IPO and how do I check allotment?`,
      a: `The designated registrar is ${ipo.registrar.toUpperCase()}. Once the basis of allotment is finalized on ${ipo.allotmentDate || "the allotment date"}, you can verify status directly on IPODesk's Allotment Checker using your PAN number.`,
    },
    {
      q: `How is allotment calculated in case of retail oversubscription?`,
      a: `Under SEBI guidelines, if the retail portion is oversubscribed (e.g. 5x or 20x), allotment is conducted via a computerised lottery so that as many unique applicants as possible receive at least one minimum lot. Applying for multiple lots under a single PAN does not increase lottery odds.`,
    },
    {
      q: `What is the tax implication on listing day gains?`,
      a: `Profits realized from selling allotted IPO shares on listing day are treated as Short-Term Capital Gains (STCG) and are taxed at 20% (plus applicable surcharge & cess) under Section 111A of the Income Tax Act.`,
    },
  ];

  return (
    <div className="space-y-2 text-xs">
      {faqs.map((faq, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={index}
            className="rounded-lg border border-border/80 bg-card transition-colors overflow-hidden"
          >
            <button
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex w-full items-center justify-between p-3 text-left font-medium text-foreground hover:bg-muted/30"
            >
              <span className="flex items-center gap-2 pr-2">
                <HelpCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                {faq.q}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                  isOpen ? "rotate-180 text-primary" : ""
                }`}
              />
            </button>

            {isOpen && (
              <div className="border-t border-border/40 bg-muted/10 px-3.5 py-3 text-muted-foreground leading-relaxed">
                {faq.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
