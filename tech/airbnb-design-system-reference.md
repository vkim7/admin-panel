# Airbnb Design System Reference

Research compiled for Loop's color palette and UI design decisions.

---

## Color Palette

### Named Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Rausch** | `#FF5A5F` | Legacy brand accent (named after 19 Rausch Street, SF) |
| **Current brand** | `#FF385C` | Current primary brand pink-red |
| **Babu** | `#00A699` | Links, secondary highlights, teal accent |
| **Arches** | `#FC642D` | Warm orange accent, tertiary |
| **Hof** | `#484848` | Primary body text |
| **Foggy** | `#767676` | Secondary/muted text, captions |

### Production Tokens

| Token | Hex | Contrast | Usage |
|-------|-----|----------|-------|
| Primary text | `#222222` | 15.9:1 | Headlines, primary body text |
| Secondary text | `#717171` | 4.88:1 | Captions, secondary info |
| Disabled text | `#AAAAAA` | — | Disabled states |
| Destructive text | `#8F2A14` | — | Error/destructive actions |
| Inverse text | `#FFFFFF` | — | Text on dark/colored backgrounds |
| Background | `#FFFFFF` | — | Page background |
| Background secondary | `#F7F7F7` | — | Section backgrounds |
| Background disabled | `#DDDDDD` | — | Disabled elements |
| Border | `#EBEBEB` | — | Dividers, card borders |
| Border medium | `#B0B0B0` | — | Input field borders |
| Success | `#008A05` | — | Success states |
| Error | `#C13515` | — | Error states |

### How the Accent Is Used (Extremely Sparingly)

**Where it appears:**
- Primary CTA button ("Reserve", "Request to Book") — and this is a **gradient**, not flat
- The logo/Belo mark
- Heart/favorite icons (when active)
- Price highlights (rare)

**Where it does NOT appear:**
- Navigation (no colored nav bars, no red active states)
- Headers/titles (always `#222222`)
- Cards (no colored borders or backgrounds)
- Sidebar/menu items
- Badges or status pills
- Section backgrounds
- Table rows or data
- Secondary buttons
- Links (these use Babu teal or underlined dark text)

The ratio is roughly **95% neutral, 5% accent**.

---

## Buttons

### Primary CTA (the only accent moment)
```css
background: linear-gradient(to right, #E61E4D, #E31C5F, #D70466);
color: #FFFFFF;
font-size: 16px;
font-weight: 600;
border: none;
border-radius: 8px;
padding: 14px 24px;
```
- On hover: radial-gradient tracking effect that follows mouse cursor
- Full-width on mobile, auto-width on desktop

### Secondary / Outline
```css
background: transparent;
color: #222222;
border: 1px solid #222222;  /* dark, NOT colored */
border-radius: 8px;
font-size: 14px;
font-weight: 600;
padding: 10px 16px;
```

### Tertiary / Dark
```css
background: #222222;
color: #FFFFFF;
border: none;
border-radius: 8px;
font-size: 14px;
font-weight: 600;
padding: 10px 16px;
```

### Disabled
```css
background: #DDDDDD;
color: #AAAAAA;
border: none;
border-radius: 8px;
cursor: not-allowed;
```

**Key rule:** Secondary buttons are always black-outlined on white. There is no "accent-colored secondary" in Airbnb's system.

---

## Cards

Airbnb listing cards are a masterclass in restraint:

```css
/* Card container */
background: #FFFFFF;
border: none;           /* NO border */
border-radius: 0;       /* Card itself has no rounding */
box-shadow: none;        /* NO shadow */
padding: 0;

/* Card image */
border-radius: 12px;    /* Only the IMAGE is rounded */
aspect-ratio: 1 / 1;    /* Square for grid view */
object-fit: cover;

/* Card content */
padding-top: 8px;        /* Tight spacing below image */
```

- No card container styling: no border, no shadow, no background
- The image IS the visual container
- Heart/save button overlaid on top-right with subtle backdrop
- **No colored banners, no accent labels, no "featured" highlights**
- On hover, carousel arrows appear (hidden by default)

### Card Text Hierarchy
```css
/* Title (location) */
font-size: 15px; font-weight: 600; color: #222222;

/* Subtitle (distance, dates) */
font-size: 15px; font-weight: 400; color: #717171;

/* Price */
font-size: 15px; font-weight: 600; color: #222222;
/* "night" suffix in weight 400 */
```

---

## Typography

### Font
```css
font-family: 'Airbnb Cereal VF', Circular, -apple-system, BlinkMacSystemFont,
             Roboto, Helvetica Neue, sans-serif;
```

Cereal weights: Light (300), Book (400), Medium (500), Bold (600/700), Extra Bold (800), Black (900).

### Scale

| Level | Size | Line Height | Weight | Color | Usage |
|-------|------|-------------|--------|-------|-------|
| Page title | 32px | 36px | 800 | `#222222` | Sheet/page titles |
| Section header | 22–24px | 28px | 600–700 | `#222222` | Section headings |
| Card title | 16px | 20px | 600 | `#222222` | Listing names, row headers |
| Body 1 | 16px | 24px | 400 | `#222222` | Primary body text |
| Body 2 / Button | 14px | 18px | 400 or 600 | `#222222` or `#717171` | Secondary text, buttons |
| Caption | 12px | 16px | 400 | `#717171` | Timestamps, fine print |
| Micro | 10px | 14px | 400 | `#717171` | Legal, footnotes |

### How Emphasis Is Created WITHOUT Color
- **Weight contrast**: 400 vs 600 vs 800 — the primary differentiator
- **Size stepping**: 32 > 22 > 16 > 14 > 12 — each step clearly distinct
- **Color contrast**: just two text grays — `#222222` (primary) vs `#717171` (secondary)
- **Letter-spacing**: headings at `-0.01em` (tighter), captions at `0.02em` (looser)
- Color is almost NEVER used for text emphasis

---

## Navigation

### Top Navigation Bar (not sidebar)
```css
background: #FFFFFF;
border-bottom: 1px solid #EBEBEB;
padding: 0 24px;        /* or 0 80px on wide screens */
height: 80px;
position: sticky; top: 0;
```

### Nav Item States
```css
/* Inactive */
color: #717171;
font-size: 12px; font-weight: 600;
border-bottom: 2px solid transparent;

/* Active */
color: #222222;                    /* dark, NOT accent */
border-bottom: 2px solid #222222;  /* dark underline, NOT red */
```

**Key rules:**
- No dark sidebar anywhere in Airbnb's product
- No accent-colored active states — active = `#222222`
- Always white background
- Separation via subtle `1px solid #EBEBEB` border

---

## Spacing (8px Base Grid)

All spacing values are multiples of 8:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 8px | Tight internal (icon-to-label, card image-to-text) |
| sm | 16px | Standard internal padding, form field gaps |
| base | 24px | Section dividers, comfortable breathing room |
| lg | 48px | Section-to-section spacing |
| xl | 64px | Major section breaks |

### Specific Patterns
```css
/* Card gaps */
gap: 24px (horizontal), margin-bottom: 40px (between rows)

/* Page margins */
padding: 0 24px (mobile), 0 40px (tablet), 0 80px (desktop)

/* Section dividers */
padding: 24px 0; border-bottom: 1px solid #EBEBEB;

/* Form fields */
gap: 16px (between fields), margin-bottom: 24px (between groups)
```

Density philosophy: **generous whitespace**. Wide margins (80px desktop), spacious grids (24px gaps), clear section separation (48–64px). Content density is LOW.

---

## Borders and Shadows

### Borders
```css
/* Standard divider */
border: 1px solid #EBEBEB;        /* very light, barely visible */

/* Input field */
border: 1px solid #B0B0B0;
border-radius: 8px;

/* Input focus */
border: 2px solid #222222;         /* dark, NOT accent-colored */
border-radius: 8px;

/* Cards */
border: none;                      /* cards have NO border */
```

### Shadows
```css
/* Search bar / floating */
box-shadow: 0 1px 2px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05);

/* Modal / overlay */
box-shadow: 0 2px 16px rgba(0,0,0,0.12);

/* Dropdown / popover */
box-shadow: 0 2px 8px rgba(0,0,0,0.08);

/* Sticky header on scroll */
box-shadow: 0 2px 4px rgba(0,0,0,0.06);

/* Cards */
box-shadow: none;   /* listing cards have NO shadow */
```

Key: shadows are always soft/diffuse (large blur, low opacity 0.05–0.12). Never colored. Cards get no shadow at all.

---

## Badges and Pills

### Guest Favorite
```css
background: #FFFFFF;
border: 1px solid #DDDDDD;
border-radius: 24px;
padding: 4px 8px;
font-size: 12px; font-weight: 600; color: #222222;
```

### Superhost
```css
background: transparent;
border: 1px solid #222222;
border-radius: 4px;
padding: 4px 8px;
font-size: 12px; font-weight: 600; color: #222222;
```

### Rating Star
- Star icon is **filled black**, not gold/yellow
- Format: star icon + "4.92" — minimalist, no background

**Key rule:** Badges are monochrome. No bright colored backgrounds. No accent-colored badges in normal UI.

---

## Progress Indicators

### Carousel Dots
```css
/* Inactive */
width: 6px; height: 6px; border-radius: 50%;
background: rgba(255,255,255,0.6);

/* Active */
background: #FFFFFF;
```

### Booking Flow
- Horizontal bar/stepper at top
- Completed steps = solid dark line
- No numbered steps, no colored progress bars
- Extremely minimal — just thin lines

### Loading
```css
/* Skeleton */
background: #EBEBEB; border-radius: 8px;
animation: pulse 1.5s ease-in-out infinite;

/* Spinner */
border: 2px solid #DDDDDD;
border-top: 2px solid #222222;  /* dark, NOT accent */
border-radius: 50%;
```

---

## Border Radius Language

| Element | Radius |
|---------|--------|
| Interactive (buttons, inputs) | `8px` |
| Containers (cards, modals) | `12px` |
| Media (images) | `12px` |
| Pills (badges, tags) | `24px` (fully rounded) |
| Never | Sharp `0px` corners or overly round `20px+` on non-pills |

---

## What Makes It "Feel Like Airbnb"

1. **Extreme color restraint** — 95% grayscale. Accent only on primary CTA. Photography provides color.
2. **Weight-based hierarchy** — Emphasis via font-weight (400/600/800) and size, never color.
3. **Generous whitespace** — 80px page margins, 24px card gaps, 48–64px section spacing. Low density.
4. **No card chrome** — Cards have no border, no shadow, no container. Images are the visual element.
5. **Soft shadows** — Barely perceptible (`rgba(0,0,0, 0.05–0.12)`). Used only on elevated elements.
6. **Gradient CTA is signature** — The pink-to-red gradient button with mouse-tracking glow is the one "rich" visual moment. It pops because everything else is restrained.
7. **Dark is not dark** — No dark sidebars, headers, or cards. Even active states use `#222222` text/underline, not colored highlights.
8. **Borders are nearly invisible** — `#EBEBEB` at 1px. Structure without visual noise.
9. **8px base grid** — Everything aligns to multiples of 8.
10. **Two text colors only** — `#222222` (primary) and `#717171` (secondary). That's it.
