import { Check } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";

interface PricingProps {
  dict: Dictionary["pricing"];
  locale: string;
}

export function Pricing({ dict, locale }: PricingProps) {
  const plans = [dict.group, dict.individual];

  return (
    <section id="pricing" className="py-16 md:py-24 bg-background border-t-2 border-border">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[860px] mx-auto">
          {plans.map((plan) => (
            <div key={plan.title} className="bg-white border-2 border-border rounded-xl shadow-[6px_6px_0_var(--border)] overflow-hidden flex flex-col">
              {/* Yellow header */}
              <div className="bg-main border-b-2 border-border px-8 py-8 text-center">
                <div className="font-heading font-bold text-lg mb-3">
                  {plan.title}
                </div>
                <div className="font-heading font-black text-4xl leading-none mb-1">
                  {plan.price}
                </div>
                <div className="text-[14px] font-semibold text-foreground/60">
                  {plan.period}
                </div>
              </div>

              {/* Body with checklist */}
              <div className="px-8 py-7 flex flex-col flex-1">
                <ul className="flex-1">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-3 py-3 border-b border-border/20 last:border-b-0 text-[15px] font-semibold"
                    >
                      <span className="w-[22px] h-[22px] bg-leaf-green border-2 border-border rounded-full flex items-center justify-center shrink-0">
                        <Check size={12} strokeWidth={3} className="text-white" />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
