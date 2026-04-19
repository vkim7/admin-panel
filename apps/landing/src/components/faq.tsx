"use client";

import type { Dictionary } from "@/lib/i18n";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

interface FaqProps {
  dict: Dictionary["faq"];
}

export function Faq({ dict }: FaqProps) {
  return (
    <section id="faq" className="py-16 md:py-24 bg-background border-t-2 border-border">
      <div className="max-w-[1080px] mx-auto px-6">
        <div className="inline-flex font-bold text-[13px] bg-main border-2 border-border rounded-full px-4 py-1.5 shadow-[2px_2px_0_var(--border)] mb-5 text-foreground">
          {dict.tag}
        </div>

        <h2 className="font-heading font-extrabold text-[clamp(28px,4vw,44px)] leading-[1.15] tracking-[-1px] mb-12 max-w-[600px]">
          {dict.heading}
        </h2>

        <div className="max-w-[640px]">
          <Accordion type="single" collapsible className="space-y-3">
            {dict.items.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-base font-bold px-6 py-5">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-5 text-[15px] text-foreground/60 leading-relaxed">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
