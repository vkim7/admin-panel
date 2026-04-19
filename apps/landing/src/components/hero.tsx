import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

interface HeroProps {
  dict: Dictionary["hero"];
  locale: string;
}

export function Hero({ dict, locale }: HeroProps) {
  // Split headline around the highlighted word
  const parts = dict.headline.split(dict.highlightedWord);
  const before = parts[0] ?? "";
  const after = parts[1] ?? "";

  return (
    <section className="relative overflow-hidden pt-24 pb-20 md:pt-[100px] md:pb-20 text-center">
      {/* Radial gradient background */}
      <div
        className="absolute -top-1/2 -left-[20%] w-[140%] h-[200%] pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, #FFF8DC 0%, transparent 60%)",
        }}
      />

      <div className="max-w-[1080px] mx-auto px-6 relative z-10">
        {/* Pill badge */}
        <div className="inline-flex items-center gap-2 font-bold text-sm bg-main border-2 border-border rounded-full px-5 py-2 shadow-[3px_3px_0_var(--border)] mb-8 text-foreground">
          {dict.pill} &rarr;
        </div>

        {/* Headline */}
        <h1 className="font-heading font-black text-[clamp(40px,6.5vw,72px)] leading-[1.08] tracking-[-2px] max-w-[720px] mx-auto mb-6 text-foreground">
          {before}
          <em className="not-italic bg-main rounded-md px-2 inline decoration-clone">
            {dict.highlightedWord}
          </em>
          {after}
        </h1>

        {/* Subheadline */}
        <p className="text-[19px] text-foreground/60 max-w-[520px] mx-auto mb-10 leading-relaxed font-medium">
          {dict.subheadline}
        </p>

        {/* CTA Buttons */}
        <div className="flex gap-3 justify-center flex-wrap">
          <Button asChild size="lg" className="rounded-full px-8 py-3.5 text-base">
            <Link href={`/${locale}#cta`}>{dict.ctaPrimary}</Link>
          </Button>
          <Button asChild variant="neutral" size="lg" className="rounded-full px-8 py-3.5 text-base">
            <Link href={`/${locale}#pricing`}>{dict.ctaSecondary}</Link>
          </Button>
        </div>

        {/* Social link */}
        <div className="mt-12 flex items-center justify-center gap-6 text-foreground/60 text-sm font-semibold">
          <span>{dict.followUs}</span>
          <a
            href="https://www.instagram.com/bananaschool.uz/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground font-bold inline-flex items-center gap-1 border-b-2 border-main hover:border-foreground transition-colors"
          >
            @bananaschool.uz
          </a>
        </div>
      </div>
    </section>
  );
}
