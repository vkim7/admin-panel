/**
 * Raw Eskiz HTTP client. No DB writes, no business logic — just pure transport.
 * Authentication is the caller's responsibility (auth.ts handles token caching).
 *
 * Endpoints documented in eskiz.md at the repo root.
 */

const ESKIZ_BASE_URL = "https://notify.eskiz.uz";

export class EskizError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(message);
    this.name = "EskizError";
  }
}

interface LoginResponse {
  message: string;
  data: { token: string };
  token_type: string;
}

/**
 * POST /api/auth/login — exchange email + password for a JWT.
 * Eskiz docs say the JWT lives 30 days.
 */
export async function login({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<{ token: string }> {
  const body = new FormData();
  body.set("email", email);
  body.set("password", password);

  const res = await fetch(`${ESKIZ_BASE_URL}/api/auth/login`, {
    method: "POST",
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new EskizError(
      `Eskiz login failed: ${res.status} ${res.statusText}`,
      res.status,
      text,
    );
  }
  const json = JSON.parse(text) as LoginResponse;
  if (!json.data?.token) {
    throw new EskizError(
      "Eskiz login response missing data.token",
      res.status,
      text,
    );
  }
  return { token: json.data.token };
}

/**
 * PATCH /api/auth/refresh — extend an existing JWT before it expires.
 * Eskiz Bearer-auths this with the soon-to-expire token.
 */
export async function refresh(token: string): Promise<{ token: string }> {
  const res = await fetch(`${ESKIZ_BASE_URL}/api/auth/refresh`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new EskizError(
      `Eskiz refresh failed: ${res.status} ${res.statusText}`,
      res.status,
      text,
    );
  }
  const json = JSON.parse(text) as LoginResponse;
  if (!json.data?.token) {
    throw new EskizError(
      "Eskiz refresh response missing data.token",
      res.status,
      text,
    );
  }
  return { token: json.data.token };
}

export interface SendSmsRequest {
  token: string;
  /** Phone in Eskiz format (no +, e.g. "998979798808") */
  mobilePhone: string;
  message: string;
  /** Sender nickname (registered with Eskiz). Default "4546" until approved. */
  from: string;
  /** Optional webhook URL Eskiz POSTs status updates to. */
  callbackUrl?: string;
  /** Our correlation ID so we can match callback → SmsHistory row. */
  userSmsId?: string;
}

export interface SendSmsResponse {
  /** UUID Eskiz returns synchronously — this becomes SmsHistory.eskizRequestId */
  id: string;
  /** Eskiz's pipeline state at acceptance (e.g. "waiting") */
  status: string;
  /** Human-readable accept message */
  message: string;
}

/**
 * POST /api/message/sms/send — send a single SMS.
 *
 * The returned `id` (UUID) is the `request_id` that arrives in delivery
 * callbacks. We store it as SmsHistory.eskizRequestId so the webhook can
 * look up the row.
 */
export async function sendSms(req: SendSmsRequest): Promise<SendSmsResponse> {
  const body = new FormData();
  body.set("mobile_phone", req.mobilePhone);
  body.set("message", req.message);
  body.set("from", req.from);
  if (req.callbackUrl) body.set("callback_url", req.callbackUrl);
  if (req.userSmsId) body.set("user_sms_id", req.userSmsId);

  const res = await fetch(`${ESKIZ_BASE_URL}/api/message/sms/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${req.token}` },
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new EskizError(
      `Eskiz send failed: ${res.status} ${res.statusText}`,
      res.status,
      text,
    );
  }
  const json = JSON.parse(text) as SendSmsResponse;
  if (!json.id) {
    throw new EskizError(
      "Eskiz send response missing id",
      res.status,
      text,
    );
  }
  return json;
}
