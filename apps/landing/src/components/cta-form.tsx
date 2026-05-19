"use client";

import { useActionState, useState, useEffect, useRef } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}
import { MessageCircle, Phone } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { submitLead } from "@/app/[lang]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface CtaFormProps {
  dict: Dictionary["form"];
  locale: string;
}

function PillGroup({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: Record<string, string>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
      {Object.entries(options).map(([k, label]) => (
        <label key={k} className="cursor-pointer block h-full md:inline md:h-auto">
          <input
            type="radio"
            name={name}
            value={k}
            checked={value === k}
            onChange={() => onChange(k)}
            className="sr-only"
          />
          <div
            className={cn(
              "px-4 py-2 text-sm font-bold rounded-full border-2 transition-all text-center h-full flex items-center justify-center md:h-auto md:block md:whitespace-nowrap",
              value === k
                ? "bg-main text-foreground border-border shadow-[2px_2px_0_var(--border)]"
                : "bg-secondary-background text-foreground/70 border-border hover:bg-background",
            )}
          >
            {label}
          </div>
        </label>
      ))}
    </div>
  );
}

export function CtaForm({ dict, locale }: CtaFormProps) {
  const [lessonPreference, setLessonPreference] = useState("GROUP");
  const [selfAssessedLevel, setSelfAssessedLevel] = useState("COMPLETE_BEGINNER");
  const eventIdRef = useRef<string>("");

  const [state, formAction, isPending] = useActionState(
    async (_prevState: { success?: boolean; error?: string } | null, formData: FormData) => {
      const eventId = crypto.randomUUID();
      eventIdRef.current = eventId;
      formData.set("eventId", eventId);
      formData.set("eventSourceUrl", window.location.href);
      const getCookie = (name: string) =>
        document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`)?.pop() ?? "";
      formData.set("fbc", getCookie("_fbc"));
      formData.set("fbp", getCookie("_fbp"));
      formData.set("language", locale);
      const phone = formData.get("phone");
      if (typeof phone === "string") {
        formData.set("phone", `+998${phone.replace(/\s/g, "")}`);
      }
      return submitLead(_prevState, formData);
    },
    null,
  );

  useEffect(() => {
    if (state?.success && eventIdRef.current) {
      window.fbq?.("track", "Lead", {}, { eventID: eventIdRef.current });
    }
  }, [state?.success]);

  if (state?.success) {
    return (
      <section id="cta" className="py-16 md:py-24 bg-background border-t-2 border-border relative overflow-hidden">
        <div className="max-w-[1080px] mx-auto px-6 flex items-center justify-center min-h-[400px]">
          <div className="bg-leaf-green/20 border-2 border-leaf-green rounded-xl px-8 py-6 max-w-md mx-auto">
            <p className="text-leaf-green font-bold text-lg text-center">{dict.success}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="cta" className="py-16 md:py-24 bg-background border-t-2 border-border relative overflow-hidden">
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
          <div className="bg-white rounded-2xl border-2 border-border shadow-[6px_6px_0_var(--border)] p-6 md:p-8 md:col-start-2 md:row-start-1 md:row-span-2">
            <form action={formAction} className="space-y-4">
              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-foreground">{dict.firstName}</Label>
                  <Input name="firstName" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold text-foreground">{dict.lastName}</Label>
                  <Input name="lastName" required />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-foreground">{dict.phone}</Label>
                <PhoneInput required />
              </div>

              {/* Lesson format pills */}
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-bold text-foreground">{dict.lessonPreference}</Label>
                <PillGroup
                  name="lessonPreference"
                  options={dict.lessonPreferenceOptions}
                  value={lessonPreference}
                  onChange={setLessonPreference}
                />
              </div>

              {/* Level pills */}
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-bold text-foreground">{dict.selfAssessedLevel}</Label>
                <PillGroup
                  name="selfAssessedLevel"
                  options={dict.selfAssessedLevelOptions}
                  value={selfAssessedLevel}
                  onChange={setSelfAssessedLevel}
                />
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <Label className="text-sm font-bold text-foreground">{dict.note}</Label>
                <Textarea name="note" rows={2} />
              </div>

              {/* Error */}
              {state?.error && (
                <p className="text-vermilion text-sm font-semibold">{dict.error}</p>
              )}

              {/* Submit */}
              <Button
                type="submit"
                size="lg"
                disabled={isPending}
                className="w-full rounded-full text-base border-main mt-2"
              >
                {isPending ? "..." : dict.submit}
              </Button>
              <p className="text-[11px] text-foreground/35 text-center leading-relaxed">
                {locale === "ru" ? (
                  <>
                    Нажимая «Отправить», вы принимаете нашу{" "}
                    <a href={`/${locale}/privacy`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground/60">
                      политику конфиденциальности
                    </a>
                    .
                  </>
                ) : (
                  <>
                    Yuborish orqali siz{" "}
                    <a href={`/${locale}/privacy`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground/60">
                      maxfiylik siyosatimiz
                    </a>
                    {" "}bilan rozisiz.
                  </>
                )}
              </p>
            </form>
          </div>

          {/* OR + contacts — mobile: 3rd, desktop: col 1 row 2 */}
          <div className="md:col-start-1 md:row-start-2">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-px flex-1 bg-border" />
              <span className="text-sm font-bold text-foreground/30 uppercase">{dict.or}</span>
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
                <span className="text-[15px] font-bold text-foreground group-hover:underline">Telegram</span>
              </a>
              <a
                href="tel:+998979798808"
                className="flex items-center gap-3 group"
              >
                <div className="w-10 h-10 bg-leaf-green-bg border-2 border-border rounded-full shadow-[2px_2px_0_var(--border)] flex items-center justify-center text-foreground transition-all group-hover:shadow-none group-hover:translate-x-[2px] group-hover:translate-y-[2px]">
                  <Phone size={18} strokeWidth={2.5} />
                </div>
                <span className="text-[15px] font-bold text-foreground group-hover:underline">+998 97 979 88 08</span>
              </a>
              <a
                href="https://www.instagram.com/bananaschool.uz/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 group"
              >
                <div className="w-10 h-10 bg-purple-bg border-2 border-border rounded-full shadow-[2px_2px_0_var(--border)] flex items-center justify-center text-foreground transition-all group-hover:shadow-none group-hover:translate-x-[2px] group-hover:translate-y-[2px]">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" /><circle cx="12" cy="12" r="5" /><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" /></svg>
                </div>
                <span className="text-[15px] font-bold text-foreground group-hover:underline">@bananaschool.uz</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
