/* Variation A — Single table card */
import type { Dictionary } from "@/lib/i18n";

interface ComparisonProps {
  dict: Dictionary["comparison"];
}

export function Comparison({ dict }: ComparisonProps) {
  const others = dict.competitors.find((c) => !c.featured)!;
  const banana = dict.competitors.find((c) => c.featured)!;

  return (
    <section className="py-16 md:py-24 bg-background border-t-2 border-border">
      <div className="max-w-[1080px] mx-auto px-6">
        <div className="text-center">
          <div className="inline-flex font-bold text-[13px] bg-main border-2 border-border rounded-full px-4 py-1.5 shadow-[2px_2px_0_var(--border)] mb-5 text-foreground">
            {dict.tag}
          </div>
          <h2 className="font-heading font-extrabold text-[clamp(28px,4vw,44px)] leading-[1.15] tracking-[-1px] mb-12 max-w-[600px] mx-auto">
            {dict.heading}
          </h2>
        </div>

        <div className="bg-white border-2 border-border rounded-xl shadow-[6px_6px_0_var(--border)] overflow-hidden max-w-[860px] mx-auto">
          {/* Table header */}
          <div className="grid grid-cols-3 border-b-2 border-border">
            <div className="px-6 py-4" />
            <div className="px-6 py-4 text-center border-l-2 border-border">
              <span className="text-[13px] font-bold text-foreground/40">{others.name}</span>
            </div>
            <div className="px-6 py-4 text-center bg-main border-l-2 border-border">
              <span className="text-[13px] font-black text-foreground">Banana <span className="text-lg">{banana.badge}</span></span>
            </div>
          </div>

          {/* Rows */}
          {others.rows.map((row, i) => {
            const bananaRow = banana.rows[i]!;
            return (
              <div
                key={row.label}
                className={`grid grid-cols-3 ${i > 0 ? "border-t border-border/20" : ""}`}
              >
                <div className="px-6 py-5 flex items-center">
                  <span className="text-[14px] font-bold text-foreground/50">{row.label}</span>
                </div>
                <div className="px-6 py-5 flex items-center justify-center border-l-2 border-border">
                  <span className="text-[15px] font-semibold text-foreground/40">{row.value}</span>
                </div>
                <div className="px-6 py-5 flex items-center justify-center bg-main/20 border-l-2 border-border">
                  <span className="font-heading font-black text-lg text-foreground">{bananaRow.value}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
