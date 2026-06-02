RU:
Banana School: код подтверждения для отправки заявки: 123456

UZ:
Banana School maktabiga arizani yuborish uchun tasdiqlash kodi: 123456

<!-- TODO -->

# Eskiz SMS templates — ready to submit

All four strings below go to the **Eskiz dashboard → Templates → Add template**, category **`service`** (transactional, not promotional).

Submit each string **exactly as written**, including line breaks, with `Aziz` / `Азиз` baked in as the moderation sample name. At runtime our code substitutes the real lead's first name for that token — Eskiz only moderates the static skeleton.

When pasting into the Eskiz dashboard, preserve the line breaks (just hit Enter at each break). They survive Eskiz's pipeline and render as visual paragraph breaks on the recipient's phone. Each newline counts as 1 character (same in both encodings), already factored into the char counts below.

Once each template is approved, Eskiz returns a numeric `id`. Capture those four IDs — they go into the `SmsTemplate.eskizTemplateId` column when we wire up the integration.

---

## 1. Greeting — Russian

Auto-sent immediately on lead creation when `Lead.language === "ru"`.

`~200 chars · 3 parts UCS-2`

```
Здравствуйте, Азиз!
Спасибо за заявку в Banana School. Скоро свяжемся по поводу пробного урока.

Сохраните +998979798808, чтобы не пропустить звонок.

Или напишите нам в Telegram: t.me/bananaschool_uz
```

---

## 2. Greeting — Uzbek

Auto-sent immediately on lead creation when `Lead.language === "uz"`.

`~256 chars · 2 parts GSM-0338`

```
Assalomu alaykum, Aziz!
Banana School maktabiga arizangiz uchun rahmat. Tez orada sinov darsi haqida bog'lanamiz.

Iltimos, +998979798808 raqamini saqlab qo'ying, qo'ng'iroqimizni o'tkazib yubormang.

Yoki bizga Telegram orqali yozing: t.me/bananaschool_uz
```

---

## 3. Callback reminder — Russian

Manually sent by staff from the leads UI when a call goes unanswered. Used for `Lead.language === "ru"`.

`~199 chars · 3 parts UCS-2`

```
Здравствуйте, Азиз!
К сожалению, не дозвонились до вас. Хотели обсудить вашу заявку в Banana School.

Перезвоните: +998979798808
Или напишите нам в Telegram: t.me/bananaschool_uz

Будем рады общению.
```

---

## 4. Callback reminder — Uzbek

Manually sent by staff from the leads UI when a call goes unanswered. Used for `Lead.language === "uz"`.

`~246 chars · 2 parts GSM-0338`

```
Assalomu alaykum, Aziz!
Afsuski, siz bilan bog'lanolmadik. Banana School maktabiga arizangiz haqida gaplashmoqchi edik.

+998979798808 raqamiga qayta qo'ng'iroq qiling yoki bizga Telegram orqali yozing: t.me/bananaschool_uz

Sizdan xabar kutamiz.
```

---

## 5. Verification code — Russian

Auto-sent when a visitor on `/verify` requests a phone-verification code. Used for `Lead.language === "ru"`.

`~60 chars · 1 part UCS-2`

```
Banana School: код подтверждения для отправки заявки: 123456
```

---

## 6. Verification code — Uzbek

Auto-sent when a visitor on `/verify` requests a phone-verification code. Used for `Lead.language === "uz"`.

`~70 chars · 1 part GSM-0338`

```
Banana School maktabiga arizani yuborish uchun tasdiqlash kodi: 123456
```

---

## Notes for moderators (if asked)

- **Sample name**: `Азиз` / `Aziz` is a placeholder — production messages substitute the real lead's first name.
- **Sample code**: `123456` is a placeholder — production messages substitute a real 6-digit verification code generated per request.
- **Phone number**: `+998979798808` is Banana School's reception line.
- **Telegram link**: `t.me/bananaschool_uz` is the official Telegram account, embedded as a tappable link rather than `@username` to remove search friction for the recipient.
- **Category**: All templates are `service` (transactional) — sent in response to a user action (form submission, verification request, or missed call), not for promotional purposes.
- **Punkt 2 compliance** (verification templates): both include the resource name (`Banana School`) and the explicit purpose (`для отправки заявки` / `arizani yuborish uchun`), as required for verification-code SMS.
