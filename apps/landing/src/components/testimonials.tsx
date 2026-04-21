import { Quote } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";

interface TestimonialsProps {
  dict: Dictionary["testimonials"];
}

const cardColors = [
  { quote: "text-leaf-green", avatar: "bg-leaf-green" },
  { quote: "text-sky-blue", avatar: "bg-sky-blue" },
  { quote: "text-purple", avatar: "bg-purple" },
] as const;

export function Testimonials({ dict }: TestimonialsProps) {
  return (
    <section className="py-16 md:py-24 bg-background border-t-2 border-border relative overflow-hidden">
      <div className="max-w-[1080px] mx-auto px-6">
        <div className="text-center mb-12">
          <div className="inline-flex font-bold text-[13px] bg-main border-2 border-border rounded-full px-4 py-1.5 shadow-[2px_2px_0_var(--border)] mb-5 text-foreground">
            {dict.tag}
          </div>

          <h2 className="font-heading font-extrabold text-[clamp(28px,4vw,44px)] leading-[1.15] tracking-[-1px] mb-4 max-w-[600px] mx-auto">
            {dict.heading.split(dict.highlightedWord)[0]}
            <em className="not-italic bg-main rounded-md px-2 inline decoration-clone">
              {dict.highlightedWord}
            </em>
            {dict.heading.split(dict.highlightedWord)[1]}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {dict.items.map((item, i) => {
            const color = cardColors[i % cardColors.length]!;
            return (
              <div
                key={item.name}
                className="bg-white border-2 border-border rounded-xl p-7 shadow-shadow flex flex-col"
              >
                <Quote
                  size={28}
                  strokeWidth={2}
                  className={`${color.quote} mb-4`}
                />
                <p className="text-[15px] text-foreground/70 leading-relaxed mb-6 flex-1">
                  {item.quote}
                </p>
                <div className="border-t-2 border-border/20 pt-4 flex items-center gap-3 mt-auto">
                  <div className={`w-10 h-10 ${color.avatar} border-2 border-border rounded-full flex items-center justify-center font-heading font-bold text-sm text-white shrink-0`}>
                    {item.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-[14px]">{item.name}</div>
                    <div className="text-[13px] text-foreground/50 font-medium">
                      {item.detail}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
