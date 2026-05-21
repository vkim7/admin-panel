"use client";

import { useActionState, useState, useEffect, useRef } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}
import type { Dictionary } from "@/lib/i18n";
import { submitLead } from "@/app/[lang]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface StandaloneFormProps {
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
    <div className="flex flex-wrap gap-2">
      {Object.entries(options).map(([k, label]) => (
        <label key={k} className="cursor-pointer">
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
              "px-4 py-2 text-sm font-bold rounded-full border-2 transition-all whitespace-nowrap",
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

export function StandaloneForm({ dict, locale }: StandaloneFormProps) {
  const [lessonPreference, setLessonPreference] = useState("GROUP");
  const [selfAssessedLevel, setSelfAssessedLevel] = useState("COMPLETE_BEGINNER");
  const eventIdRef = useRef<string>("");

  const [state, formAction, isPending] = useActionState(
    async (
      _prevState: { success?: boolean; duplicate?: boolean; error?: string } | null,
      formData: FormData,
    ) => {
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
    // Suppress the Pixel/CAPI Lead event on resubmits — same person, not a
    // new conversion. (Server also skips the CAPI ping in that branch.)
    if (state?.success && !state.duplicate && eventIdRef.current) {
      window.fbq?.("track", "Lead", {}, { eventID: eventIdRef.current });
    }
  }, [state?.success, state?.duplicate]);

  if (state?.success) {
    return (
      <div className="flex flex-col items-center gap-4 max-w-md w-full">
        <div className="bg-leaf-green/20 border-2 border-leaf-green rounded-xl px-8 py-6 w-full">
          <p className="text-leaf-green font-bold text-lg text-center">
            {state.duplicate ? dict.duplicateSuccess : dict.success}
          </p>
        </div>
        <Button asChild size="lg" className="rounded-full text-base border-main">
          <a href={`/${locale}`}>{dict.successCta}</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-border shadow-[6px_6px_0_var(--border)] p-6 md:p-8 w-full max-w-md">
      <h1 className="font-heading font-black text-xl text-foreground tracking-tight mb-1">
        {dict.heading}
      </h1>
      <p className="text-foreground/50 text-sm mb-5">{dict.description}</p>

      <form action={formAction} className="space-y-4">
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

        <div className="space-y-1.5">
          <Label className="text-sm font-bold text-foreground">{dict.phone}</Label>
          <PhoneInput required />
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-bold text-foreground">{dict.lessonPreference}</Label>
          <PillGroup
            name="lessonPreference"
            options={dict.lessonPreferenceOptions}
            value={lessonPreference}
            onChange={setLessonPreference}
          />
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-bold text-foreground">{dict.selfAssessedLevel}</Label>
          <PillGroup
            name="selfAssessedLevel"
            options={dict.selfAssessedLevelOptions}
            value={selfAssessedLevel}
            onChange={setSelfAssessedLevel}
          />
        </div>

        {state?.error && (
          <p className="text-vermilion text-sm font-semibold">{dict.error}</p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="w-full rounded-full text-base border-main mt-2"
        >
          {isPending ? "..." : dict.submit}
        </Button>
      </form>
    </div>
  );
}
