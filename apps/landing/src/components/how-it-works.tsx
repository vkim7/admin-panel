import type { Dictionary } from "@/lib/i18n";

interface HowItWorksProps {
  dict: Dictionary["howItWorks"];
}

export function HowItWorks({ dict }: HowItWorksProps) {
  return (
    <section className="py-16 md:py-24 bg-white">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-[400px] md:max-w-none mx-auto">
          {dict.steps.map((step, i) => (
            <div
              key={step.title}
              className="bg-white border-2 border-border rounded-xl p-9 text-center shadow-shadow transition-all hover:shadow-[6px_6px_0_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px]"
            >
              <div className="w-9 h-9 bg-main border-2 border-border rounded-full flex items-center justify-center font-heading font-extrabold text-[15px] mx-auto mb-5 shadow-[2px_2px_0_var(--border)]">
                {i + 1}
              </div>
              <h3 className="font-heading font-bold text-lg mb-2 tracking-[-0.3px]">
                {step.title}
              </h3>
              <p className="text-[15px] text-foreground/60 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
