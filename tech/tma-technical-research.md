# Telegram Mini Apps (TMA) Technical Research for Sovga

> Comprehensive technical reference for building a social gifting platform as a Telegram Mini App using Next.js, targeting Uzbekistan. Research current as of February 2026.

---

## 1. Bot Requirement

### Does a TMA require a bot?

**Yes, absolutely.** Every Telegram Mini App must be associated with a bot. The bot serves as the "owner" and identity of the Mini App. There is no way to create a standalone TMA without a bot.

### Minimum BotFather setup for a TMA-only product

If you only need the TMA (no bot commands or conversational features), the minimum setup is:

1. **Create the bot:** Send `/newbot` to @BotFather. Provide a display name and a username ending in `bot` (e.g., `SovgaBot`). You receive a **bot token** (e.g., `7123456789:AAH5Y...`).

2. **Create the Mini App:** Send `/newapp` to @BotFather. Select your bot, provide:
   - A title for the app
   - A short description
   - A photo (640x360 recommended)
   - A **Web App URL** (must be HTTPS in production, e.g., `https://app.sovga.uz`)
   - A **short_name** (e.g., `gifts`) -- this becomes part of the direct link: `t.me/SovgaBot/gifts`

3. **Configure the Menu Button (optional but recommended):** Send `/setmenubutton` to @BotFather. Select your bot, enter the HTTPS URL, and a button label (e.g., "Open Sovga"). This places a persistent button in the bot chat that opens your TMA.

### What is `/newapp`?

The `/newapp` command in BotFather registers a **named Mini App** under your bot. This gives you:
- A **direct link**: `t.me/BotUsername/appname` (e.g., `t.me/SovgaBot/gifts`)
- A separate entry point from the Menu Button
- The ability to have **multiple named Mini Apps** under a single bot (each with a different `short_name`)

### Menu Button vs `/newapp`

| Aspect | Menu Button (`/setmenubutton`) | Named App (`/newapp`) |
|--------|-------------------------------|----------------------|
| Link format | Opens via button in bot chat | `t.me/BotName/appname?startapp=X` |
| Multiple apps | One per bot | Multiple per bot |
| Deep linking | Limited | Full `startapp` parameter support |
| Discovery | User must open bot chat first | Shareable direct link |

**For Sovga:** Use both. The Menu Button for users who find the bot, and `/newapp` for shareable gift links.

### How is the bot token used?

The bot token is **never exposed to the frontend**. It is used server-side for:
- **Validating `initData`** (HMAC-SHA-256 signature verification)
- **Calling Bot API methods** (e.g., `sendMessage`, `createInvoiceLink`, `savePreparedInlineMessage`)
- **Connecting payment providers** (the provider token is linked to the bot token)
- **Sending notifications** to users via Bot API `sendMessage`

---

## 2. Sharing Content / Sending Gifts to Telegram Contacts

**This is the critical flow for Sovga:** User buys a gift inside the TMA, then sends a link to a friend inside Telegram.

### All Available Sharing Mechanisms

#### Option A: `switchInlineQuery()` (Bot API 6.7+)

```javascript
// Inside the TMA:
Telegram.WebApp.switchInlineQuery('gift_ABC123', ['users', 'groups']);
```

**How it works:**
1. Closes or minimizes the TMA
2. Opens Telegram's chat picker (filters by the chat types you specify)
3. User selects a chat
4. In the selected chat's input field, inserts: `@SovgaBot gift_ABC123`
5. The bot's **inline query handler** fires on the server
6. The bot responds with an `InlineQueryResult` (e.g., a card with image, title, description, and a button to open the TMA)
7. User taps the result to send it as a message

**Pros:** Native chat picker UI, works on all platforms, well-established pattern.
**Cons:** Requires implementing an inline query handler on your bot backend. The user must tap the inline result to send it (two-step). The TMA closes/minimizes.

**Gotcha:** The second argument `choose_chat_types` is an array of strings: `['users', 'bots', 'groups', 'channels']`. For Sovga gifts, use `['users']` to restrict to individual contacts.

#### Option B: `shareMessage()` + `savePreparedInlineMessage` (Bot API 8.0+, November 2024)

This is the **newest and most powerful** sharing mechanism.

**Flow:**
1. **Server-side:** Your bot calls `savePreparedInlineMessage` via Bot API:
```javascript
// Server-side (Node.js example)
const result = await bot.api.savePreparedInlineMessage({
  user_id: userId,          // The user currently in the TMA
  result: {
    type: 'article',
    id: 'gift_ABC123',
    title: 'You received a gift from Sovga!',
    input_message_content: {
      message_text: 'You have a gift waiting for you!\n\nhttps://t.me/SovgaBot/gifts?startapp=redeem_ABC123',
      parse_mode: 'HTML'
    },
    thumbnail_url: 'https://app.sovga.uz/api/gift-preview/ABC123.jpg',
    description: 'Tap to open your gift'
  },
  peer_types: [{ type: 'users' }]  // Restrict to user chats
});
// result.id = prepared message ID
// result.expiration_date = Unix timestamp when it expires
```

2. **Client-side:** Pass the prepared message ID to the TMA:
```javascript
Telegram.WebApp.shareMessage(preparedMessageId, (success) => {
  if (success) {
    console.log('Gift shared successfully!');
    // Update gift status in your backend
  }
});
```

3. Telegram shows a **native share sheet** where the user picks a contact
4. A preview is shown before sending
5. Events fire: `shareMessageSent` on success, `shareMessageFailed` on failure

**Error types from `shareMessageFailed`:** `UNSUPPORTED`, `MESSAGE_EXPIRED`, `MESSAGE_SEND_FAILED`, `USER_DECLINED`, `UNKNOWN_ERROR`

**Pros:** Best UX -- native share sheet, message preview before sending, no need to leave the TMA, works with rich content (images, formatted text).
**Cons:** Requires Bot API 8.0+ (supported since Nov 2024, so all modern clients have it). The prepared message has an **expiration date** -- generate it right when the user wants to share. Requires server roundtrip to prepare the message.

#### Option C: Share URL via `openTelegramLink()`

```javascript
// Opens the Telegram share dialog with a pre-filled URL
Telegram.WebApp.openTelegramLink(
  'https://t.me/share/url?url=' + encodeURIComponent('https://t.me/SovgaBot/gifts?startapp=redeem_ABC123') + '&text=' + encodeURIComponent('I sent you a gift on Sovga!')
);
```

**How it works:**
1. Opens Telegram's native share/forward UI
2. User picks a chat
3. The message is sent with the URL and text

**Gotcha:** Since Bot API 7.0, calling `openTelegramLink` no longer closes the Mini App. The share dialog opens as an overlay.

**Pros:** Simple, no server-side setup needed, no inline handler required.
**Cons:** Less control over message appearance (just a URL + text, not a rich card). Relies on Telegram's link preview generation for the URL.

#### Option D: `tg://msg_url` URL Scheme

```javascript
// Same as Option C but using tg:// protocol
window.location.href = 'tg://msg_url?url=' + encodeURIComponent('https://t.me/SovgaBot/gifts?startapp=redeem_ABC123') + '&text=' + encodeURIComponent('I sent you a gift!');
```

**Pros:** Works from any context.
**Cons:** Might cause WebView navigation issues. `openTelegramLink()` is the preferred method inside a TMA.

#### Option E: `sendData()` (Keyboard Button Mini Apps only)

```javascript
Telegram.WebApp.sendData(JSON.stringify({ giftId: 'ABC123', action: 'share' }));
```

**Limitation:** This ONLY works when the TMA was opened via a `KeyboardButton` (not inline button, not direct link, not menu button). It sends data to the bot as a service message and **immediately closes the TMA**. Data limit: 4096 bytes. **Not suitable for Sovga's sharing flow.**

#### Can a TMA access the user's contact list?

**No.** TMAs cannot read the user's Telegram contact list. There is no API for this. `requestContact()` only asks the user to share **their own** phone number, not browse contacts.

#### Can a TMA open Telegram's native contact picker?

**Indirectly, yes** -- via `switchInlineQuery()` with `choose_chat_types: ['users']` or `shareMessage()`. Both open a native chat/contact selection UI. But you cannot get a list of contacts programmatically.

### RECOMMENDED APPROACH FOR SOVGA

**Use `shareMessage()` (Option B) as the primary method** with `switchInlineQuery()` (Option A) as a fallback for older clients:

```javascript
async function shareGift(giftId) {
  // 1. Call your backend to prepare the message
  const response = await fetch('/api/prepare-share', {
    method: 'POST',
    body: JSON.stringify({ giftId }),
    headers: { 'Authorization': `tma ${Telegram.WebApp.initData}` }
  });
  const { preparedMessageId } = await response.json();

  // 2. Try shareMessage first (Bot API 8.0+)
  if (Telegram.WebApp.isVersionAtLeast('8.0')) {
    Telegram.WebApp.shareMessage(preparedMessageId, (sent) => {
      if (sent) {
        markGiftAsShared(giftId);
      }
    });
  } else {
    // 3. Fallback to switchInlineQuery
    Telegram.WebApp.switchInlineQuery(`gift_${giftId}`, ['users']);
  }
}
```

### `shareToStory()` (Bot API 7.8+)

Not for direct gift sharing, but useful for promotion:
```javascript
Telegram.WebApp.shareToStory('https://app.sovga.uz/story-media/gift-promo.jpg', {
  text: 'Check out this gift I found on Sovga!',
  widget_link: {
    url: 'https://t.me/SovgaBot/gifts',
    name: 'Open Sovga'
  }
});
```

---

## 3. TMA Viewport & Lifecycle

### Opening Behavior

TMAs open as a **bottom sheet** by default (taking roughly 60-70% of screen height). You can control the initial size:

- **Default (compact):** `t.me/BotName/app?mode=compact` -- opens as a smaller bottom sheet
- **Expanded:** Call `WebApp.expand()` or the user drags it up
- **Fullscreen (Bot API 8.0+):** Call `WebApp.requestFullscreen()`

### `WebApp.expand()` and `WebApp.close()`

```javascript
// Expand to maximum available height (still has Telegram header)
Telegram.WebApp.expand();

// Check if expanded
if (Telegram.WebApp.isExpanded) { /* ... */ }

// Close the Mini App
Telegram.WebApp.close();
```

### Fullscreen Mode (Bot API 8.0+)

```javascript
// Enter fullscreen (no Telegram header, true edge-to-edge)
Telegram.WebApp.requestFullscreen();

// Exit fullscreen
Telegram.WebApp.exitFullscreen();

// Check state
if (Telegram.WebApp.isFullscreen) { /* ... */ }

// Listen for events
Telegram.WebApp.onEvent('fullscreenChanged', () => {
  console.log('Fullscreen:', Telegram.WebApp.isFullscreen);
});

Telegram.WebApp.onEvent('fullscreenFailed', (event) => {
  // event.error: 'UNSUPPORTED' or 'ALREADY_FULLSCREEN'
});
```

### Orientation Lock (Bot API 8.0+)

```javascript
Telegram.WebApp.lockOrientation();    // Lock to current orientation
Telegram.WebApp.unlockOrientation();  // Allow rotation
// Telegram.WebApp.isOrientationLocked (Boolean)
```

### Back Button

```javascript
// Show the back button in the Telegram header
Telegram.WebApp.BackButton.show();

// Handle clicks
Telegram.WebApp.BackButton.onClick(() => {
  // Navigate back in your app's router
  router.back();
});

// Hide when not needed
Telegram.WebApp.BackButton.hide();

// Remove handler
Telegram.WebApp.BackButton.offClick(handler);
```

**Gotcha:** The BackButton is in Telegram's header, not your app's UI. On desktop, it appears as a left arrow. Methods are chainable: `WebApp.BackButton.show().onClick(fn)`.

### MainButton (now BottomButton)

The `MainButton` class was renamed to `BottomButton` in the API docs, but `WebApp.MainButton` still works as the reference.

```javascript
const btn = Telegram.WebApp.MainButton;

btn.setText('Buy Gift - 50,000 UZS');
btn.setParams({
  color: '#FF6B35',
  text_color: '#FFFFFF',
  has_shine_effect: true,  // Bot API 7.10+ -- subtle shine animation
  is_active: true,
  is_visible: true
});
btn.show();

btn.onClick(() => {
  btn.showProgress();  // Shows spinner, disables button
  processPayment().finally(() => btn.hideProgress());
});

// Disable/enable
btn.disable(); // Grayed out, not clickable
btn.enable();
```

### SecondaryButton (Bot API 7.10+)

**Yes, it exists.** Added in Bot API 7.10 (September 2024).

```javascript
const secondary = Telegram.WebApp.SecondaryButton;

secondary.setParams({
  text: 'Add to Wishlist',
  color: '#E0E0E0',
  text_color: '#333333',
  position: 'left',  // 'left', 'right', 'top', 'bottom' relative to MainButton
  is_visible: true
});
secondary.show();

secondary.onClick(() => {
  addToWishlist();
});
```

### Theme Parameters

```javascript
const theme = Telegram.WebApp.themeParams;
// theme.bg_color, theme.text_color, theme.hint_color, theme.link_color,
// theme.button_color, theme.button_text_color, theme.secondary_bg_color,
// theme.header_bg_color, theme.bottom_bar_bg_color, theme.section_bg_color,
// theme.section_header_text_color, theme.section_separator_color,
// theme.accent_text_color, theme.subtitle_text_color, theme.destructive_text_color

// All available as CSS variables:
// var(--tg-theme-bg-color), var(--tg-theme-text-color), etc.

// Color scheme
Telegram.WebApp.colorScheme; // 'light' or 'dark'

// Customize header
Telegram.WebApp.setHeaderColor('#FF6B35'); // or 'bg_color', 'secondary_bg_color'
Telegram.WebApp.setBackgroundColor('#FFFFFF');
Telegram.WebApp.setBottomBarColor('#F5F5F5'); // Bot API 7.10+

// Listen for theme changes
Telegram.WebApp.onEvent('themeChanged', () => {
  // Re-read themeParams, colorScheme
});
```

### Viewport

```javascript
// Current visible area height (changes during animations, keyboard open)
Telegram.WebApp.viewportHeight;

// Stable height (after animations/gestures complete)
Telegram.WebApp.viewportStableHeight;

Telegram.WebApp.onEvent('viewportChanged', (event) => {
  // event.isStateStable: boolean -- true when animation finished
  console.log('Height:', Telegram.WebApp.viewportHeight);
  console.log('Stable:', event.isStateStable);
});
```

### Safe Area Insets (Bot API 8.0+)

Critical for fullscreen mode on devices with notches:

```javascript
// System safe area (notches, status bar, navigation bar)
Telegram.WebApp.safeAreaInset.top;
Telegram.WebApp.safeAreaInset.bottom;
Telegram.WebApp.safeAreaInset.left;
Telegram.WebApp.safeAreaInset.right;

// Telegram UI safe area (Telegram's own header/bottom bar)
Telegram.WebApp.contentSafeAreaInset.top;
Telegram.WebApp.contentSafeAreaInset.bottom;

// CSS variables (use these for responsive layouts):
// var(--tg-safe-area-inset-top), var(--tg-safe-area-inset-bottom), etc.
// var(--tg-content-safe-area-inset-top), var(--tg-content-safe-area-inset-bottom), etc.
```

### Vertical Swipe Control

```javascript
// Disable vertical swipes that minimize/close the TMA (important for scrollable content)
Telegram.WebApp.disableVerticalSwipes();

// Re-enable
Telegram.WebApp.enableVerticalSwipes();
```

### Closing Confirmation

```javascript
// Show "Are you sure?" dialog when user tries to close
Telegram.WebApp.enableClosingConfirmation();
Telegram.WebApp.disableClosingConfirmation();
```

### Active State (Bot API 8.0+)

```javascript
Telegram.WebApp.isActive; // true if app is in foreground

Telegram.WebApp.onEvent('activated', () => {
  // App came to foreground (resume animations, etc.)
});

Telegram.WebApp.onEvent('deactivated', () => {
  // App went to background (pause expensive operations)
});
```

---

## 4. Authentication -- initData Deep Dive

### What is in `initData`?

`Telegram.WebApp.initData` is a **URL-encoded query string** containing signed launch parameters. Example:

```
query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A279058397%2C%22first_name%22%3A%22Vladimir%22%2C%22last_name%22%3A%22Kim%22%2C%22username%22%3A%22vladkim%22%2C%22language_code%22%3A%22en%22%2C%22is_premium%22%3Atrue%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%2F%2Ft.me%2Fi%2Fuserpic%2F...%22%7D&auth_date=1662771648&hash=c501b71e775f74ce10e377dea85a7ea24ecd640b223ea86dfe453e0eaed2e2b2
```

### Full Field List

| Field | Type | Description |
|-------|------|-------------|
| `query_id` | String, optional | Unique session ID; present when bot can send a reply via `answerWebAppQuery` |
| `user` | WebAppUser, optional | Current user info |
| `receiver` | WebAppUser, optional | Chat partner in private chats (attachment menu only) |
| `chat` | WebAppChat, optional | Group/channel info (attachment menu only) |
| `chat_type` | String, optional | `sender`, `private`, `group`, `supergroup`, `channel` (direct links only) |
| `chat_instance` | String, optional | Global unique chat ID (direct links only) |
| `start_param` | String, optional | Value from `?startapp=` in the link |
| `can_send_after` | Integer, optional | Seconds until next `answerWebAppQuery` call is allowed |
| `auth_date` | Integer | Unix timestamp when init data was generated |
| `hash` | String | HMAC-SHA-256 signature for bot-token validation |
| `signature` | String (Bot API 8.0+) | Ed25519 signature for third-party validation |

### WebAppUser Object

| Field | Type | Always present? |
|-------|------|-----------------|
| `id` | Integer | Yes |
| `first_name` | String | Yes |
| `last_name` | String | No |
| `username` | String | No |
| `language_code` | String | Only in `user` field |
| `is_premium` | Boolean | No (only if true) |
| `photo_url` | String | No |
| `allows_write_to_pm` | Boolean | No |
| `added_to_attachment_menu` | Boolean | No |
| `is_bot` | Boolean | Only in `receiver` field |

### Does initData include phone number?

**No.** The phone number is NOT included in `initData`. You must use `WebApp.requestContact()` to get the user's phone number separately (see Section 10).

### Does it include premium status?

**Yes.** The `is_premium` field is present in the user object if the user is a Telegram Premium subscriber.

### Can you get the contact list?

**No.** There is absolutely no way to access the user's contact list from a TMA.

### `initData` vs `initDataUnsafe`

- **`Telegram.WebApp.initData`** (String): The raw query string as received. Send this to your server for validation.
- **`Telegram.WebApp.initDataUnsafe`** (Object): The same data parsed into a JavaScript object for convenient client-side access. **Never trust this on the server** -- it has not been validated. Use it only for UI purposes (showing the user's name, etc.).

```javascript
// Client-side (for UI only):
const user = Telegram.WebApp.initDataUnsafe.user;
console.log(user.first_name); // "Vladimir"
console.log(user.id);         // 279058397

// Server-side (for auth):
// Send Telegram.WebApp.initData as a header
fetch('/api/gifts', {
  headers: {
    'Authorization': `tma ${Telegram.WebApp.initData}`
  }
});
```

### How long is initData valid?

**Telegram does not enforce a hard expiration.** The `auth_date` field contains the Unix timestamp of when the data was generated, but there is no built-in expiry. **You must implement your own expiry check server-side.**

Community convention: **expire after 1 day (86,400 seconds)**. The `@tma.js/init-data-node` package defaults to this.

```javascript
// Server-side expiry check:
const MAX_AGE_SECONDS = 86400; // 24 hours
const authDate = parsedInitData.auth_date;
const now = Math.floor(Date.now() / 1000);
if (now - authDate > MAX_AGE_SECONDS) {
  throw new Error('initData expired');
}
```

### Server-Side Validation (HMAC-SHA-256) -- Exact Algorithm

```javascript
import crypto from 'crypto';

function validateInitData(initDataString, botToken) {
  // 1. Parse the query string
  const params = new URLSearchParams(initDataString);
  const hash = params.get('hash');
  params.delete('hash');
  // Also remove 'signature' if present (Bot API 8.0+)
  params.delete('signature');

  // 2. Sort all remaining key-value pairs alphabetically
  const dataCheckArr = [];
  params.sort(); // URLSearchParams.sort() sorts alphabetically by key
  params.forEach((value, key) => {
    dataCheckArr.push(`${key}=${value}`);
  });
  const dataCheckString = dataCheckArr.join('\n');

  // 3. Create the secret key: HMAC-SHA256 of bot token with key "WebAppData"
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  // 4. Create the data signature: HMAC-SHA256 of data-check-string with secret key
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  // 5. Compare
  if (calculatedHash !== hash) {
    throw new Error('Invalid initData signature');
  }

  // 6. Check auth_date freshness
  const authDate = parseInt(params.get('auth_date'), 10);
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > 86400) {
    throw new Error('initData is too old');
  }

  return JSON.parse(params.get('user') || '{}');
}
```

### Third-Party Validation (Ed25519, Bot API 8.0+)

For services that do not have access to your bot token (e.g., third-party analytics):

```javascript
import { verify } from 'noble-ed25519';

const PRODUCTION_PUBLIC_KEY = 'e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d';

async function validateInitDataThirdParty(initDataString, botId) {
  const params = new URLSearchParams(initDataString);
  let signature = params.get('signature');
  params.delete('hash');
  params.delete('signature');

  // May need to add padding for base64 compliance
  while (signature.length % 4 !== 0) signature += '=';
  const signatureBytes = Buffer.from(signature, 'base64');

  const dataCheckArr = [];
  params.sort();
  params.forEach((value, key) => {
    dataCheckArr.push(`${key}=${value}`);
  });
  const dataCheckString = `${botId}:WebAppData\n${dataCheckArr.join('\n')}`;

  const publicKeyBytes = Buffer.from(PRODUCTION_PUBLIC_KEY, 'hex');
  const isValid = await verify(signatureBytes, Buffer.from(dataCheckString), publicKeyBytes);
  return isValid;
}
```

**Gotcha:** Telegram's documentation notes that at the time of writing, the signature may need `==` padding appended to be valid base64.

---

## 5. Cookie/Session Behavior Inside TMA WebView

### Do cookies work?

**Yes, but with caveats:**

- **`HttpOnly` cookies:** Work. Set from the server, inaccessible to JS -- this is the recommended pattern.
- **`Secure` cookies:** Work -- HTTPS is mandatory for TMAs anyway.
- **`SameSite` cookies:** Set `SameSite=None; Secure` because the TMA WebView is technically a different origin from your server. `SameSite=Lax` or `SameSite=Strict` may cause cookies to be blocked.

### localStorage and sessionStorage

- **`localStorage`:** Works, but **unreliable for persistence**. Telegram can clear the WebView storage at any time (app updates, cache clears, OS memory pressure). On iOS especially, WebView storage may be purged when the OS needs memory.
- **`sessionStorage`:** Works within a single TMA session. Cleared when the TMA is closed.
- **IndexedDB:** Generally works on Android and Desktop. iOS support is less reliable due to WebKit WebView limitations.

### Is the WebView isolated?

**Yes.** The TMA WebView is isolated from:
- Telegram's in-app browser (when you open links in Telegram)
- Other Mini Apps
- The system browser

Each Mini App has its own storage sandbox. Cookies set in the TMA are NOT shared with the in-app browser or other apps.

### Session persistence across TMA reopens

- **Cookies:** Persist across reopens on Android and Desktop. On iOS, may be cleared unpredictably.
- **localStorage:** Same -- Android/Desktop mostly reliable, iOS less so.
- **In-memory state:** Completely lost when the TMA is closed. On some clients, the TMA may be "suspended" when minimized and resumed, but do not rely on this.

### Platform differences

| Feature | iOS | Android | Desktop |
|---------|-----|---------|---------|
| Cookie persistence | Unreliable | Reliable | Reliable |
| localStorage persistence | Unreliable | Mostly reliable | Reliable |
| sessionStorage | Within session only | Within session only | Within session only |
| IndexedDB | Spotty (WebKit) | Works | Works |
| Service Workers | NOT supported | Limited | Limited |
| Virtual keyboard handling | Buggy (known issue) | Works | N/A |

### Recommendation for Sovga with Next.js

**Do NOT rely on cookies or localStorage as the primary session mechanism.** Instead:

1. On every TMA open, validate `initData` server-side
2. Issue a short-lived JWT or session token
3. Store it in an `HttpOnly; Secure; SameSite=None` cookie
4. Also store in `localStorage` as a fallback
5. On every API call, send `initData` in the `Authorization` header as a secondary check
6. Persist all critical state (cart, gift status) to your backend database

```javascript
// Next.js API route example (app router):
// app/api/auth/route.ts
import { NextResponse } from 'next/server';
import { validateInitData } from '@/lib/telegram';
import { SignJWT } from 'jose';

export async function POST(req: Request) {
  const initData = req.headers.get('x-telegram-init-data');
  const user = validateInitData(initData, process.env.BOT_TOKEN!);

  // Create a session
  const token = await new SignJWT({ sub: String(user.id), name: user.first_name })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));

  const response = NextResponse.json({ ok: true });
  response.cookies.set('session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 86400,
    path: '/'
  });
  return response;
}
```

### Does Next.js cookie-based auth work?

**Yes**, with `SameSite=None; Secure`. The standard Next.js `cookies()` API in Server Components and Route Handlers works. Just ensure you set the correct SameSite policy.

### Use Telegram's Built-in Storage APIs

For non-critical state, prefer Telegram's own storage (which handles platform differences):

```javascript
// CloudStorage (Bot API 6.9+) -- synced across devices, 1024 items max, 4096 chars/value
Telegram.WebApp.CloudStorage.setItem('cart', JSON.stringify(cartItems));
Telegram.WebApp.CloudStorage.getItem('cart', (err, value) => { ... });

// DeviceStorage (Bot API 9.0+) -- local only, 5MB per user per bot
Telegram.WebApp.DeviceStorage.setItem('preferences', JSON.stringify(prefs));

// SecureStorage (Bot API 9.0+) -- encrypted, 10 items max, iOS Keychain / Android Keystore
Telegram.WebApp.SecureStorage.setItem('auth_token', token);
```

---

## 6. TMA Limitations & Capabilities

### `window.open()`

**Does NOT work as expected.** The WebView intercepts `window.open()` calls. Use `WebApp.openLink(url)` to open external URLs instead. Within the TMA, stick to SPA-style navigation.

### Service Workers

**NOT supported on iOS.** Limited/experimental support on Android. Do not rely on service workers for offline functionality or caching. The WebView does not support the Service Worker API reliably.

### File uploads via `<input type="file">`

**Works on all platforms** (iOS, Android, Desktop). Standard file input triggers the native file picker. However, there may be platform-specific limitations on file size and type.

### Camera access

- **`<input type="file" accept="image/*" capture="environment">`:** Works on iOS. Has known issues on Android (bug reported).
- **`navigator.mediaDevices.getUserMedia()`:** Limited support. May not work reliably across all platforms.
- **Built-in QR Scanner (recommended for merchants):**
```javascript
Telegram.WebApp.showScanQrPopup({ text: 'Scan gift QR code' }, (data) => {
  // data = scanned QR text
  processQrCode(data);
  Telegram.WebApp.closeScanQrPopup();
  return true; // return true to close popup after scan
});
```
This is the **recommended approach** for QR scanning instead of using getUserMedia.

### Geolocation API

- **Browser `navigator.geolocation`:** May work but is unreliable.
- **Telegram LocationManager (Bot API 8.0+, recommended):**
```javascript
const lm = Telegram.WebApp.LocationManager;
lm.init(() => {
  if (lm.isLocationAvailable && lm.isAccessGranted) {
    lm.getLocation((location) => {
      console.log(location.latitude, location.longitude);
    });
  }
});
```

### Clipboard API

**Browser `navigator.clipboard`:** Does NOT work.
**Telegram's API:**
```javascript
// Bot API 6.4+ -- attachment menu Mini Apps only, requires user interaction
Telegram.WebApp.readTextFromClipboard((data) => {
  // data: string | null (null if access denied)
});
```

### iframes

**Work with limitations.** You can embed iframes inside your TMA. This is critical for embedding payment forms (Click/Payme checkout pages). However:
- The iframe must be served over HTTPS
- The embedded page must allow framing (no `X-Frame-Options: DENY` or restrictive `frame-ancestors` CSP)
- `window.postMessage` works between the TMA and embedded iframes
- The Telegram WebView itself communicates with the Telegram client via `window.parent.postMessage`

**For Click/Payme checkout:** Embedding their payment form in an iframe inside your TMA is feasible if their checkout pages allow framing. Test this thoroughly -- some payment providers block iframe embedding for security.

### `window.postMessage`

**Works.** This is actually the core communication mechanism between the TMA and the Telegram client. You can also use it for parent-to-iframe communication within your TMA.

### WebSocket support

**Works.** WebSocket connections are supported for real-time communication (e.g., order status updates, chat features).

### Audio/Video playback

**Works** with standard HTML5 `<audio>` and `<video>` elements. Autoplay policies apply (usually requires user interaction). Performance may vary on low-end devices.

### Maximum WebView performance considerations

- The TMA runs in a single WebView instance
- Heavy animations cause frame drops on low-end Android devices
- Test with ~3-year-old mid-range Android phones (common in Uzbekistan)
- Avoid heavy JS bundles -- aim for <200KB initial JS
- Use code splitting aggressively

### CSP restrictions

No Telegram-imposed CSP on your content. You control your own CSP headers. However, ensure your CSP allows:
- `frame-src` for any payment iframes
- `connect-src` for your API endpoints and WebSocket connections
- `script-src` for `https://telegram.org` (the Telegram WebApp JS)

---

## 7. Next.js Inside TMA WebView

### Does SSR / Server Components work?

**Partially.** Server Components work for rendering static content, but **any component that accesses `window.Telegram.WebApp` must be a Client Component** (marked with `'use client'`).

**The core challenge:** The Telegram WebApp SDK requires the `window` object, which does not exist during server-side rendering. Your app must:
1. Render a shell/skeleton on the server
2. Hydrate and initialize Telegram SDK on the client
3. Show real content once Telegram data is available

```typescript
// app/layout.tsx (Server Component -- this works fine)
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}

// app/page.tsx (Server Component renders shell)
import { GiftBrowser } from '@/components/GiftBrowser';
export default function Home() {
  return <GiftBrowser />;
}

// components/GiftBrowser.tsx (Client Component)
'use client';
import { useEffect, useState } from 'react';

export function GiftBrowser() {
  const [user, setUser] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Only runs on client
    setMounted(true);
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      setUser(tg.initDataUnsafe?.user);
    }
  }, []);

  if (!mounted) return <LoadingSkeleton />;
  // ... render gift browser
}
```

### Does App Router work?

**Yes.** The Next.js App Router works normally. Client-side navigation via `next/link` and `useRouter` works inside the TMA WebView. The key is to ensure Telegram SDK access is always in Client Components.

### Do Server Actions work?

**Yes.** Server Actions (form submissions, mutations) work because they are standard HTTP requests under the hood. The WebView handles fetch requests normally.

```typescript
// app/actions.ts
'use server';

export async function addToCart(giftId: string) {
  // This runs on the server -- works fine
  await db.cart.add({ giftId, userId: getCurrentUser() });
  revalidatePath('/cart');
}
```

**Gotcha:** If you rely on cookies for auth in Server Actions, make sure `SameSite=None; Secure` is set. Otherwise the cookie will not be sent with the Server Action's POST request.

### Does `next/image` work?

**Yes.** The `<Image>` component works normally. Image optimization, lazy loading, and responsive sizing all function in the WebView. Use `unoptimized` prop if you run into issues with your deployment platform's image optimizer.

### Dynamic OG images

`@vercel/og` or `next/og` work for **generating** OG images (they run on the server), but they are consumed by **Telegram's link preview fetcher**, not by the TMA itself. The TMA never renders link previews -- those are rendered natively by Telegram when someone shares a link.

### Does hot reload work during development?

**Yes**, when you open the TMA pointing to `localhost`. Hot reload works like in a regular browser. The recommended dev setup:
1. Run `next dev` on your machine
2. Use a tunnel (ngrok, VSCode tunnel, Cloudflare tunnel) to get an HTTPS URL
3. Set this URL in BotFather (`/setmenubutton` or update the web app URL)
4. Open the TMA in Telegram -- changes reflect instantly via HMR

The official Next.js template supports `dev:https` which generates a self-signed certificate for `https://localhost:3000`.

### Known Issues

1. **`startapp` is the only URL parameter:** You cannot use standard query params. Everything must be encoded in the single `startapp` value: `?startapp=redeem_ABC123_from_user456`
2. **No `window.location` manipulation:** Avoid pushState/replaceState for Telegram-specific params. Use Next.js router for internal navigation.
3. **Development outside Telegram:** The SDK fails with "launch parameters not found" outside Telegram. Use `mockTelegramEnv` from `@telegram-apps/sdk` in development.

---

## 8. Telegram Link Previews & Deep Links

### Link format for gift sharing

**Direct Mini App link:**
```
https://t.me/SovgaBot/gifts?startapp=redeem_ABC123
```

When a user clicks this link:
1. If they have Telegram installed: Opens Telegram, navigates to SovgaBot, launches the `gifts` Mini App with `start_param = 'redeem_ABC123'`
2. If not: Opens in browser, shows a "Open in Telegram" page

### Reading the `startapp` parameter

```javascript
// In your TMA:
const startParam = Telegram.WebApp.initDataUnsafe.start_param;
// Also available in initData as start_param field
// Also available as URL param tgWebAppStartParam

if (startParam?.startsWith('redeem_')) {
  const giftId = startParam.replace('redeem_', '');
  navigateToGiftRedemption(giftId);
}
```

**Parameter constraints:**
- Max 64 characters
- Only base64url characters allowed: `A-Z`, `a-z`, `0-9`, `_`, `-`
- If you need to pass multiple values, encode them: `startapp=redeem_ABC123_from_user456`

### Can you make `sovga.uz` open the TMA instead of a browser?

**Not directly.** Telegram only intercepts `t.me` links. A regular domain like `sovga.uz` will open in the system browser or Telegram's in-app browser, not as a TMA.

**Workaround:** Use `sovga.uz/gift/ABC123` as a landing page that:
1. Shows a nice gift preview (useful for non-Telegram users)
2. Has a prominent "Open in Telegram" button linking to `t.me/SovgaBot/gifts?startapp=redeem_ABC123`
3. Auto-redirects to the `t.me` link on mobile

### Link previews for `sovga.uz` URLs

When someone pastes `https://sovga.uz/gift/ABC123` in a Telegram chat, Telegram fetches the page's meta tags to generate a preview:

```html
<!-- In your Next.js page: app/gift/[id]/page.tsx -->
<head>
  <meta property="og:title" content="You received a gift!" />
  <meta property="og:description" content="Vladimir sent you a Chocolate Box from Sovga" />
  <meta property="og:image" content="https://sovga.uz/api/og/ABC123" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
</head>
```

**Cache behavior:** Telegram caches link previews for approximately **24 hours**. To force a refresh:
- Append a cache-busting query param: `sovga.uz/gift/ABC123?v=2`
- Or use Telegram's `@WebpageBot` -- send the URL to this bot to request a cache refresh

### Link previews for `t.me` links

`t.me/SovgaBot/gifts?startapp=redeem_ABC123` generates a preview using the Mini App's metadata from BotFather (the photo and description you provided during `/newapp`). You have limited control over per-gift customization in these previews.

**This is why `shareMessage()` is better** -- it lets you send a fully customized message with per-gift images and text, not just a link.

### `openLink()` vs `openTelegramLink()`

```javascript
// Opens URL in the system browser or Telegram's in-app browser
// Mini App stays open
Telegram.WebApp.openLink('https://sovga.uz/terms', {
  try_instant_view: true // Try Telegram's Instant View if available
});

// Opens a t.me link natively within Telegram
// Since Bot API 7.0, Mini App stays open (previously it closed)
Telegram.WebApp.openTelegramLink('https://t.me/share/url?url=...');
```

---

## 9. Payments: Bot Payments API vs Embedded Checkout

### Option 1: Telegram Bot Payments API with Click/Payme

**Both Click and Payme are officially supported Telegram payment providers.**

**Setup in BotFather:**
1. `/mybots` -> Select your bot -> Bot Settings -> Payments
2. For Click: Select "CLICK Uzbekistan" -> "Connect CLICK Terminal Live" -> Authorize with Click credentials -> Receive provider token
3. For Payme: Select "Payme" -> Follow authorization flow -> Receive provider token

**Creating an invoice (server-side):**

```javascript
// Using grammY, node-telegram-bot-api, or raw HTTP
const invoiceLink = await bot.api.createInvoiceLink({
  title: 'Gift: Chocolate Box',
  description: 'A delicious chocolate box from Sovga',
  payload: JSON.stringify({ giftId: 'ABC123', buyerId: 279058397 }),
  provider_token: process.env.CLICK_PROVIDER_TOKEN, // or PAYME_PROVIDER_TOKEN
  currency: 'UZS',
  prices: [{ label: 'Chocolate Box', amount: 5000000 }], // Amount in tiyin (50,000 UZS * 100)
  // photo_url, photo_width, photo_height for invoice image
  // need_name: true, need_phone_number: true, etc. for shipping
});
```

**Opening the invoice in the TMA:**

```javascript
// Client-side
Telegram.WebApp.openInvoice(invoiceLink, (status) => {
  // status: 'paid' | 'cancelled' | 'failed' | 'pending'
  if (status === 'paid') {
    // Gift purchased! Now show sharing flow
    showShareGiftDialog(giftId);
  }
});
```

**Server-side payment handling:**

```javascript
// Handle pre-checkout query (must respond within 10 seconds!)
bot.on('pre_checkout_query', async (ctx) => {
  const payload = JSON.parse(ctx.preCheckoutQuery.invoice_payload);
  const gift = await db.gifts.findById(payload.giftId);

  if (!gift || gift.stock <= 0) {
    await ctx.answerPreCheckoutQuery(false, { error_message: 'Gift no longer available' });
    return;
  }

  await ctx.answerPreCheckoutQuery(true); // Approve the payment
});

// Handle successful payment
bot.on('message:successful_payment', async (ctx) => {
  const payload = JSON.parse(ctx.message.successful_payment.invoice_payload);
  await db.gifts.markAsPurchased(payload.giftId, payload.buyerId);

  // Send confirmation message
  await ctx.reply('Payment successful! Now share your gift with a friend.');
});
```

**Flow:** User taps "Buy" -> TMA calls your API to create invoice link -> `openInvoice()` opens Telegram's native payment UI (Click or Payme) -> User pays within Telegram -> Invoice closes -> TMA receives 'paid' status -> Show share flow.

### Option 2: Telegram Stars (for digital goods only)

If selling **digital goods/services**, you must use Telegram Stars (currency code `XTR`):

```javascript
const invoiceLink = await bot.api.createInvoiceLink({
  title: 'Premium Gift Wrapper',
  description: 'Fancy wrapping for your gift',
  payload: 'wrapper_gold',
  provider_token: '',  // Empty string for Stars
  currency: 'XTR',
  prices: [{ label: 'Gold Wrapper', amount: 50 }] // 50 Stars
});
```

**For Sovga:** Since you are selling physical gifts that will be redeemed at a store, use Click/Payme (real currency), NOT Telegram Stars. Stars are required only for digital goods.

### Option 3: Embedded payment iframe

You can embed Click or Payme checkout pages in an iframe inside your TMA:

```jsx
<iframe
  src={`https://my.click.uz/pay?merchant_id=XXX&amount=50000&return_url=...`}
  style={{ width: '100%', height: '400px', border: 'none' }}
/>
```

**Pros:** Full control over the flow, no Telegram payment API needed.
**Cons:** Must handle `X-Frame-Options` / CSP from the payment provider, may not work if they block iframe embedding, user stays in TMA but payment UI is less native.

### Option 4: Redirect to external payment URL

```javascript
Telegram.WebApp.openLink('https://checkout.payme.uz/pay/ABC123');
```

This opens the payment page in the system browser. The user pays there and you handle the callback via webhook.

**Cons:** User leaves the TMA. Getting them back requires a deep link. Poor UX.

### Recommended Payment Flow for Sovga

**Primary:** Use Telegram Bot Payments API with Click and/or Payme as providers. This gives the best UX (native payment UI within Telegram, no leaving the TMA).

**Fallback:** If a specific payment method is not supported via Telegram's provider system, embed the checkout form in an iframe.

---

## 10. Push Notifications & Messaging

### Can a TMA send push notifications directly?

**No.** TMAs cannot send push notifications. However, the **bot** associated with the TMA can send messages to users, which appear as Telegram notifications.

### `requestWriteAccess()`

```javascript
Telegram.WebApp.requestWriteAccess((granted) => {
  // granted: true if user allowed, false if denied
  if (granted) {
    // Now your bot can send messages to this user
    console.log('Write access granted');
  }
});
```

This shows a native Telegram dialog asking the user: "Allow SovgaBot to send you messages?" If the user consents, the bot can send messages to them even if they haven't explicitly "started" the bot by pressing /start.

The `allows_write_to_pm` field in `initDataUnsafe.user` indicates whether the user has already granted write access.

### `requestContact()`

```javascript
Telegram.WebApp.requestContact((sent, contact) => {
  if (sent) {
    // contact object:
    // {
    //   contact: {
    //     phone_number: '+998901234567',
    //     first_name: 'Vladimir',
    //     last_name: 'Kim',  // optional
    //     user_id: 279058397
    //   },
    //   auth_date: 1662771648,
    //   hash: '...'
    // }
    savePhoneNumber(contact.contact.phone_number);
  }
});
```

Shows a native dialog asking the user to share their phone number. The returned data includes `phone_number`, `first_name`, optional `last_name`, and `user_id`, plus an `auth_date` and `hash` for validation.

**For Sovga:** Use this to collect the sender's phone number for order confirmation or delivery coordination.

### Sending messages via Bot API

```javascript
// Server-side (Node.js)
await bot.api.sendMessage(chatId, 'Your gift has been redeemed! Here are the details...', {
  parse_mode: 'HTML',
  reply_markup: {
    inline_keyboard: [[
      { text: 'Open Sovga', web_app: { url: 'https://app.sovga.uz' } }
    ]]
  }
});
```

### Who can the bot message?

The bot can send messages to users who have:
1. **Started the bot** (pressed /start in the bot chat)
2. **Opened the TMA** from a direct link (this implicitly starts the bot)
3. **Granted write access** via `requestWriteAccess()`
4. **Added the bot** to their attachment menu

**Key insight for Sovga:** When a recipient clicks `t.me/SovgaBot/gifts?startapp=redeem_ABC123`, they implicitly interact with the bot. After this, you can send them follow-up messages (gift reminders, promotions, etc.) via the Bot API.

### Inline keyboards with `web_app` buttons

```javascript
// Send a message with a button that opens the TMA
await bot.api.sendMessage(userId, 'You received a gift!', {
  reply_markup: {
    inline_keyboard: [[
      {
        text: 'Open Gift',
        web_app: { url: 'https://app.sovga.uz?giftId=ABC123' }
      }
    ]]
  }
});
```

**Note:** The `web_app` button type in inline keyboards opens the TMA in a new WebView context. The URL can include query parameters (unlike `startapp` links).

### Notification Strategy for Sovga

1. **Gift purchased:** Bot sends message to buyer: "Your gift is ready to share!"
2. **Gift shared:** Bot sends message to recipient: "You received a gift from [Name]! Tap to open." (with `web_app` button)
3. **Gift about to expire:** Bot sends reminder to recipient
4. **Gift redeemed:** Bot sends confirmation to both sender and recipient
5. **Promotions:** Periodic messages to opted-in users about new gifts/deals

---

## 11. Recent API Changes (2024-2026)

### Bot API 7.0 (December 2023)
- SettingsButton added
- Theme parameters expanded (header_bg_color, accent colors, section styling)
- Reactions system, link preview control, batch message operations

### Bot API 7.2 (March 2024)
- **BiometricManager** introduced (fingerprint/face auth + token storage)
- Business account integration

### Bot API 7.6 (July 2024)
- Native multitasking -- Mini Apps can be minimized and expanded without reloading
- Paid media system

### Bot API 7.7 (July 2024)
- Vertical swipe control (`enableVerticalSwipes`, `disableVerticalSwipes`)
- QR scanner close event

### Bot API 7.8 (July 2024)
- **`shareToStory()`** method -- share media to Telegram Stories
- Main Mini App concept introduced (`has_main_web_app`)

### Bot API 7.10 (September 2024)
- **SecondaryButton** added
- Bottom bar color customization (`setBottomBarColor`)
- Shine effect for MainButton (`has_shine_effect`)

### Bot API 7.11 (October 2024)
- Copy text button for inline keyboards

### Bot API 8.0 (November 2024) -- MAJOR UPDATE
- **`requestFullscreen()` / `exitFullscreen()`** -- true fullscreen mode
- **`shareMessage()`** + `savePreparedInlineMessage` -- native share flow
- **`addToHomeScreen()` / `checkHomeScreenStatus()`** -- add to device home screen
- **Safe area insets** (`safeAreaInset`, `contentSafeAreaInset`)
- **Emoji status management** (`setEmojiStatus`, `requestEmojiStatusAccess`)
- **LocationManager** -- geolocation access
- **Accelerometer, Gyroscope, DeviceOrientation** -- device motion sensors
- **`downloadFile()`** -- native file download prompt
- **`isActive`** -- foreground/background state
- **Orientation lock** (`lockOrientation`, `unlockOrientation`)
- Telegram Stars subscriptions
- Gift system (`sendGift`, `getAvailableGifts`)
- Ed25519 signature for third-party initData validation

### Bot API 8.1 (December 2024)
- Affiliate programs

### Bot API 8.2 (January 2025)
- User/chat verification system
- Collectible gifts support

### Bot API 8.3 (February 2025)
- Video covers and start timestamps

### Bot API 9.0 (April 2025) -- MAJOR UPDATE
- **DeviceStorage** -- persistent local storage (5MB per user per bot)
- **SecureStorage** -- encrypted storage (iOS Keychain / Android Keystore, 10 items max)
- Story posting from bots (`postStory`, `editStory`, `deleteStory`)
- Gift conversion/transfer/upgrade
- Profile photo management for bots

### Bot API 9.1 (July 2025)
- `getMyStarBalance` method
- Star subscription recurring billing
- `hideKeyboard()` method
- Poll options expanded to 12

### Bot API 9.2 (August 2025)
- Checklist support
- Direct messages features
- Suggested posts

### Bot API 9.3 (December 2025)
- `sendMessageDraft` for streamed partial messages
- Topics in private chats
- Enhanced gift system (gifted upgrades, offers, premium gifts)

### Bot API 9.4 (February 2026)
- Custom emoji in bot messages (with Premium)
- Button styling with icons
- Profile photo management methods
- Video quality information

### Cloud Storage API

```javascript
// Available since Bot API 6.9
// Cloud-synced, up to 1024 items per user, max 4096 chars per value
const cs = Telegram.WebApp.CloudStorage;

cs.setItem('user_preferences', JSON.stringify({ theme: 'dark' }));
cs.getItem('user_preferences', (err, value) => {
  if (!err) console.log(JSON.parse(value));
});
cs.getKeys((err, keys) => { /* array of all keys */ });
cs.removeItem('old_key');
```

### BiometricManager API (Bot API 7.2+)

```javascript
const bio = Telegram.WebApp.BiometricManager;

bio.init(() => {
  if (bio.isBiometricAvailable) {
    bio.requestAccess({ reason: 'Confirm your identity for payment' }, (granted) => {
      if (granted) {
        bio.authenticate({ reason: 'Verify payment' }, (success, token) => {
          if (success) {
            // User authenticated via fingerprint/face
            // 'token' is the stored biometric token (if any)
          }
        });
      }
    });
  }
});
```

### Home Screen (Bot API 8.0+)

```javascript
Telegram.WebApp.checkHomeScreenStatus((status) => {
  // status: 'unsupported' | 'unknown' | 'added' | 'missed'
  if (status === 'missed' || status === 'unknown') {
    Telegram.WebApp.addToHomeScreen(); // Prompts the user
  }
});

Telegram.WebApp.onEvent('homeScreenAdded', () => {
  console.log('App added to home screen!');
});
```

---

## Summary: Architecture for Sovga Gift Flow

```
SENDER FLOW:
1. User opens t.me/SovgaBot/gifts (or Menu Button)
2. TMA loads, validates initData server-side
3. User browses gifts (Next.js pages, server-rendered product data)
4. User taps "Buy" -> MainButton.onClick()
5. Server creates invoice via createInvoiceLink (Click/Payme provider)
6. WebApp.openInvoice(link) -> Native Telegram payment UI
7. Payment confirmed -> Server marks gift as purchased
8. Server calls savePreparedInlineMessage with gift card message
9. WebApp.shareMessage(preparedId) -> Native share sheet
10. User picks a Telegram contact -> Message sent

RECIPIENT FLOW:
1. Recipient gets a message with gift card (rich text + image + button)
2. Taps "Open Gift" button -> Opens t.me/SovgaBot/gifts?startapp=redeem_ABC123
3. TMA loads, reads startapp param, shows gift details
4. Recipient taps "Redeem at Store"
5. TMA shows QR code (for merchant to scan) or
   generates a redemption code
6. Merchant scans via their TMA instance (showScanQrPopup)
7. Server validates redemption, marks gift as used
8. Both sender and recipient get confirmation via bot messages
```

---

## Sources

- [Telegram Mini Apps Official Documentation](https://core.telegram.org/bots/webapps)
- [Telegram Bot API Changelog](https://core.telegram.org/bots/api-changelog)
- [Telegram Deep Links Reference](https://core.telegram.org/api/links)
- [Telegram Bot Payments API](https://core.telegram.org/bots/payments)
- [Telegram Mini Apps Community Docs](https://docs.telegram-mini-apps.com/)
- [Init Data Documentation](https://docs.telegram-mini-apps.com/platform/init-data)
- [Mini Apps Methods Reference](https://docs.telegram-mini-apps.com/platform/methods)
- [Click Telegram Payments Documentation](https://docs.click.uz/en/telegram-payments/)
- [iSettle Telegram Payments in Uzbekistan](https://isettlepay.com/payment-methods/telegram-bot-payments)
- [Official Next.js TMA Template](https://github.com/Telegram-Mini-Apps/nextjs-template)
- [Habr: TMA Features Overview](https://habr.com/en/articles/990338/)
- [dev.family: TMA Development Guide](https://dev.family/blog/article/telegram-mini-app-development-and-testing-specifics-from-initialisation-to-launch)
- [TON Docs: TMA Overview](https://docs.ton.org/ecosystem/tma/overview)
- [Magnetto: TMA 2026 Guide](https://magnetto.com/blog/everything-you-need-to-know-about-telegram-mini-apps)
- [messages.savePreparedInlineMessage](https://core.telegram.org/method/messages.savePreparedInlineMessage)
