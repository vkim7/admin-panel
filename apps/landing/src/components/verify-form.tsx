"use client";

import { useActionState, useState, useEffect, useRef } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}
import type { Dictionary } from "@/lib/i18n";
import {
  requestPhoneCode,
  verifyPhoneCode,
  submitVerifiedLead,
  type RequestCodeState,
  type VerifyCodeState,
  type SubmitVerifiedLeadState,
} from "@/app/[lang]/verify/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Turnstile } from "@/components/turnstile";

interface VerifyFormProps {
  dict: Dictionary["verify"];
  locale: string;
}

export function VerifyForm({ dict, locale }: VerifyFormProps) {
  type Step = "details" | "code" | "done";

  const [step, setStep] = useState<Step>("details");
  const [phone, setPhone] = useState<string>(""); // full E.164 once captured
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const eventIdRef = useRef<string>("");

  // ─── Step 1: request code ────────────────────────────────────────────────
  const [requestState, requestAction, requestPending] = useActionState<
    RequestCodeState,
    FormData
  >(async (_prev, formData) => {
    const localPhone = String(formData.get("phone") ?? "").replace(/\s/g, "");
    const fullPhone = `+998${localPhone}`;
    formData.set("phone", fullPhone);
    formData.set("language", locale);
    const result = await requestPhoneCode(_prev, formData);
    if (result?.ok) {
      setPhone(fullPhone);
      setFirstName(String(formData.get("firstName") ?? ""));
      setLastName(String(formData.get("lastName") ?? ""));
      setStep("code");
      setCooldown(result.cooldownSeconds);
    }
    return result;
  }, null);

  // ─── Step 2: verify code ─────────────────────────────────────────────────
  const [verifyState, verifyAction, verifyPending] = useActionState<
    VerifyCodeState,
    FormData
  >(async (_prev, formData) => {
    formData.set("phone", phone);
    const result = await verifyPhoneCode(_prev, formData);
    if (result?.ok) {
      setVerificationToken(result.verificationToken);
    }
    return result;
  }, null);

  // ─── Step 3: submit lead ─────────────────────────────────────────────────
  const [submitState, submitAction, submitPending] = useActionState<
    SubmitVerifiedLeadState,
    FormData
  >(async (_prev, formData) => {
    const eventId = crypto.randomUUID();
    eventIdRef.current = eventId;
    formData.set("eventId", eventId);
    formData.set("eventSourceUrl", window.location.href);
    formData.set("language", locale);
    formData.set("firstName", firstName);
    formData.set("lastName", lastName);
    formData.set("phone", phone);
    formData.set("verificationToken", verificationToken ?? "");
    const getCookie = (name: string) =>
      document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`)?.pop() ?? "";
    formData.set("fbc", getCookie("_fbc"));
    formData.set("fbp", getCookie("_fbp"));
    return submitVerifiedLead(_prev, formData);
  }, null);

  // Fire Pixel/CAPI event on successful (non-duplicate) submit.
  useEffect(() => {
    if (
      submitState &&
      "success" in submitState &&
      submitState.success &&
      !submitState.duplicate &&
      eventIdRef.current
    ) {
      window.fbq?.("track", "Lead", {}, { eventID: eventIdRef.current });
    }
    if (submitState && "success" in submitState && submitState.success) {
      setStep("done");
    }
  }, [submitState]);

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const requestError =
    requestState && !requestState.ok ? requestState.error : null;
  const verifyError = verifyState && !verifyState.ok ? verifyState.error : null;
  const submitError =
    submitState && "error" in submitState ? submitState.error : null;

  // ─── Done screen ─────────────────────────────────────────────────────────
  if (step === "done" && submitState && "success" in submitState && submitState.success) {
    return (
      <div className="flex flex-col items-center gap-4 max-w-md w-full">
        <div className="bg-leaf-green/20 border-2 border-leaf-green rounded-xl px-8 py-6 w-full">
          <p className="text-leaf-green font-bold text-lg text-center">
            {submitState.duplicate ? dict.duplicateSuccess : dict.success}
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
        {step === "details" ? dict.heading : dict.codeStepHeading}
      </h1>
      <p className="text-foreground/50 text-sm mb-5">
        {step === "details"
          ? dict.description
          : dict.codeStepDescription.replace("{phone}", phone)}
      </p>

      {step === "details" && (
        <form action={requestAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-bold text-foreground">{dict.firstName}</Label>
              <Input name="firstName" required defaultValue={firstName} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-bold text-foreground">{dict.lastName}</Label>
              <Input name="lastName" required defaultValue={lastName} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-bold text-foreground">{dict.phone}</Label>
            <PhoneInput required />
          </div>

          {requestError && (
            <p className="text-vermilion text-sm font-semibold">{requestError}</p>
          )}

          <Turnstile />

          <Button
            type="submit"
            size="lg"
            disabled={requestPending}
            className="w-full rounded-full text-base border-main mt-2"
          >
            {requestPending ? dict.sending : dict.sendCode}
          </Button>
          <p className="text-[11px] text-foreground/35 text-center leading-relaxed">
            {dict.consent}{" "}
            <a
              href={`/${locale}/privacy`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground/60"
            >
              {dict.consentLink}
            </a>
            .
          </p>
        </form>
      )}

      {step === "code" && (
        <>
          <form action={verifyAction} className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setStep("details");
                setVerificationToken(null);
              }}
              className="text-sm underline text-foreground/60 hover:text-foreground"
            >
              {dict.editPhone}
            </button>

            <div className="space-y-1.5">
              <Label className="text-sm font-bold text-foreground">{dict.code}</Label>
              <Input
                name="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                pattern="\d{6}"
                autoComplete="one-time-code"
                required
                disabled={verificationToken !== null}
              />
            </div>

            {verifyError && !verificationToken && (
              <p className="text-vermilion text-sm font-semibold">{verifyError}</p>
            )}

            {!verificationToken && (
              <Button
                type="submit"
                size="lg"
                disabled={verifyPending}
                className="w-full rounded-full text-base border-main mt-2"
              >
                {verifyPending ? dict.sending : dict.code}
              </Button>
            )}
          </form>

          {!verificationToken && (
            <form action={requestAction} className="mt-3">
              <input type="hidden" name="firstName" value={firstName} />
              <input type="hidden" name="lastName" value={lastName} />
              <input type="hidden" name="phone" value={phone.replace("+998", "")} />
              <button
                type="submit"
                disabled={cooldown > 0 || requestPending}
                className="text-sm underline text-foreground/60 hover:text-foreground disabled:no-underline disabled:text-foreground/30 disabled:cursor-not-allowed"
              >
                {cooldown > 0
                  ? dict.resendIn.replace("{seconds}", String(cooldown))
                  : dict.resend}
              </button>
            </form>
          )}

          {verificationToken && (
            <form action={submitAction} className="space-y-4 mt-4">
              {submitError && (
                <p className="text-vermilion text-sm font-semibold">{submitError}</p>
              )}
              <Button
                type="submit"
                size="lg"
                disabled={submitPending}
                className="w-full rounded-full text-base border-main"
              >
                {submitPending ? dict.submitting : dict.submit}
              </Button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
