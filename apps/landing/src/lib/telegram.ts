import { env } from "@/env.js";

interface LeadNotification {
  firstName: string;
  lastName: string;
  phone: string;
}

/**
 * Send a "new lead" notification to the configured Telegram group.
 *
 * Fail-quiet by design — callers invoke this from inside Next.js `after()`
 * blocks, so a lead must never fail because Telegram is unreachable. If the
 * env vars are missing this is a no-op (useful for local / preview where the
 * bot token may not be set).
 */
export async function notifyTelegramOfLead(lead: LeadNotification): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_LEAD_CHAT_ID;
  if (!token || !chatId) return;

  const text = [
    "🔔 <b>Новый лид</b>",
    "",
    `${escapeHtml(lead.firstName)} ${escapeHtml(lead.lastName)}`,
    escapeHtml(lead.phone),
  ].join("\n");

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[Telegram] sendMessage rejected: ${res.status} ${res.statusText} ${body}`,
      );
    }
  } catch (err) {
    console.error("[Telegram] sendMessage threw", err);
  }
}

/**
 * Telegram HTML mode is strict: literal `<`, `>`, `&` in user-supplied text
 * must be entity-escaped, otherwise the API rejects the whole message.
 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
