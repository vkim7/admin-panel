"use client";

import { useActionState, useState, useEffect, useRef, startTransition } from "react";

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
} from "@/app/[lang]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Turnstile } from "@/components/turnstile";

type Step = "details" | "code" | "done";

interface VerifyFormProps {
  dict: Dictionary["verify"];
  locale: string;
  /**
   * When true, suppress the step-1 heading. Use when the surrounding context
   * already has a title that would duplicate the form's "Запишись на пробный
   * урок" (e.g. the main page's CTA section). Step 2's heading is always
   * shown because its content is contextual, not duplicative.
   */
  hideStep1Heading?: boolean;
}

/**
 * Decode the phone bound to a verified-phone token. Tokens are base64url-
 * encoded `verificationId|phone|expiresAt|signature`. We only need the phone
 * to gate token adoption — the server still validates the signature on submit
 * so this is *not* a security check, just a UX guard against accepting a
 * stale token from a previous (now-edited) phone.
 */
function tokenPhone(token: string): string | null {
  try {
    const padding = "=".repeat((4 - (token.length % 4)) % 4);
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/") + padding;
    const decoded = atob(b64);
    const parts = decoded.split("|");
    if (parts.length !== 4) return null;
    return parts[1] ?? null;
  } catch {
    return null;
  }
}

function PencilIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

/**
 * sessionStorage key used to preserve the user's name fields across the
 * forced page reload that editPhone triggers. Phone is intentionally left
 * out — the whole point of the reload is to let them re-enter it.
 */
const EDIT_PHONE_STATE_KEY = "verify-form:names";

export function VerifyForm({ dict, locale, hideStep1Heading }: VerifyFormProps) {
  const [step, setStep] = useState<Step>("details");
  const [phone, setPhone] = useState<string>(""); // full E.164 once captured
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  // Incremented after we restore name fields from sessionStorage so the form
  // remounts with the new defaultValues. Without the remount the Inputs
  // (uncontrolled, defaultValue-only) would stay empty even though state has
  // the restored values.
  const [formInstance, setFormInstance] = useState(0);
  // Controlled so the value survives React 19's automatic form reset that
  // happens when the form-action returns. Without this the input visibly
  // clears during the verify→submit gap.
  const [code, setCode] = useState("");
  // Set to true when Turnstile's `callback` fires with a token, false on
  // mount / error / expired. Gates step 1's submit button — without it a fast
  // user could click "Получить код" before the widget produces
  // `cf-turnstile-response`, sending an empty token and getting rejected by
  // the server with "Verification failed. Please reload the page and try
  // again." The forced reload in editPhone takes care of *stale* widgets
  // (after a remount cycle); this gate takes care of the *initial render*
  // delay that happens on every fresh page load including the post-reload.
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // The token we treat as "this session's verified phone". Sourced from
  // `verifyState.verificationToken` when it succeeds, but tracked separately so
  // editPhone can reset it without depending on useActionState (which has no
  // public reset). Without this, returning from edit-phone would leave the
  // stale `verifyState.ok` true and could re-fire the auto-submit.
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null);
  const eventIdRef = useRef<string>("");
  const lastSubmittedTokenRef = useRef<string | null>(null);

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

  // ─── Step 2: verify code (the user-visible "submit application" click) ───
  const [verifyState, verifyAction, verifyPending] = useActionState<
    VerifyCodeState,
    FormData
  >(async (_prev, formData) => {
    formData.set("phone", phone);
    return verifyPhoneCode(_prev, formData);
  }, null);

  // ─── Submit lead — fired automatically once the code is verified ─────────
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
    // verificationToken is set by the caller (auto-submit effect or retry).
    const getCookie = (name: string) =>
      document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`)?.pop() ?? "";
    formData.set("fbc", getCookie("_fbc"));
    formData.set("fbp", getCookie("_fbp"));
    return submitVerifiedLead(_prev, formData);
  }, null);

  // Accept a fresh verify-success into our own state. Sourced once per token
  // so editPhone can clear it independently of useActionState. Critically:
  // useActionState has no reset, so verifyState lingers after editPhone with
  // its old `{ok: true, verificationToken}`. If the user changes phone and
  // re-requests a code, that stale state would re-hydrate verifiedToken with
  // the OLD token (bound to the OLD phone) and the auto-submit would loop on
  // "Verification expired". Gate adoption on `tokenPhone === phone`.
  useEffect(() => {
    if (
      verifyState?.ok &&
      verifiedToken !== verifyState.verificationToken &&
      tokenPhone(verifyState.verificationToken) === phone
    ) {
      setVerifiedToken(verifyState.verificationToken);
    }
  }, [verifyState, verifiedToken, phone]);

  // Auto-trigger lead submission as soon as we accept a verified token, so the
  // user never sees a redundant "now click submit" screen. Guarded by a ref so
  // re-renders after submit completion don't re-fire.
  useEffect(() => {
    if (
      verifiedToken &&
      lastSubmittedTokenRef.current !== verifiedToken
    ) {
      lastSubmittedTokenRef.current = verifiedToken;
      const fd = new FormData();
      fd.set("verificationToken", verifiedToken);
      startTransition(() => submitAction(fd));
    }
  }, [verifiedToken, submitAction]);

  // Fire Pixel/CAPI event on successful (non-duplicate) submit. The done
  // screen visibility is derived directly from submitState below — gating it
  // on a `step === "done"` state would cause one extra render where the
  // step-2 UI flashes before the useEffect runs.
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
  }, [submitState]);

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // After an editPhone-triggered page reload, restore the name fields from
  // sessionStorage so the user only has to re-enter the phone (the reason
  // they clicked edit). Bumping `formInstance` forces the step-1 form to
  // remount so its defaultValue-driven Inputs pick up the restored state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(EDIT_PHONE_STATE_KEY);
    } catch {
      return;
    }
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      if (typeof data.firstName === "string") setFirstName(data.firstName);
      if (typeof data.lastName === "string") setLastName(data.lastName);
      setFormInstance((n) => n + 1);
    } catch {
      // Bad JSON — discard
    }
    try {
      sessionStorage.removeItem(EDIT_PHONE_STATE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const requestError =
    requestState && !requestState.ok ? requestState.error : null;
  const verifyError = verifyState && !verifyState.ok ? verifyState.error : null;
  const submitError =
    submitState && "error" in submitState ? submitState.error : null;

  const codeVerified = verifiedToken !== null;
  // Treat "verify returned ok but submit hasn't started yet" as still pending,
  // so the button stays in "Submitting…" state across the brief render gap
  // between the verifyAction returning and the auto-submit useEffect firing.
  // Without this the button flickers back to "Отправить заявку" enabled for a
  // single render before the auto-submit kicks in.
  const submitFired = submitState !== null;
  const codeStepPending =
    verifyPending || submitPending || (verifyState?.ok === true && !submitFired);
  const codeStepError = verifyError ?? submitError;

  // Retry submit when verify succeeded but lead creation failed (network blip,
  // etc.). The accepted token is still valid (15 min).
  const retrySubmit = () => {
    if (!verifiedToken) return;
    const fd = new FormData();
    fd.set("verificationToken", verifiedToken);
    startTransition(() => submitAction(fd));
  };

  const editPhone = () => {
    // Save the name fields and force a full page reload. Cloudflare Turnstile
    // doesn't reliably refresh its widget across React unmount/remount cycles —
    // a hard reload is the only way to guarantee a fresh widget + token for
    // the next submission. The mount-time effect above restores the names
    // from sessionStorage so the user only has to re-enter the phone.
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(
          EDIT_PHONE_STATE_KEY,
          JSON.stringify({ firstName, lastName }),
        );
      } catch {
        // Storage unavailable (private mode etc.) — proceed without restore
      }
      window.location.reload();
    }
  };

  // Split the localized "we sent a code to {phone}." string around the
  // {phone} placeholder so we can render the inline pencil button right
  // after the phone number, regardless of where {phone} sits in the sentence
  // (RU has it mid-sentence, UZ has it at the start).
  const [descBefore, descAfter] = dict.codeStepDescription.split("{phone}");

  // ─── Done screen ─────────────────────────────────────────────────────────
  // Gated only on submitState (not `step === "done"`) so the screen appears in
  // the same render where submit returns success — gating on step would leave
  // one render with codeVerified=true and submit done but step still "code",
  // showing the step-2 UI with a disabled "Отправить заявку" button.
  if (submitState && "success" in submitState && submitState.success) {
    return (
      <div className="flex flex-col items-center gap-4 w-full">
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
    <div className="bg-white rounded-2xl border-2 border-border shadow-[6px_6px_0_var(--border)] p-6 md:p-8 w-full">
      {!(step === "details" && hideStep1Heading) && (
        <h1 className="font-heading font-black text-xl text-foreground tracking-tight mb-1">
          {step === "details" ? dict.heading : dict.codeStepHeading}
        </h1>
      )}
      {step === "details" ? (
        <p className="text-foreground/50 text-sm mb-5">{dict.description}</p>
      ) : (
        <p className="text-foreground/50 text-sm mb-5">
          {descBefore}
          <span className="font-semibold text-foreground/80">{phone}</span>
          <button
            type="button"
            onClick={editPhone}
            aria-label={dict.editPhone}
            className="ml-1.5 inline-block align-[-2px] text-blue-500 hover:text-blue-600 transition-colors"
          >
            <PencilIcon size={16} />
          </button>
          {descAfter}
        </p>
      )}

      {step === "details" && (
        <form key={formInstance} action={requestAction} className="space-y-4">
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
            <PhoneInput required defaultValue={phone.replace(/^\+998/, "")} />
          </div>

          {requestError && (
            <p className="text-vermilion text-sm font-semibold">{requestError}</p>
          )}

          <Turnstile onReady={setTurnstileReady} />

          <Button
            type="submit"
            size="lg"
            disabled={requestPending || !turnstileReady}
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
        <div className="space-y-4">
          <form action={verifyAction} className="space-y-4">
            <Input
              name="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              pattern="\d{6}"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={codeVerified}
              aria-label={dict.code}
            />

            {codeStepError && (
              <p className="text-vermilion text-sm font-semibold">{codeStepError}</p>
            )}

            {/* Single button does verify + auto-submit. Stays in loading state
                across both server calls so the user sees one continuous flow. */}
            {!(codeVerified && submitError) ? (
              <Button
                type="submit"
                size="lg"
                disabled={codeStepPending || codeVerified}
                className="w-full rounded-full text-base border-main mt-2"
              >
                {codeStepPending ? dict.submitting : dict.submit}
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                onClick={retrySubmit}
                disabled={submitPending}
                className="w-full rounded-full text-base border-main mt-2"
              >
                {submitPending ? dict.submitting : dict.submit}
              </Button>
            )}
          </form>

          {!codeVerified && (
            <form action={requestAction} className="text-center">
              <input type="hidden" name="firstName" value={firstName} />
              <input type="hidden" name="lastName" value={lastName} />
              <input type="hidden" name="phone" value={phone.replace("+998", "")} />
              <p className="text-sm text-foreground/50">
                {dict.resendPrompt}{" "}
                <button
                  type="submit"
                  disabled={cooldown > 0 || requestPending}
                  className="text-blue-500 underline underline-offset-2 hover:text-blue-600 font-semibold transition-colors disabled:no-underline disabled:text-foreground/30 disabled:cursor-not-allowed"
                >
                  {cooldown > 0
                    ? dict.resendIn.replace("{seconds}", String(cooldown))
                    : dict.resend}
                </button>
              </p>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
