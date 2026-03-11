# Sovga — Telegram Mini Apps Technical Research

Comprehensive technical reference for building Sovga as a Telegram Mini App. Based on official Telegram documentation (core.telegram.org, docs.telegram-mini-apps.com), Bot API changelog, Click API docs, community resources, and developer experience reports.

---

## 1. Bot Requirement

**Yes, a bot is mandatory.** Telegram Mini Apps are technically an add-on for Telegram Bots — creating a Mini App without a bot is not possible. However, the bot can be minimal.

### Minimum Setup (via @BotFather)

1. `/newbot` → create bot → receive **bot token**
2. `/newapp` → register Mini App → provide HTTPS URL to your web app
3. `/mybots` → Bot Settings → Edit Menu Button URL → set to your TMA URL

That's it. No bot commands, no bot logic, no bot service needed for MVP. The bot exists purely as a container for the Mini App.

### What the Bot Token Is Used For

- **Server-side initData validation** — HMAC-SHA-256 uses the bot token as the key
- **Sending messages via Bot API** — gift notifications, reminders (future)
- **Creating invoices** — Telegram Payments API requires the bot token + provider token
- **BotFather configuration** — all Mini App settings are per-bot

### Configuration Options in BotFather

| Setting | Purpose |
|---------|---------|
| Menu Button URL | Opens TMA from the bot's chat menu button |
| Web App URL | The HTTPS URL of your Mini App |
| Main Mini App | Configurable with media previews and launch button |
| Payment providers | Enable Click/Payme under Settings > Payments |
| Short Name | For Direct Link Mini Apps (`t.me/bot/appname`) |

### Key Decision for Sovga

Even though implementation.md says "No Bot" — you still need a bot entity. The decision was about not building a bot *service* (no commands, no message handling). That's correct for MVP. But the bot must exist, and its token is critical infrastructure.

**Future value:** When you need push notifications (gift received, expiry reminders, birthday alerts), you'll send them as bot messages. The bot is already set up.

---

## 2. Sharing Content — How to Send Gifts to Contacts

This is the most critical flow for Sovga. Multiple mechanisms exist, each with different trade-offs.

### Option A: `shareMessage()` (Bot API 8.0+) — RECOMMENDED

The newest and most native sharing method. Lets you share a **prepared inline message** via Telegram's native share dialog.

**How it works:**
1. Your TMA backend calls `answerWebAppQuery` with a prepared message (text, photo, or article) via the Bot API
2. Bot API returns a `prepared_message_id`
3. Your TMA frontend calls `WebApp.shareMessage(prepared_message_id, callback)`
4. Telegram opens a **native contact/chat picker** dialog
5. User selects a recipient → message is sent directly into their chat
6. Callback fires with success/failure

**Advantages:**
- Native Telegram share dialog (familiar UX, includes recent chats)
- The message appears as a rich inline message (not just a link)
- Works across all chat types (private, groups, channels)

**Limitations:**
- Requires Bot API 8.0+ (November 2024, widely supported by now)
- The prepared message must be created server-side first
- Message expires after some time (need to handle `MESSAGE_EXPIRED` error)

**Code flow:**
```typescript
// Backend: Prepare the inline message
const result = await bot.answerWebAppQuery(queryId, {
  type: 'article',
  id: giftId,
  title: `🎁 Gift from ${senderName}`,
  description: `${productName} at ${merchantName}`,
  input_message_content: {
    message_text: `🎁 *${senderName}* sent you a gift!\n\n${productName} at ${merchantName}\n\nTap to open: https://t.me/sovgabot/app?startapp=gift_${giftCode}`,
    parse_mode: 'Markdown'
  }
});
// result.prepared_message_id → send to frontend

// Frontend: Share the prepared message
WebApp.shareMessage(preparedMessageId, (sent) => {
  if (sent) {
    // Gift was shared successfully
  }
});
```

### Option B: `switchInlineQuery()` (Bot API 6.7+)

Inserts the bot's username and a query into the chat input field, switching to inline mode.

**How it works:**
1. TMA calls `WebApp.switchInlineQuery("gift_ABC123", ["users"])`
2. Telegram closes the TMA and opens the inline query input
3. User sees `@sovgabot gift_ABC123` in the input field of a selected chat
4. Your bot's inline query handler returns a rich result
5. User taps the result to send it

**Advantages:**
- Available since Bot API 6.7 (very wide support)
- Can filter by chat type: `["users", "bots", "groups", "channels"]`

**Disadvantages:**
- Closes the Mini App (user leaves your UX)
- Requires implementing an inline query handler on the bot side
- Two-step process (select result, then send)
- Less intuitive for users

### Option C: Copy Link + Manual Share

The simplest approach — generate a shareable link and let the user copy/paste it.

**How it works:**
1. TMA generates a gift link: `https://t.me/sovgabot/app?startapp=gift_ABC123`
2. User taps "Share" → link is copied to clipboard or share sheet is triggered
3. User pastes in any Telegram chat

**Implementation:**
```typescript
// Use Telegram's built-in link opening to trigger a share
WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(giftLink)}&text=${encodeURIComponent('🎁 I sent you a gift!')}`);
```

Or use the clipboard:
```typescript
// Note: readTextFromClipboard only works in attachment menu, but WRITING to clipboard
// can be done via standard navigator.clipboard.writeText()
await navigator.clipboard.writeText(giftLink);
WebApp.showAlert('Link copied! Send it to your friend.');
```

**Advantages:**
- Zero bot infrastructure needed
- Works universally (even outside Telegram)
- User controls exactly who receives it

**Disadvantages:**
- Extra steps for the user
- No native contact picker
- Link preview depends on Telegram's OG cache

### Option D: `openTelegramLink()` with Share URL

Opens a Telegram link without leaving the Mini App (since Bot API 7.0+).

```typescript
const giftUrl = `https://t.me/sovgabot/app?startapp=gift_${giftCode}`;
const shareText = `🎁 I sent you a gift! ${productName} at ${merchantName}`;
WebApp.openTelegramLink(
  `https://t.me/share/url?url=${encodeURIComponent(giftUrl)}&text=${encodeURIComponent(shareText)}`
);
```

This opens Telegram's native "Share to..." dialog where the user picks a contact/chat. The Mini App stays open in the background.

### Sovga Recommendation

**Primary: Option A (`shareMessage`)** for the rich, native experience. Fall back to **Option D (`openTelegramLink` with share URL)** for older clients that don't support Bot API 8.0+.

**Cannot access contact list directly.** No TMA API provides read access to the user's Telegram contacts. Sharing always goes through Telegram's native dialogs.

---

## 3. TMA Viewport & Lifecycle

### Opening Modes

| Mode | Default Size | Trigger |
|------|-------------|---------|
| **Full-screen** | Expanded to full height | Menu button, direct link (Bot API 7.6+), `?mode=fullscreen` |
| **Compact** | Half-screen bottom sheet | `?mode=compact` in deep link |
| **Expanded** | Full height after `expand()` | Programmatic via `WebApp.expand()` |
| **Fullscreen** | Immersive (no header) | `WebApp.requestFullscreen()` (Bot API 8.0+) |

For Sovga: Use full-screen mode (default for direct links). Call `WebApp.expand()` on load to ensure maximum height.

### Viewport Properties

```typescript
WebApp.viewportHeight       // Current visible area height (changes with keyboard)
WebApp.viewportStableHeight // Height excluding keyboard
WebApp.isExpanded           // Whether expanded to max
WebApp.isFullscreen         // Whether in fullscreen mode (Bot API 8.0+)
```

CSS variables are auto-set:
```css
.container {
  height: var(--tg-viewport-stable-height);
  /* Better than 100vh — accounts for Telegram's header */
}
```

### Safe Area (Bot API 8.0+)

For fullscreen mode, handle notches and status bars:

```css
.content {
  padding-top: var(--tg-content-safe-area-inset-top);
  padding-bottom: var(--tg-safe-area-inset-bottom);
  padding-left: var(--tg-safe-area-inset-left);
  padding-right: var(--tg-safe-area-inset-right);
}
```

### Back Button

```typescript
const backButton = WebApp.BackButton;
backButton.show();
backButton.onClick(() => {
  // Handle navigation back
  if (canGoBack) {
    router.back();
  } else {
    backButton.hide();
  }
});
```

The back button appears in Telegram's header (not in your web content). Show/hide it based on navigation depth.

### Main Button (Primary CTA)

The MainButton is a **native Telegram button** that sits at the bottom of the TMA, outside your web content. Perfect for "Send Gift" or "Pay Now."

```typescript
const mainButton = WebApp.MainButton;
mainButton.setText('Send Gift 🎁');
mainButton.setParams({
  color: '#FFD700',           // Sovga yellow
  text_color: '#000000',
  has_shine_effect: true,     // Animated shine
  is_visible: true,
  is_active: true
});
mainButton.onClick(() => {
  // Handle gift sending
});
mainButton.show();
```

### Secondary Button (Bot API 7.10+)

A second native button, positioned relative to the main button:

```typescript
const secondaryButton = WebApp.SecondaryButton;
secondaryButton.setText('Buy for Self');
secondaryButton.setParams({
  position: 'bottom',  // below main button
  is_visible: true
});
```

### Closing Behavior

```typescript
// Prevent accidental close
WebApp.enableClosingConfirmation();

// Disable vertical swipe-to-close
WebApp.disableVerticalSwipes();

// Programmatic close
WebApp.close();
```

### Lifecycle Events

```typescript
WebApp.onEvent('activated', () => {
  // TMA came to foreground — refresh data
});

WebApp.onEvent('deactivated', () => {
  // TMA went to background — save state
});

WebApp.onEvent('viewportChanged', ({ isStateStable }) => {
  if (isStateStable) {
    // Keyboard animation finished, safe to adjust layout
  }
});
```

### Theme Integration

```typescript
WebApp.colorScheme  // "light" or "dark"
WebApp.themeParams  // Full theme object

// Listen for theme changes (user switches dark/light mode)
WebApp.onEvent('themeChanged', () => {
  applyTheme(WebApp.themeParams);
});
```

All theme colors are available as CSS variables:
```css
body {
  background-color: var(--tg-theme-bg-color);
  color: var(--tg-theme-text-color);
}
a {
  color: var(--tg-theme-link-color);
}
button {
  background-color: var(--tg-theme-button-color);
  color: var(--tg-theme-button-text-color);
}
```

---

## 4. Authentication — initData Deep Dive

### What's in initData

`WebApp.initData` is a URL-encoded query string. `WebApp.initDataUnsafe` is the parsed object.

**Fields:**

| Field | Type | Always present? | Description |
|-------|------|----------------|-------------|
| `user` | WebAppUser | Yes (in most contexts) | Current user info |
| `auth_date` | number | Yes | Unix timestamp of data creation |
| `hash` | string | Yes | HMAC-SHA-256 signature |
| `signature` | string | Bot API 8.0+ | Ed25519 signature for third-party validation |
| `query_id` | string | In inline/menu contexts | Session ID for `answerWebAppQuery` |
| `chat_type` | string | In direct links | "sender", "private", "group", "supergroup", "channel" |
| `chat_instance` | string | In direct links | Global chat identifier |
| `start_param` | string | If provided in link | Value from `?startapp=` parameter |
| `receiver` | WebAppUser | Attachment menu, private chats | Chat partner data |
| `chat` | WebAppChat | Attachment menu, groups | Chat info |
| `can_send_after` | number | Sometimes | Seconds before message can be sent |

### WebAppUser Fields

| Field | Description |
|-------|-------------|
| `id` | Telegram user ID (unique, stable) |
| `first_name` | First name |
| `last_name` | Optional last name |
| `username` | Optional @username |
| `language_code` | IETF language code (e.g., "en", "uz", "ru") |
| `is_premium` | Whether user has Telegram Premium |
| `photo_url` | Profile photo URL (JPEG or SVG) |
| `allows_write_to_pm` | Whether bot can message the user |

### What's NOT in initData

- **Phone number** — NOT included. Must use `WebApp.requestContact()` separately.
- **Contact list** — NOT accessible. No API to read user's contacts.
- **Email** — NOT included.

### Server-Side Validation (HMAC-SHA-256)

```typescript
import crypto from 'crypto';

function validateInitData(initDataRaw: string, botToken: string): boolean {
  const params = new URLSearchParams(initDataRaw);
  const hash = params.get('hash');
  params.delete('hash');

  // Sort parameters alphabetically and join with \n
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // Create secret key from bot token
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  // Calculate HMAC of the data check string
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return calculatedHash === hash;
}
```

### initData Expiration

**There is no built-in expiration.** The `auth_date` field provides the creation timestamp, but Telegram does not enforce a TTL. You MUST implement your own expiration logic:

```typescript
const MAX_AGE_SECONDS = 86400; // 24 hours

function isInitDataFresh(authDate: number): boolean {
  return (Date.now() / 1000) - authDate < MAX_AGE_SECONDS;
}
```

**Recommendation for Sovga:** Validate initData on the first request, create a server-side session (JWT or cookie), and use that session for subsequent requests. Don't send raw initData with every request.

---

## 5. Cookie/Session Behavior Inside TMA WebView

### The Reality: Cookies Are Unreliable

This is a critical gotcha. TMA WebViews behave differently from standard browsers:

- **Cookies may not persist** across TMA reopens
- **localStorage can be cleared** by the Telegram client at any time
- **Sessions are volatile** — Telegram may terminate the WebView when the user switches chats
- The WebView lifecycle is controlled by Telegram, not by your app

### Platform Differences

| Platform | WebView Engine | Cookie Behavior |
|----------|---------------|-----------------|
| **Android** | System WebView (Chromium) | Cookies generally persist but can be cleared |
| **iOS** | WKWebView | More aggressive about clearing cookies; third-party cookie restrictions apply |
| **Desktop** | Chromium-based | Most reliable cookie persistence |
| **Web A/K** | Browser iframe | Standard browser cookie behavior |

### Recommended Auth Strategy for Sovga

**Don't rely on cookies or localStorage for authentication.** Instead:

1. **Validate initData on every TMA open** (it's always fresh when the TMA loads)
2. **Create a short-lived JWT** on the server after validating initData
3. **Send JWT in Authorization header** for all API calls (not cookies)
4. **Store critical state server-side** (in your PostgreSQL database)
5. **Use CloudStorage for non-sensitive client state** (see below)

```typescript
// On TMA load
const initData = WebApp.initData;
const response = await fetch('/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ initData })
});
const { token } = await response.json();
// Store token in memory (not localStorage)
// Use for all subsequent requests
```

### Telegram's Built-in Storage Options

Instead of localStorage, use Telegram's dedicated storage APIs:

**CloudStorage (Bot API 6.9+)**
- 1024 items max, each 0-4096 characters
- Synced across devices (tied to user + bot pair)
- Persists reliably
- Good for: user preferences, UI state, draft messages

```typescript
WebApp.CloudStorage.setItem('lastViewedCategory', 'coffee');
WebApp.CloudStorage.getItem('lastViewedCategory', (err, value) => {
  console.log(value); // 'coffee'
});
```

**DeviceStorage (Bot API 9.0+)**
- Up to 5 MB per user
- Local only (not synced)
- Persistent (localStorage-like but managed by Telegram)
- Good for: cached data, offline state

**SecureStorage (Bot API 9.0+)**
- Up to 10 items
- Uses iOS Keychain / Android Keystore
- For sensitive data (tokens, keys)

### What This Means for Next.js

- **Server-side sessions via cookies**: Unreliable in TMA. Don't use NextAuth with cookie-based sessions.
- **Server Actions**: Work fine (they use fetch under the hood, which carries headers)
- **API routes with JWT in Authorization header**: The recommended approach.
- **Server Components**: Work fine — they render on the server regardless of WebView behavior.

---

## 6. TMA Limitations & Capabilities

### What Works

| Capability | Status | Notes |
|-----------|--------|-------|
| **QR code scanning** | ✅ Native API | `WebApp.showScanQrPopup()` — critical for merchant voucher validation |
| **Camera (photos)** | ✅ With permission | Standard `<input type="file" capture>` works |
| **Geolocation** | ✅ Bot API 8.0+ | Via `LocationManager` — good for showing nearby merchants |
| **Clipboard read** | ⚠️ Limited | Only in attachment menu Mini Apps, requires user interaction |
| **Clipboard write** | ✅ Standard API | `navigator.clipboard.writeText()` works |
| **File upload** | ✅ Standard | `<input type="file">` works normally |
| **File download** | ✅ Bot API 8.0+ | `WebApp.downloadFile()` for settlement reports |
| **Haptic feedback** | ✅ Native API | `WebApp.HapticFeedback.impactOccurred('medium')` |
| **Biometric auth** | ✅ Bot API 7.2+ | Face ID / Fingerprint via `BiometricManager` |
| **Story sharing** | ✅ Bot API 7.8+ | `WebApp.shareToStory()` — potential marketing feature |
| **Orientation lock** | ✅ Bot API 8.0+ | `WebApp.lockOrientation()` |
| **iframes** | ⚠️ Limited | Some work, but payment redirects may break |

### What Doesn't Work

| Capability | Status | Notes |
|-----------|--------|-------|
| **Service Workers** | ❌ Not supported | No PWA-like caching or offline mode inside TMA |
| **`window.open()`** | ❌ Blocked | Use `WebApp.openLink()` instead |
| **Bluetooth** | ❌ Not available | No Web Bluetooth API |
| **Full sensor access** | ⚠️ Limited | Only accelerometer, gyroscope, device orientation (Bot API 8.0+) |
| **Background execution** | ❌ | TMA may be suspended when user switches away |
| **Push notifications** | ❌ Not native | Must use bot messages instead |

### Camera on Android — Known Issue

There is a known bug where Android TMA WebView cannot access the camera via `navigator.mediaDevices.getUserMedia()`. However, the native `WebApp.showScanQrPopup()` works on both platforms. For merchant QR scanning, always use the native API.

### Performance Considerations

- WebView has lower performance than native apps, especially on low-end Android devices
- Android User-Agent includes device performance class — can use this to adjust animations/complexity
- Target 60fps for animations
- Minimize JavaScript bundle size (no heavy frameworks beyond React/Next.js)
- Lazy load images and routes

---

## 7. Next.js Inside TMA

### Does SSR Work?

**Yes, but with caveats.**

Server Components and Server Actions work fine — they execute on the server regardless of the client's WebView. The issue is only with **client-side access to the Telegram SDK**, because `window.Telegram.WebApp` doesn't exist on the server.

**Pattern: Use `"use client"` for Telegram-specific components.**

```typescript
// app/layout.tsx — Server Component (fine)
export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}

// components/TelegramProvider.tsx — Client Component
"use client";
import { useEffect } from 'react';

export function TelegramProvider({ children }) {
  useEffect(() => {
    const WebApp = window.Telegram?.WebApp;
    if (WebApp) {
      WebApp.ready();
      WebApp.expand();
    }
  }, []);

  return <>{children}</>;
}
```

### Server Components Can Fetch Data

```typescript
// app/catalog/page.tsx — Server Component (fine for TMA)
async function CatalogPage() {
  const merchants = await prisma.merchant.findMany({
    include: { products: true }
  });
  return <CatalogView merchants={merchants} />;
}
```

### Server Actions Work

```typescript
// app/actions/gift.ts
"use server";

export async function createGift(productId: string, senderId: string) {
  const gift = await prisma.gift.create({
    data: { productId, senderId, code: generateCode(), ... }
  });
  return gift;
}
```

### `next/image` Works

Standard Next.js image optimization works in TMA WebView. No special configuration needed.

### Dynamic OG Images

`@vercel/og` (or `next/og`) works for generating images at `/api/og/gift/[id]`. These are fetched by Telegram's server when rendering link previews — they're not rendered in the WebView.

### Official Next.js Template

Telegram maintains an official Next.js template: [github.com/Telegram-Mini-Apps/nextjs-template](https://github.com/Telegram-Mini-Apps/nextjs-template)

Key patterns from the template:
- Uses `pnpm` (enforced)
- `useTelegramMock` hook for development outside Telegram
- HTTPS required even for local dev (use `pnpm run dev:https`)
- Submit `https://127.0.0.1:3000` to BotFather (not `localhost`)

### Routing

Next.js App Router works normally. `useRouter()` for client-side navigation. Coordinate with `WebApp.BackButton`:

```typescript
"use client";
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function BackButtonHandler() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const WebApp = window.Telegram?.WebApp;
    if (!WebApp) return;

    if (pathname === '/') {
      WebApp.BackButton.hide();
    } else {
      WebApp.BackButton.show();
      WebApp.BackButton.onClick(() => router.back());
    }

    return () => WebApp.BackButton.offClick(() => router.back());
  }, [pathname, router]);

  return null;
}
```

---

## 8. Deep Links & Link Previews

### Deep Link Formats

| Format | Opens as | Use case |
|--------|---------|----------|
| `https://t.me/sovgabot?start=param` | Bot chat with /start param | Legacy, not for TMA |
| `https://t.me/sovgabot?startapp=gift_ABC` | Main Mini App (full screen) | Gift links |
| `https://t.me/sovgabot?startapp=gift_ABC&mode=compact` | Main Mini App (half screen) | Quick previews |
| `https://t.me/sovgabot/app?startapp=gift_ABC` | Direct Link Mini App | If using short name "app" |

### How `startapp` Parameter Works

The value is available in the TMA as:
- `WebApp.initDataUnsafe.start_param`
- Also in the URL as `tgWebAppStartParam` query param

**Max length: 512 characters** (since Bot API 6.8).

For Sovga gift links:
```
https://t.me/sovgabot?startapp=gift_ABC123
```

In the TMA:
```typescript
const giftCode = WebApp.initDataUnsafe.start_param; // "gift_ABC123"
if (giftCode?.startsWith('gift_')) {
  const code = giftCode.replace('gift_', '');
  // Load and display gift details
}
```

### Link Preview Behavior

When someone shares `https://t.me/sovgabot?startapp=gift_ABC123` in a Telegram chat:

1. **Telegram fetches OG metadata** from the URL (if it's a web-accessible URL)
2. For `t.me` links, Telegram generates its own preview based on the bot's profile
3. **Cache duration: ~24 hours** — Telegram caches link metadata aggressively
4. **Cache busting:** Append a query parameter like `?v=timestamp` to force re-fetch

**Important limitation:** You cannot customize the preview of `t.me` links — they show the bot's name and photo. If you want rich, dynamic previews (showing the gift product, sender name, etc.), you need to use a **custom domain** URL.

### Custom Domain Gift Links (Recommended for Rich Previews)

Use your own domain for gift links with dynamic OG images:

```
https://sovga.uz/gift/ABC123
```

This URL serves:
```html
<meta property="og:title" content="🎁 Gift from John" />
<meta property="og:description" content="Cappuccino at Coffee Shop XYZ" />
<meta property="og:image" content="https://sovga.uz/api/og/gift/ABC123" />
```

When tapped in Telegram, this opens in the browser. To make it open the TMA instead, have the page redirect:
```typescript
// app/gift/[code]/page.tsx
export default function GiftPage({ params }) {
  // If in Telegram, redirect to TMA
  // If in browser, show web version (or redirect to t.me link)
  return (
    <>
      <meta httpEquiv="refresh" content="0;url=https://t.me/sovgabot?startapp=gift_{params.code}" />
      {/* Fallback web content */}
    </>
  );
}
```

### Practical Approach for Sovga

Use **two URLs** for each gift:

1. **Share URL** (for Telegram chats): `https://t.me/sovgabot?startapp=gift_ABC123` — opens TMA directly
2. **Web URL** (for OG previews, universal access): `https://sovga.uz/gift/ABC123` — serves OG tags, redirects to TMA

When the user shares a gift via `shareMessage()`, the prepared message includes both the deep link and a rich text description. The link preview issue becomes less relevant because the message itself contains the product info.

---

## 9. Payment Integration

### Critical Finding: Click IS a Telegram Payment Provider

**Confirmed.** In BotFather → Settings → Payments, "CLICK Uzbekistan" is listed as an available payment provider. This means **Option A (Telegram Bot Payments API) is viable** — not just Option B (embedded checkout).

**Payme** is also available via intermediary providers (iSettle lists Payme, Humo, UzCard, Kapitalbank).

### Option A: Telegram Bot Payments API + `openInvoice()`

The most frictionless approach. Payment UI is native Telegram, no redirects, no iframes.

**Setup:**
1. In BotFather → Settings → Payments → select "CLICK Uzbekistan"
2. Authorize with @CLICKTerminal bot (live) or @CLICKtest bot (test)
3. Receive a **provider token** (e.g., `123456789:LIVE:xxxxx`)

**Flow:**
1. TMA backend creates an invoice via Bot API `createInvoiceLink`:
```typescript
const invoiceLink = await bot.createInvoiceLink({
  title: 'Cappuccino at Coffee Shop XYZ',
  description: 'Gift for John',
  payload: JSON.stringify({ giftId, productId, senderId }),
  provider_token: CLICK_PROVIDER_TOKEN,
  currency: 'UZS',
  prices: [{ label: 'Cappuccino', amount: 2000000 }], // Amount in smallest unit (tiyin)
});
```

2. TMA frontend opens the invoice:
```typescript
WebApp.openInvoice(invoiceLink, (status) => {
  if (status === 'paid') {
    // Payment successful — proceed to share gift
  } else if (status === 'cancelled') {
    // User cancelled
  } else if (status === 'failed') {
    // Payment failed — show error
  } else if (status === 'pending') {
    // Payment processing — wait for webhook
  }
});
```

3. Bot receives `pre_checkout_query` → respond within 10 seconds:
```typescript
bot.on('pre_checkout_query', async (query) => {
  // Validate the order (product exists, price correct, etc.)
  await bot.answerPreCheckoutQuery(query.id, true);
  // OR reject: await bot.answerPreCheckoutQuery(query.id, false, { error_message: 'Out of stock' });
});
```

4. Bot receives `successful_payment` message:
```typescript
bot.on('message', async (msg) => {
  if (msg.successful_payment) {
    const payload = JSON.parse(msg.successful_payment.invoice_payload);
    // Create the gift voucher in database
    // Generate shareable link
    // Notify TMA to proceed to sharing step
  }
});
```

**Advantages:**
- Native Telegram payment UI — users trust it
- No iframe issues, no redirect issues
- Telegram handles the payment form
- Click processes the actual payment
- Zero commission from Telegram
- Works reliably in TMA WebView

**Disadvantages:**
- Can only use one provider per invoice (can't show Click AND Payme on same screen)
- Currency must be specified upfront
- UI is Telegram's, not yours (less customization)

### Option B: Embedded Checkout in TMA WebView

Embed Click/Payme's checkout page directly in the TMA.

**How it would work:**
1. Create order via Click/Payme API
2. Redirect user to Click/Payme checkout URL within the TMA
3. After payment, redirect back to TMA URL

**Risk factors:**
- Redirects within WebView may not work reliably on all platforms
- iframes may be blocked or have cross-origin issues
- Click/Payme's checkout page may not be optimized for TMA's WebView
- You lose the native Telegram payment trust signals

### Sovga Recommendation

**Use Option A (Telegram Bot Payments API with `openInvoice()`)** for MVP. It's the path of least resistance:
- Click is already a registered Telegram provider
- No iframe or redirect concerns
- Native UX that users trust
- Simple webhook-based confirmation
- Zero Telegram commission

**To support both Click AND Payme:** Create the invoice with Click by default. Add a "Pay with Payme" button that creates a separate invoice with the Payme provider token. The UX can be: show a payment method picker before calling `openInvoice()`.

### Test Mode

Click provides test mode via @CLICKtest bot. Use `CLICK Terminal Test` token during development. Switch to `CLICK Terminal` (live) token for production.

---

## 10. Push Notifications

### TMAs Cannot Send Push Notifications Directly

There is no push notification API for Mini Apps. Notifications must go through the **bot**.

### How to Send Notifications

Use the Bot API `sendMessage` from your backend:

```typescript
// When a gift is sent to a recipient
await bot.sendMessage(recipientTelegramId,
  `🎁 ${senderName} sent you a gift!\n\n` +
  `${productName} at ${merchantName}\n\n` +
  `Tap to open:`,
  {
    reply_markup: {
      inline_keyboard: [[
        { text: 'Open Gift 🎁', web_app: { url: `https://sovga.uz/gift/${giftCode}` } }
      ]]
    }
  }
);
```

### Permission Required

Before your bot can message a user, they must have either:
1. Started a conversation with the bot (`/start`)
2. Granted write access via `WebApp.requestWriteAccess()`

```typescript
// In TMA, request permission to send messages
WebApp.requestWriteAccess((granted) => {
  if (granted) {
    // Bot can now send messages to this user
    // Save this permission state in your database
  }
});
```

### `requestContact()` — Getting Phone Numbers

```typescript
WebApp.requestContact((sent) => {
  if (sent) {
    // User shared their phone number
    // Phone is sent as a service message to the bot
    // NOT available in the TMA directly — handle via bot webhook
  }
});
```

### Notification Types for Sovga

| Trigger | Message |
|---------|---------|
| Gift received | "🎁 {sender} sent you a gift! {product} at {merchant}" |
| Gift redeemed | "✅ Your gift to {recipient} was redeemed!" |
| Gift expiring | "⏰ Your gift of {product} expires in {days} days" |
| Gift expired | "Your gift of {product} has expired" |
| Birthday reminder (future) | "🎂 {friend}'s birthday is tomorrow!" |

---

## 11. Recent API Changes (2024-2026)

### Bot API 9.0-9.1 (Late 2025 - Early 2026)

- **DeviceStorage** — persistent local storage (5 MB), managed by Telegram
- **SecureStorage** — iOS Keychain / Android Keystore (10 items)
- **`hideKeyboard()`** — programmatically hide on-screen keyboard (Bot API 9.1)

### Bot API 8.0 (November 2024) — Major TMA Update

This was the biggest TMA update ever. Added:
- `shareMessage()` — native share dialog
- `requestFullscreen()` / `exitFullscreen()` — immersive mode
- `LocationManager` — geolocation access
- `Accelerometer`, `DeviceOrientation`, `Gyroscope` — motion sensors
- `addToHomeScreen()` — install shortcut
- `downloadFile()` — native file download
- Safe area insets
- `SecondaryButton`
- `activated` / `deactivated` events
- Ed25519 `signature` for third-party initData validation
- `photo_url` in WebAppUser

### Bot API 7.7-7.10 (Mid 2024)

- Vertical swipe control (`enableVerticalSwipes()` / `disableVerticalSwipes()`)
- `shareToStory()` — share to Telegram Stories
- `bottomBarColor` customization
- Direct Link Mini Apps now open full-screen by default

### Bot API 6.9-7.6 (2023-2024)

- `CloudStorage` (6.9)
- `requestWriteAccess()` / `requestContact()` (6.9)
- `SettingsButton` (7.0)
- `openTelegramLink()` keeps TMA open (7.0)
- Extended `startapp` parameter to 512 chars (6.8)
- QR scanner and clipboard access (6.4)

---

## 12. Architecture Implications for Sovga

### What Changes from the Current Plan

| Current Assumption | Reality | Impact |
|-------------------|---------|--------|
| "No bot needed" | Bot entity required, but no bot service for MVP | Minor — just register a bot |
| "Gift link via regular URL" | Better to use `shareMessage()` for native sharing + `t.me` deep links for direct TMA opening | Medium — need to implement inline message preparation |
| "Option B: Embed Click/Payme checkout" | Option A (`openInvoice()`) is better — Click is a registered Telegram provider | Medium — simpler payment integration |
| "Cookie-based auth" | Cookies unreliable in TMA — use JWT in Authorization header | Medium — auth strategy change |
| "Standard localStorage" | Use CloudStorage (6.9+) or DeviceStorage (9.0+) instead | Small — API difference |
| "QR scanning via camera" | Use native `WebApp.showScanQrPopup()` — works on all platforms | Small — better than camera API |

### Recommended Technical Stack Update

```
Auth:        initData → server validates → JWT (in-memory, not cookie)
Payments:    openInvoice() with Click provider token
Sharing:     shareMessage() (primary) + openTelegramLink share URL (fallback)
QR scanning: WebApp.showScanQrPopup() (for merchant redemption)
Storage:     CloudStorage for client state, PostgreSQL for everything else
Notifications: Bot API sendMessage for gift received/redeemed/expiring
```

### Bot Service (Minimal, for MVP)

Even though the plan says "no bot service," you need a lightweight one to handle:
1. `pre_checkout_query` — respond to payment verification (required within 10s)
2. `successful_payment` — process completed payments
3. Sending notification messages (gift received, etc.)

This can be a simple webhook handler in your Next.js API routes:

```typescript
// app/api/telegram-webhook/route.ts
export async function POST(request: Request) {
  const update = await request.json();

  if (update.pre_checkout_query) {
    await answerPreCheckoutQuery(update.pre_checkout_query);
  }

  if (update.message?.successful_payment) {
    await processPayment(update.message.successful_payment);
  }

  return Response.json({ ok: true });
}
```

No separate bot server needed — just webhook endpoints in your existing Next.js app.

---

## 13. Development & Testing

### Local Development

1. Create bot via @BotFather
2. Register Mini App URL as `https://127.0.0.1:3000`
3. Run Next.js with HTTPS: generate self-signed certs or use `mkcert`
4. Open bot in Telegram → Menu Button → your TMA loads

### Testing Outside Telegram

The official Next.js template includes `useTelegramMock` for simulating the Telegram environment in a regular browser. Use this for rapid UI iteration, but always test in real Telegram before deploying.

### Platform Testing Checklist

- [ ] Telegram Android (most users in Uzbekistan)
- [ ] Telegram iOS
- [ ] Telegram Desktop
- [ ] Test with `WebApp.platform` to identify client
- [ ] Test QR scanner on both Android and iOS
- [ ] Test `openInvoice()` with Click test mode
- [ ] Test `shareMessage()` and fallback share flow
- [ ] Test viewport behavior with keyboard open/close
- [ ] Test back button navigation

---

**Sources:**
- [Official Telegram Mini Apps Documentation](https://core.telegram.org/bots/webapps)
- [Community Mini Apps Documentation](https://docs.telegram-mini-apps.com/)
- [Bot API Changelog](https://core.telegram.org/bots/api-changelog)
- [Telegram Mini Apps GitHub](https://github.com/telegram-mini-apps)
- [Next.js TMA Template](https://github.com/Telegram-Mini-Apps/nextjs-template)
- [Click Telegram Payments Docs](https://docs.click.uz/en/telegram-payments/)
- [Telegram Bot Payments API](https://core.telegram.org/bots/payments)
- [Mini Apps Platform Methods](https://docs.telegram-mini-apps.com/platform/methods)
- [Init Data Documentation](https://docs.telegram-mini-apps.com/platform/init-data)
- [Habr: TMA Limitations Overview](https://habr.com/en/articles/990338/)
- [iSettle Telegram Bot Payments](https://isettlepay.com/payment-methods/telegram-bot-payments)

**Last Updated:** 2026-02-21
