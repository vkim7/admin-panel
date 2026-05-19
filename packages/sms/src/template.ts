import { prisma } from "@eng/database";
import type { SmsLanguage, TemplateCode, TemplateVariables } from "./types";

/**
 * Render a template body by substituting `{name}` (and any future placeholders)
 * with the provided variables. Trailing whitespace is left alone — Eskiz
 * preserves it through moderation, and we want SMS to land verbatim.
 *
 * Unknown placeholders are left in place rather than throwing, so a misspelled
 * variable degrades to a visible "{Name}" in the SMS rather than failing the
 * send silently.
 */
export function render(body: string, variables: TemplateVariables): string {
  return body.replace(/\{name\}/g, variables.name);
}

export interface LoadedTemplate {
  id: string;
  code: TemplateCode;
  language: SmsLanguage;
  body: string;
  eskizTemplateId: number | null;
  status: string;
  isActive: boolean;
}

/**
 * Look up the SmsTemplate row for a given (code, language). Returns null if
 * the template doesn't exist or isn't active.
 *
 * Production sends additionally need eskizTemplateId !== null (the template
 * must be approved by Eskiz); the funnel in send.ts checks for that.
 */
export async function loadTemplate({
  code,
  language,
}: {
  code: TemplateCode;
  language: SmsLanguage;
}): Promise<LoadedTemplate | null> {
  const row = await prisma.smsTemplate.findUnique({
    where: { code_language: { code, language } },
  });
  if (!row || !row.isActive) return null;
  return {
    id: row.id,
    code: row.code as TemplateCode,
    language: row.language as SmsLanguage,
    body: row.body,
    eskizTemplateId: row.eskizTemplateId,
    status: row.status,
    isActive: row.isActive,
  };
}
