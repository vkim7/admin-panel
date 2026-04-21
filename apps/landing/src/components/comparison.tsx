import type { Dictionary } from "@/lib/i18n";

interface ComparisonProps {
  dict: Dictionary["comparison"];
}

export function Comparison({ dict }: ComparisonProps) {
  return (
    <section className="py-16 md:py-24 bg-background border-t-2 border-border">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-[700px] mx-auto items-start">
          {dict.competitors.map((comp) => {
            const isFeatured = comp.featured;
            return (
              <div
                key={comp.name}
                className={`relative border-2 border-border rounded-xl p-7 text-center ${
                  isFeatured
                    ? "bg-foreground text-white shadow-[6px_6px_0_var(--main)] md:scale-105 z-10"
                    : "bg-white shadow-shadow"
                }`}
              >
                {isFeatured && comp.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-main text-foreground text-[12px] font-bold px-4 py-1 rounded-full border-2 border-border">
                    {comp.badge}
                  </div>
                )}

                <div className={`font-heading font-black text-xl mb-6 ${isFeatured ? "text-main" : ""}`}>
                  {comp.name}
                </div>

                {comp.rows.map((row) => (
                  <div
                    key={row.label}
                    className={`flex justify-between items-center py-3 border-t ${
                      isFeatured ? "border-[#333]" : "border-border/20"
                    }`}
                  >
                    <span className={`text-[14px] font-medium ${isFeatured ? "text-[#999]" : "text-foreground/50"}`}>
                      {row.label}
                    </span>
                    <span className={`font-heading font-bold text-[15px] ${
                      isFeatured && "highlight" in row && row.highlight ? "text-main" : ""
                    }`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
