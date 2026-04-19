"use client";

import { useActionState, useState } from "react";
import type { Dictionary } from "@/lib/i18n";
import { submitLead } from "@/app/[lang]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface CtaFormProps {
  dict: Dictionary["form"];
  locale: string;
}

export function CtaForm({ dict, locale }: CtaFormProps) {
  const [lessonPreference, setLessonPreference] = useState("");
  const [selfAssessedLevel, setSelfAssessedLevel] = useState("");

  const [state, formAction, isPending] = useActionState(
    async (_prevState: { success?: boolean; error?: string } | null, formData: FormData) => {
      formData.set("language", locale);
      // Prepend +998 to the phone number
      const phone = formData.get("phone");
      if (typeof phone === "string") {
        formData.set("phone", `+998${phone.replace(/\s/g, "")}`);
      }
      return submitLead(_prevState, formData);
    },
    null,
  );

  if (state?.success) {
    return (
      <section id="cta" className="py-16 md:py-24 bg-foreground border-t-2 border-border relative overflow-hidden">
        <div
          className="absolute -top-1/2 -left-[20%] w-[140%] h-[200%] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 100%, rgba(255,227,71,0.12) 0%, transparent 60%)",
          }}
        />
        <div className="max-w-[1080px] mx-auto px-6 relative z-10 text-center">
          <img
            src="/logo_cropped_yellow.svg"
            alt="Banana School"
            className="w-[120px] mx-auto mb-8 opacity-90"
          />
          <div className="bg-leaf-green/20 border-2 border-leaf-green rounded-xl px-8 py-6 max-w-md mx-auto">
            <p className="text-leaf-green font-bold text-lg">{dict.success}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="cta" className="py-16 md:py-24 bg-foreground border-t-2 border-border relative overflow-hidden">
      {/* Radial gradient overlay */}
      <div
        className="absolute -top-1/2 -left-[20%] w-[140%] h-[200%] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(255,227,71,0.12) 0%, transparent 60%)",
        }}
      />

      <div className="max-w-[1080px] mx-auto px-6 relative z-10">
        <div className="text-center mb-10">
          <img
            src="/logo_cropped_yellow.svg"
            alt="Banana School"
            className="w-[120px] mx-auto mb-8 opacity-90"
          />
          <h2 className="font-heading font-black text-[clamp(32px,5vw,52px)] text-white tracking-[-1.5px] leading-[1.1] mb-4">
            {dict.heading}
          </h2>
          <p className="text-[#999] text-[17px] max-w-[440px] mx-auto">
            {dict.description}
          </p>
        </div>

        <form
          action={formAction}
          className="max-w-md mx-auto space-y-5"
        >
          {/* First name */}
          <div className="space-y-2">
            <Label className="text-white">{dict.firstName}</Label>
            <Input
              name="firstName"
              placeholder={dict.firstNamePlaceholder}
              required
            />
          </div>

          {/* Last name */}
          <div className="space-y-2">
            <Label className="text-white">{dict.lastName}</Label>
            <Input
              name="lastName"
              placeholder={dict.lastNamePlaceholder}
              required
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label className="text-white">{dict.phone}</Label>
            <div className="flex">
              <div className="flex items-center px-3 bg-secondary-background border-2 border-r-0 border-border rounded-l-base text-sm font-bold text-foreground">
                +998
              </div>
              <Input
                name="phone"
                type="tel"
                placeholder="90 123 45 67"
                required
                className="rounded-l-none"
              />
            </div>
          </div>

          {/* Date of birth */}
          <div className="space-y-2">
            <Label className="text-white">{dict.dateOfBirth}</Label>
            <Input name="dateOfBirth" type="date" />
          </div>

          {/* Lesson preference - chunky toggle buttons */}
          <div className="space-y-2">
            <Label className="text-white">{dict.lessonPreference}</Label>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(dict.lessonPreferenceOptions).map(([value, label]) => (
                <label key={value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="lessonPreference"
                    value={value}
                    checked={lessonPreference === value}
                    onChange={() => setLessonPreference(value)}
                    className="sr-only"
                  />
                  <div
                    className={cn(
                      "px-4 py-3 text-sm font-bold text-center border-2 border-border rounded-base transition-all",
                      lessonPreference === value
                        ? "bg-main text-foreground shadow-[2px_2px_0_var(--border)]"
                        : "bg-secondary-background text-foreground/70 hover:bg-background",
                    )}
                  >
                    {label}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Self-assessed level - chunky toggle buttons */}
          <div className="space-y-2">
            <Label className="text-white">{dict.selfAssessedLevel}</Label>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(dict.selfAssessedLevelOptions).map(([value, label]) => (
                <label key={value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="selfAssessedLevel"
                    value={value}
                    checked={selfAssessedLevel === value}
                    onChange={() => setSelfAssessedLevel(value)}
                    className="sr-only"
                  />
                  <div
                    className={cn(
                      "px-4 py-3 text-sm font-bold text-center border-2 border-border rounded-base transition-all",
                      selfAssessedLevel === value
                        ? "bg-main text-foreground shadow-[2px_2px_0_var(--border)]"
                        : "bg-secondary-background text-foreground/70 hover:bg-background",
                    )}
                  >
                    {label}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label className="text-white">{dict.note}</Label>
            <Textarea
              name="note"
              placeholder={dict.notePlaceholder}
              rows={3}
            />
          </div>

          {/* Error message */}
          {state?.error && (
            <p className="text-vermilion text-sm font-semibold">{dict.error}</p>
          )}

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            disabled={isPending}
            className="w-full rounded-full text-base border-main"
          >
            {isPending ? "..." : dict.submit}
          </Button>
        </form>
      </div>
    </section>
  );
}
