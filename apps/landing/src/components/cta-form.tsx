import { MessageCircle, Phone } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { VerifyForm } from "@/components/verify-form";

interface CtaFormProps {
  dict: Dictionary["form"];
  /** Verify-flow strings — separate from the marketing copy in dict.form. */
  verifyDict: Dictionary["verify"];
  locale: string;
}

/**
 * Marketing-side CTA section. The surrounding heading, description, and
 * contact links live here; the actual form is the standalone `VerifyForm`
 * (phone-OTP verified) embedded into the second grid column.
 */
export function CtaForm({ dict, verifyDict, locale }: CtaFormProps) {
  return (
    <section
      id="cta"
      className="py-16 md:py-24 bg-background border-t-2 border-border relative overflow-hidden"
    >
      <div className="max-w-[1080px] mx-auto px-6">
        <div className="grid gap-10 md:grid-cols-[1fr_1.2fr] md:gap-x-16 md:gap-y-10 md:items-start">
          {/* Heading + description — mobile: 1st, desktop: col 1 row 1 */}
          <div className="md:col-start-1 md:row-start-1">
            <div className="inline-flex font-bold text-[13px] bg-main border-2 border-border rounded-full px-4 py-1.5 shadow-[2px_2px_0_var(--border)] mb-5 text-foreground">
              {dict.tag}
            </div>
            <h2 className="font-heading font-black text-[clamp(28px,4vw,44px)] text-foreground tracking-[-1.5px] leading-[1.1] mb-6">
              {dict.heading}
            </h2>

            <p className="text-foreground/50 text-[15px] leading-relaxed">
              {dict.description}
            </p>
          </div>

          {/* Form — mobile: 2nd, desktop: col 2 spanning both rows */}
          <div className="md:col-start-2 md:row-start-1 md:row-span-2">
            <VerifyForm dict={verifyDict} locale={locale} hideStep1Heading />
          </div>

          {/* OR + contacts — mobile: 3rd, desktop: col 1 row 2 */}
          <div className="md:col-start-1 md:row-start-2">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-px flex-1 bg-border" />
              <span className="text-sm font-bold text-foreground/30 uppercase">
                {dict.or}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-3">
              <a
                href="https://t.me/bananaschool_uz"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 group"
              >
                <div className="w-10 h-10 bg-sky-blue-bg border-2 border-border rounded-full shadow-[2px_2px_0_var(--border)] flex items-center justify-center text-foreground transition-all group-hover:shadow-none group-hover:translate-x-[2px] group-hover:translate-y-[2px]">
                  <MessageCircle size={18} strokeWidth={2.5} />
                </div>
                <span className="text-[15px] font-bold text-foreground group-hover:underline">
                  Telegram
                </span>
              </a>
              <a href="tel:+998979798808" className="flex items-center gap-3 group">
                <div className="w-10 h-10 bg-leaf-green-bg border-2 border-border rounded-full shadow-[2px_2px_0_var(--border)] flex items-center justify-center text-foreground transition-all group-hover:shadow-none group-hover:translate-x-[2px] group-hover:translate-y-[2px]">
                  <Phone size={18} strokeWidth={2.5} />
                </div>
                <span className="text-[15px] font-bold text-foreground group-hover:underline">
                  +998 97 979 88 08
                </span>
              </a>
              <a
                href="https://www.instagram.com/bananaschool.uz/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 group"
              >
                <div className="w-10 h-10 bg-purple-bg border-2 border-border rounded-full shadow-[2px_2px_0_var(--border)] flex items-center justify-center text-foreground transition-all group-hover:shadow-none group-hover:translate-x-[2px] group-hover:translate-y-[2px]">
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="20" height="20" x="2" y="2" rx="5" />
                    <circle cx="12" cy="12" r="5" />
                    <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
                  </svg>
                </div>
                <span className="text-[15px] font-bold text-foreground group-hover:underline">
                  @bananaschool.uz
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
