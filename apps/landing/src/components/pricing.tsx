import Link from "next/link";
import { Check } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

interface PricingProps {
  dict: Dictionary["pricing"];
  locale: string;
}

export function Pricing({ dict, locale }: PricingProps) {
  return (
    <section id="pricing" className="py-16 md:py-24 bg-white border-t-2 border-border">
      <div className="max-w-[1080px] mx-auto px-6">
        <div className="text-center">
          <div className="inline-flex font-bold text-[13px] bg-main border-2 border-border rounded-full px-4 py-1.5 shadow-[2px_2px_0_var(--border)] mb-5 text-foreground">
            {dict.tag}
          </div>

          <h2 className="font-heading font-extrabold text-[clamp(28px,4vw,44px)] leading-[1.15] tracking-[-1px] mb-4 max-w-[600px] mx-auto">
            {dict.heading}
          </h2>

          <p className="text-[17px] text-foreground/60 max-w-[520px] mx-auto mb-12 leading-relaxed">
            {dict.description}
          </p>
        </div>

        {/* Pricing card */}
        <div className="max-w-[480px] mx-auto bg-white border-2 border-border rounded-xl shadow-[6px_6px_0_var(--border)] overflow-hidden">
          {/* Yellow header */}
          <div className="bg-main border-b-2 border-border px-9 py-10 text-center">
            <div className="font-heading font-black text-5xl leading-none mb-1">
              {dict.price}
            </div>
            <div className="text-[15px] font-semibold text-foreground/60">
              {dict.period}
            </div>
          </div>

          {/* Body with checklist */}
          <div className="px-9 py-8">
            <ul className="mb-8">
              {dict.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-3 py-3 border-b border-border/20 last:border-b-0 text-[15px] font-semibold"
                >
                  <span className="w-[22px] h-[22px] bg-main border-2 border-border rounded-full flex items-center justify-center shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <Button asChild size="lg" className="w-full rounded-full text-base">
              <Link href={`/${locale}#cta`}>{dict.cta}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
