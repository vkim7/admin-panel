-- Eskiz approved our 4 lead-SMS templates. Apply the returned IDs, flip status
-- to 'service' (approved transactional), and overwrite the body with the form
-- Eskiz has on file (single-line — they stripped the paragraph breaks during
-- moderation, and we need the literal text to match or sends get rejected).
--
-- Idempotent: re-running this is a no-op. The local dev DB has already had
-- these UPDATEs applied via a one-off script; this migration is purely for
-- propagating the same state to staging / prod / any other Neon branch.

UPDATE "SmsTemplate"
SET "eskizTemplateId" = 75754,
    "status" = 'service',
    "body" = 'Assalomu alaykum, {name}! Banana School maktabiga arizangiz uchun rahmat. Tez orada sinov darsi haqida bog''lanamiz. Iltimos, +998979798808 raqamini saqlab qo''ying, qo''ng''iroqimizni o''tkazib yubormang. Yoki bizga Telegram orqali yozing: t.me/bananaschool_uz',
    "updatedAt" = NOW()
WHERE "code" = 'lead_greeting' AND "language" = 'uz';

UPDATE "SmsTemplate"
SET "eskizTemplateId" = 75755,
    "status" = 'service',
    "body" = 'Здравствуйте, {name}! Спасибо за заявку в Banana School. Скоро свяжемся по поводу пробного урока. Сохраните +998979798808, чтобы не пропустить звонок. Или напишите нам в Telegram: t.me/bananaschool_uz',
    "updatedAt" = NOW()
WHERE "code" = 'lead_greeting' AND "language" = 'ru';

UPDATE "SmsTemplate"
SET "eskizTemplateId" = 75752,
    "status" = 'service',
    "body" = 'Assalomu alaykum, {name}! Afsuski, siz bilan bog''lanolmadik. Banana School maktabiga arizangiz haqida gaplashmoqchi edik. +998979798808 raqamiga qayta qo''ng''iroq qiling yoki bizga Telegram orqali yozing: t.me/bananaschool_uz Sizdan xabar kutamiz.',
    "updatedAt" = NOW()
WHERE "code" = 'lead_callback_reminder' AND "language" = 'uz';

UPDATE "SmsTemplate"
SET "eskizTemplateId" = 75753,
    "status" = 'service',
    "body" = 'Здравствуйте, {name}! К сожалению, не дозвонились до вас. Хотели обсудить вашу заявку в Banana School. Перезвоните: +998979798808 Или напишите нам в Telegram: t.me/bananaschool_uz Будем рады общению.',
    "updatedAt" = NOW()
WHERE "code" = 'lead_callback_reminder' AND "language" = 'ru';
