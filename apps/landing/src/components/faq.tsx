"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface FaqProps {
  dict: Dictionary["faq"];
}

export function Faq({ dict }: FaqProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-16 md:py-24 bg-background border-t-2 border-border">
      <div className="max-w-[1080px] mx-auto px-6 text-center">
        <div className="inline-flex font-bold text-[13px] bg-main border-2 border-border rounded-full px-4 py-1.5 shadow-[2px_2px_0_var(--border)] mb-5 text-foreground">
          {dict.tag}
        </div>

        <h2 className="font-heading font-extrabold text-[clamp(28px,4vw,44px)] leading-[1.15] tracking-[-1px] mb-12 max-w-[600px] mx-auto">
          {dict.heading}
        </h2>

        <div className="max-w-[640px] mx-auto space-y-3">
          {dict.items.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className={cn(
                  "bg-secondary-background border-2 border-border rounded-base shadow-[3px_3px_0_var(--border)] overflow-hidden transition-all",
                  "hover:shadow-[4px_4px_0_var(--border)] hover:-translate-x-px hover:-translate-y-px",
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left cursor-pointer select-none"
                >
                  <span className="text-base font-bold">{item.question}</span>
                  <span
                    className={cn(
                      "w-7 h-7 flex items-center justify-center rounded-full border-2 border-border text-lg font-extrabold shrink-0 transition-all duration-200",
                      isOpen
                        ? "bg-main rotate-45"
                        : "bg-background",
                    )}
                  >
                    +
                  </span>
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 text-[15px] text-foreground/60 leading-relaxed">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
