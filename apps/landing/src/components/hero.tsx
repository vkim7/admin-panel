import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

interface HeroProps {
  dict: Dictionary["hero"];
  cta: string;
  locale: string;
}

const emojis = ["🌍", "🎥", "📱"];
const emojiBg = ["bg-main", "bg-leaf-green-bg", "bg-sky-blue-bg"];

export function Hero({ dict, cta, locale }: HeroProps) {
  const parts = dict.headline.split(dict.highlightedWord);
  const before = parts[0] ?? "";
  const after = parts[1] ?? "";

  return (
    <section className="pt-24 pb-16 md:pt-[100px] md:pb-20">
      <div className="max-w-[1080px] mx-auto px-6 text-center">
        {/* Pill badge */}
        <div className="inline-flex items-center gap-2 font-bold text-sm bg-main border-2 border-border rounded-full px-5 py-2 shadow-[3px_3px_0_var(--border)] mb-8 text-foreground">
          {dict.pill}
        </div>

        {/* Headline */}
        <h1 className="font-heading font-black text-[clamp(40px,6.5vw,72px)] leading-[1.08] tracking-[-2px] max-w-[720px] mx-auto mb-6 text-foreground">
          {before}
          <em className="not-italic bg-main rounded-md px-2 inline decoration-clone">
            {dict.highlightedWord}
          </em>
          {after}
        </h1>

        {/* Feature items */}
        <div className="max-w-[480px] mx-auto mt-12 text-left">
          {dict.items.map((item, i) => (
            <div
              key={item}
              className={`flex items-center gap-4 py-5 ${i > 0 ? "border-t border-border/20" : ""}`}
            >
              <div className={`w-11 h-11 ${emojiBg[i % emojiBg.length]} border-2 border-border rounded-lg flex items-center justify-center shrink-0 text-xl`}>
                {emojis[i % emojis.length]}
              </div>
              <span className="font-heading font-bold text-[17px]">
                {item}
              </span>
            </div>
          ))}
        </div>

        {/* CTA — mobile only */}
        <div className="mt-10 md:hidden">
          <Button asChild size="lg" className="rounded-full text-base shadow-[3px_3px_0_var(--border)] hover:shadow-[5px_5px_0_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px]">
            <Link href={`/${locale}#cta`}>{cta}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
