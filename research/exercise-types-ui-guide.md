# Interactive Learning Exercise Types: Mobile-First UI/UX Implementation Guide
## For Telegram Mini App Context

---

## Table of Contents

1. [General Mobile Learning UX Foundations](#1-general-mobile-learning-ux-foundations)
2. [Telegram Mini App Constraints](#2-telegram-mini-app-constraints)
3. [Duolingo Exercise Screen Anatomy](#3-duolingo-exercise-screen-anatomy)
4. [Exercise Type 1: Fill-in-the-Blank / Cloze](#4-fill-in-the-blank--cloze-exercises)
5. [Exercise Type 2: Multiple Choice](#5-multiple-choice)
6. [Exercise Type 3: Matching](#6-matching-exercises)
7. [Exercise Type 4: Sentence Building / Word Ordering](#7-sentence-building--word-ordering)
8. [Exercise Type 5: Dictation / Listen-and-Type](#8-dictation--listen-and-type)
9. [Exercise Type 6: Translation](#9-translation-exercises)
10. [Exercise Type 7: Listening Comprehension](#10-listening-comprehension)
11. [Exercise Type 8: Flashcard / Spaced Repetition Review](#11-flashcard--spaced-repetition-review)
12. [Exercise Type 9: Image-Based Exercises](#12-image-based-exercises)
13. [Exercise Type 10: Error Correction](#13-error-correction-exercises)
14. [Exercise Type 11: Drag-and-Drop Categorization](#14-drag-and-drop-categorization)
15. [Exercise Type 12: Audio Recording / Speaking](#15-audio-recording--speaking)
16. [Transitions, Progress, and Celebrations](#16-transitions-progress-and-celebrations)
17. [Dark Mode Considerations](#17-dark-mode-considerations)
18. [Offline Capability](#18-offline-capability)

---

## 1. General Mobile Learning UX Foundations

### Touch Target Sizes

| Standard | Minimum Size | Notes |
|----------|-------------|-------|
| WCAG 2.1 AAA (2.5.5) | 44x44 CSS px | Required for accessibility |
| WCAG 2.2 AA (2.5.8) | 24x24 CSS px minimum | With adequate spacing |
| Apple HIG | 44x44 pt | Recommended for all controls |
| Material Design | 48x48 dp | Google's recommendation |
| **Recommended for TMA** | **48x48 CSS px** | With 8px spacing between targets |

### Thumb Zone Design

The bottom 40% of the screen is the "natural" thumb zone -- the area most easily reachable with one hand. Key principles:

- **Primary actions** (Check, Continue, Submit) -- always at bottom of screen
- **Secondary actions** (Skip, Hint) -- mid-screen or top corners
- **Destructive actions** (Close, Quit) -- top-left corner (hardest to reach accidentally)
- **Center of screen** -- highest precision area; use for answer selection
- **Screen edges** -- lowest precision; increase padding/target sizes here

### Scroll vs. Pagination

| Approach | Use When | Avoid When |
|----------|----------|------------|
| **Pagination** (one exercise per screen) | Exercise fits in viewport; focused task | Content needs comparison |
| **Vertical scroll** | Long reading passages; lists of options | Drag-and-drop exercises (conflicts with scroll) |
| **No scroll** (fixed layout) | Most exercise types; prevents accidental scroll | Content is variable-length and may overflow |

**Recommendation for TMA**: Use fixed-layout pagination. One exercise per screen. No scrolling within an exercise. The "Check" button is always visible and always at the bottom.

---

## 2. Telegram Mini App Constraints

### What You Have

- **WebView** rendering (essentially a mobile web app inside Telegram)
- **Touch events**: tap, long-press, basic scroll. No native swipe gestures
- **Theme API**: Access to user's Telegram theme (light/dark, accent colors)
- **Safe area insets**: Both system (notch, nav bar) and Telegram-specific (header)
- **Viewport events**: Notification when viewport size changes
- **Haptic feedback API**: `HapticFeedback.impactOccurred()`, `notificationOccurred()`, `selectionChanged()`
- **Back button**: Telegram provides a back button in the header
- **Main button**: A single prominent button at the bottom of the screen (customizable text and color)

### What You Do NOT Have

- **Native gesture recognizers** (no swipe-to-dismiss, no pinch-to-zoom beyond browser default)
- **Reliable drag-and-drop** (must implement via touch events; conflicts with scroll)
- **Reliable Service Workers on iOS** (offline support is limited)
- **Background audio** (audio stops when app is minimized)
- **Native keyboard control** (virtual keyboard behavior is browser-dependent)
- **Viewport stability with keyboard** (iOS has known bugs where viewport height doesn't update when keyboard opens)

### Safe Area Handling

```
padding-top: max(env(safe-area-inset-top), var(--tg-content-safe-area-inset-top));
padding-bottom: max(env(safe-area-inset-bottom), var(--tg-content-safe-area-inset-bottom));
```

### Practical Layout Envelope

On a typical phone (375x667 logical px, iPhone SE-sized):
- Telegram header: ~56px
- Safe area top: 0-44px (notch)
- Safe area bottom: 0-34px (home indicator)
- **Usable height**: ~530-575px
- **Usable width**: 375px (full width)

On larger phones (390x844, iPhone 14-sized):
- **Usable height**: ~700-750px

**Design for the smallest case. Ensure all exercises work in 375x530px.**

---

## 3. Duolingo Exercise Screen Anatomy

Every Duolingo exercise screen follows a consistent layout. This is the gold standard to emulate.

```
+------------------------------------------+
| [X Close]   [======Progress Bar=====]    |  <- Top bar (fixed)
|              [Hearts: 3]                 |
+------------------------------------------+
|                                          |
|  [Instruction text]                      |  <- Prompt area
|  "Translate this sentence"               |
|                                          |
|  [Speaker icon] "El gato es negro"       |  <- Source content
|                                          |
+------------------------------------------+
|                                          |
|  [Answer area]                           |  <- Interactive zone
|  [_____] [_____] [_____]                |  (varies by exercise)
|                                          |
|  [word] [word] [word] [word] [word]      |  <- Word bank (if applicable)
|                                          |
+------------------------------------------+
|                                          |
|  [ CHECK ]                               |  <- Primary action (fixed bottom)
|                                          |
+------------------------------------------+
```

### Key Elements (Always Visible)

1. **Close button** (top-left): X icon, exits lesson with confirmation dialog
2. **Progress bar** (top-center): Horizontal bar that fills left-to-right as exercises are completed
3. **Hearts/lives** (top-right): Shows remaining attempts (optional for non-gamified apps)
4. **Instruction text**: Brief, clear instruction ("Translate this sentence", "Select the correct answer")
5. **Source content**: The prompt -- sentence, audio player, image
6. **Answer area**: Where the user constructs or selects their answer
7. **CHECK button**: Fixed at bottom. Disabled/gray until user makes a selection. Turns green when active

### Feedback Overlay (After Checking)

```
+------------------------------------------+
|                                          |
|  [Exercise content stays visible]        |
|                                          |
+==========================================+
| [Green/Red bar]                          |  <- Slides up from bottom
| "Correct!" or "Incorrect"               |
| [Correct answer shown if wrong]          |
| [Brief explanation / "Meaning: ..."]     |
|                                          |
|  [ CONTINUE ]                            |
+------------------------------------------+
```

- **Correct**: Green background, checkmark icon, sound effect (short "ding"), brief haptic
- **Incorrect**: Red/orange background, X icon, sound effect (short "buzz"), shows correct answer
- The feedback panel slides up from the bottom, covering the lower ~30% of the screen
- The exercise content remains visible above so the user can compare
- "CONTINUE" button replaces "CHECK" in the same position

---

## 4. Fill-in-the-Blank / Cloze Exercises

### Interaction Pattern

A sentence is displayed with one or more words replaced by a blank (underline or highlighted gap). The user fills in the missing word(s).

### Three Implementation Variants

#### Variant A: Word Bank (Tap to Fill) -- RECOMMENDED for TMA

```
"The cat ___ on the mat."

[sat] [run] [is] [sleeping]     <- tap one to fill the blank
```

**How it works:**
1. Sentence displayed with blank(s) indicated by underlined space or colored placeholder
2. Word bank appears below with 3-6 options (one correct, rest are distractors)
3. User taps a word -- it animates up into the blank position (150ms ease-out)
4. If the blank is already filled, tapping a new word swaps it (old word returns to bank)
5. Tapping the filled word in the sentence sends it back to the bank
6. CHECK button activates once all blanks are filled

**Used by:** Duolingo ("Select the missing word"), Busuu, Babbel

#### Variant B: Type-to-Fill (Free Text Input)

```
"The cat ___ on the mat."

[________________]     <- text input field, focused
```

**How it works:**
1. Sentence with blank displayed
2. Single-line text input appears, auto-focused (keyboard opens)
3. User types the answer
4. CHECK button activates when input is non-empty
5. Answer is checked with fuzzy matching (allow minor typos, ignore case)

**Used by:** Duolingo ("Complete the translation"), Busuu, Clozemaster

**TMA consideration:** Keyboard opening pushes content up. Pre-scroll so the blank and input remain visible. Watch for iOS viewport bug.

#### Variant C: Dropdown Select

```
"The cat [sat ▼] on the mat."
```

**How it works:**
1. Blank is replaced by a dropdown/select element
2. Tapping opens a bottom sheet (not native `<select>`) with 3-5 options
3. User selects one; dropdown closes and shows selection

**Used by:** Some Skyeng homework exercises, academic quiz platforms

**Not recommended for TMA:** Native selects look different per OS; custom bottom sheet adds complexity for minimal UX gain over word bank.

### Best Implementation for TMA

**Use Variant A (Word Bank)** as default. Use Variant B (Type-to-Fill) for advanced learners or when testing active recall is important.

### Layout Specification

```
+------------------------------------------+
| [X]  [==========------]                 |
+------------------------------------------+
|                                          |
|  Fill in the blank                       |
|                                          |
|  "I ___ to the store yesterday."         |
|        ^                                 |
|     [highlighted gap, 60px min-width]    |
|                                          |
+------------------------------------------+
|                                          |
|  [went]  [go]  [gone]  [going]          |  48px height, 12px gap
|                                          |
+------------------------------------------+
|                                          |
|  [        CHECK        ]                |  full-width, 48px height
+------------------------------------------+
```

### Feedback

- **Correct**: Gap turns green, correct word shown in bold. Sound: ding.
- **Incorrect**: Gap turns red, shows user's wrong answer struck-through, correct answer shown in green below. Sound: buzz.
- Bottom panel slides up with explanation (e.g., "Use past simple 'went' for completed actions in the past").

### Accessibility

- Word bank buttons have `role="button"` and clear `aria-label` (e.g., "Select 'went'")
- Filled blank announces "You selected 'went'" via `aria-live="polite"`
- Color coding supplemented by icons (checkmark/X) and text labels for color-blind users
- Minimum contrast 4.5:1 for gap text

---

## 5. Multiple Choice

### Interaction Pattern

A question or prompt is displayed. The user selects one (or more) answer(s) from a list of options.

### Variant A: Single Select (Most Common)

**Used by:** All major apps (Duolingo, Babbel, Busuu, Memrise, Skyeng)

```
+------------------------------------------+
| [X]  [==========------]                 |
+------------------------------------------+
|                                          |
|  What does "gato" mean?                  |
|                                          |
+------------------------------------------+
|                                          |
|  +------------------------------------+ |
|  |  (o) Cat                           | |  <- Radio-style, full width
|  +------------------------------------+ |
|  |  ( ) Dog                           | |  56px min-height per option
|  +------------------------------------+ |
|  |  ( ) Bird                          | |
|  +------------------------------------+ |
|  |  ( ) Fish                          | |
|  +------------------------------------+ |
|                                          |
+------------------------------------------+
|  [        CHECK        ]                |
+------------------------------------------+
```

**Interaction flow:**
1. User taps an option -- it gets a colored border/highlight (blue or brand color)
2. Tapping a different option deselects the previous one
3. CHECK button activates on first selection
4. After CHECK: correct option turns green, incorrect turns red

**Preventing accidental taps:**
- Do NOT auto-advance on tap. Always require explicit CHECK button press
- Minimum 56px height per option with 8px gap
- Allow re-selection before checking (user can change mind)
- Add subtle haptic on selection (`selectionChanged()`)

### Variant B: Multi-Select

```
  +------------------------------------+
  |  [x] Statement A                   |
  +------------------------------------+
  |  [ ] Statement B                   |
  +------------------------------------+
  |  [x] Statement C                   |
  +------------------------------------+
```

**Differences from single-select:**
- Checkbox visual instead of radio button
- Instruction says "Select ALL correct answers"
- Multiple items can be highlighted simultaneously
- CHECK button activates when at least one is selected

**Used by:** Busuu (in comprehension questions), Skyeng (in grammar exercises)

### Answer Layout Options

| Layout | Use When | Example |
|--------|----------|---------|
| **Vertical stack** (full-width cards) | Text answers, 3-5 options | Default for most MC |
| **2x2 grid** | Image-based answers, short text (1-3 words) | "Select the picture" |
| **Horizontal chips** | Very short answers (single words, True/False) | "Is this correct?" |

**Recommendation for TMA:** Vertical stack for text. 2x2 grid for images. Avoid horizontal layout for more than 2-3 options.

### Feedback Display

**Correct answer selected:**
```
+------------------------------------+
|  [check icon] Cat        [GREEN]   |  <- Green border + green fill (light)
+------------------------------------+
|  Dog                               |  <- Dimmed/grayed
+------------------------------------+
```

**Incorrect answer selected:**
```
+------------------------------------+
|  [x icon] Dog            [RED]     |  <- Red border + red fill (light)
+------------------------------------+
|  [check icon] Cat        [GREEN]   |  <- Correct answer highlighted
+------------------------------------+
|  Bird                              |  <- Dimmed
+------------------------------------+
```

- The bottom feedback panel slides up with the explanation
- Incorrect option stays visible with strikethrough or red background
- Correct option is always revealed with green highlight

### Accessibility

- Options use `role="radio"` (single) or `role="checkbox"` (multi)
- Selected state announced: "Cat, selected"
- After check: "Correct, the answer is Cat" or "Incorrect, you selected Dog. The correct answer is Cat"
- Don't rely solely on color. Use icons (checkmark, X) and text

---

## 6. Matching Exercises

### Interaction Pattern

Two sets of items (e.g., words in L1 and L2) must be paired correctly.

### Variant A: Tap-to-Match (Two Columns) -- RECOMMENDED for TMA

**Used by:** Duolingo ("Tap the pairs"), Memrise

```
+------------------------------------------+
| [X]  [==========------]                 |
+------------------------------------------+
|                                          |
|  Match the pairs                         |
|                                          |
|   [cat]          [gato]                 |
|   [dog]          [perro]                |
|   [bird]         [pajaro]               |
|   [fish]         [pez]                  |
|   [house]        [casa]                 |
|                                          |
+------------------------------------------+
|  Matched: 0/5                           |
+------------------------------------------+
```

**Interaction flow:**
1. Two columns of items displayed (left = L1, right = L2, or mixed)
2. User taps an item in either column -- it highlights (blue border)
3. User taps an item in the other column:
   - **Match correct**: Both items flash green, then fade out (or move to a "matched" area). Sound: ding. Haptic: success.
   - **Match incorrect**: Both items flash red, deselect. Sound: buzz. Haptic: error.
4. User can tap the same highlighted item to deselect it
5. Exercise completes when all pairs are matched

**Why this works in TMA:** No drag-and-drop needed. Pure tap interactions. Works perfectly in WebView.

### Variant B: Drag-and-Drop Matching

**NOT recommended for TMA.** Reasons:
- Touch drag conflicts with page scroll in WebView
- Requires careful long-press detection (>300ms hold to initiate drag)
- Drop target precision is low on small screens
- No accessibility fallback without significant extra work

### Variant C: Sequential Selection (Simplified)

For smaller screens or more items:
```
Select all items that mean "big":
[grande] [alto] [pequeno] [enorme] [bajo]
```
User taps all correct matches. This is essentially multi-select MC.

### Layout Specification

```
+------------------------------------------+
|                                          |
|  [cat    ]     [gato   ]                |  Each item: min 48px height
|                                          |  12px gap between rows
|  [dog    ]     [perro  ]                |  8px gap between columns
|                                          |
|  [bird   ]     [pajaro ]                |  Items have border-radius: 12px
|                                          |  Padding: 12px 16px
|  [fish   ]     [pez    ]                |
|                                          |
|  [house  ]     [casa   ]                |
|                                          |
+------------------------------------------+
```

- Max 5-6 pairs per exercise (screen real estate constraint)
- If more pairs needed, split into multiple exercises
- Randomize the order of the right column so items are not aligned with their matches

### States for Each Item

| State | Visual |
|-------|--------|
| Default | White/light background, dark text, subtle border |
| Selected (first tap) | Blue/brand border, light blue background |
| Matched correctly | Green background (brief flash), then fades out or shows checkmark |
| Matched incorrectly | Red flash (200ms), returns to default |
| Completed | Grayed out, checkmark overlay |

### Feedback

- No bottom panel needed. Feedback is inline (green/red flash on the items)
- After all pairs matched: brief celebration (confetti optional), auto-advance after 1s delay

### Accessibility

- Items are `role="button"` with `aria-label` including both the text and position
- Announce selected item: "Selected 'cat'. Now select its match."
- Announce match result: "Correct match: cat and gato" or "Incorrect match"
- Provide a fallback sequential selection mode for screen readers

---

## 7. Sentence Building / Word Ordering

### Interaction Pattern

A sentence in the source language is shown. The user must construct the translation by tapping words from a shuffled word bank in the correct order.

**Used by:** Duolingo ("Arrange all the words" / "Sentence shuffle"), Busuu

### Primary Implementation: Tap-to-Build -- RECOMMENDED for TMA

```
+------------------------------------------+
| [X]  [==========------]                 |
+------------------------------------------+
|                                          |
|  Translate this sentence                 |
|  [speaker] "The black cat is sleeping"   |
|                                          |
+------------------------------------------+
|  ANSWER AREA:                            |
|  +------------------------------------+ |
|  | [El] [gato] [negro] [___] [___]    | |  <- lined area, words snap in
|  +------------------------------------+ |
|                                          |
+------------------------------------------+
|  WORD BANK:                              |
|  [esta] [durmiendo] [perro]             |
|  [el] [blanco]                           |  <- remaining words
|                                          |
+------------------------------------------+
|  [        CHECK        ]                |
+------------------------------------------+
```

**Interaction flow:**
1. Source sentence shown at top with optional audio
2. Answer area: horizontal lines (like ruled paper) where words will land
3. Word bank: shuffled words displayed as chips/pills below the answer area
4. User taps a word in the bank -> it animates (150ms) from bank to the next empty slot in the answer area
5. User taps a word in the answer area -> it animates back to the bank, and remaining answer words slide left to fill the gap
6. Words in the bank that have been placed show as empty/ghost placeholders
7. CHECK activates when all available positions are filled (or when word bank is empty)

**Key detail:** The word bank may contain distractors (extra words not needed for the correct answer). This prevents users from solving by elimination.

### Handling Long Sentences on Small Screens

This is the biggest challenge for this exercise type:

1. **Word bank wrapping**: Words flow left-to-right, wrapping to multiple rows. Use `flex-wrap: wrap` with 8px gap. Word chips should be auto-width based on text length.

2. **Answer area wrapping**: The answer area should also allow wrapping to 2-3 lines. Use a minimum height of 2 lines (~100px) to prevent jarring layout shifts.

3. **Scrollable answer area**: If the sentence is very long (>8 words), make only the answer area scrollable within its container, not the whole screen.

4. **Font size**: Use 16px minimum for words. Do not shrink text to fit.

5. **Maximum words**: Cap at 10-12 words per exercise. For longer sentences, use partial sentence building (provide some words pre-filled).

### Word Chip Design

```
+------------------+
| durmiendo        |   height: 40-44px
+------------------+   padding: 8px 16px
                       border-radius: 8px
                       background: white
                       border: 2px solid #e0e0e0
                       font-size: 16px
                       min-width: fit-content
```

States:
- **In bank (default)**: Light background, border
- **In bank (placed)**: Ghost/dimmed placeholder (shows where word came from)
- **In answer area**: Slightly different background (light blue/brand tint), solid border
- **Correct (after check)**: Green background
- **Incorrect (after check)**: Red background on misplaced words; correct order shown

### Feedback

- After CHECK, each word in the answer area lights up green (correct position) or red (wrong position)
- Bottom panel slides up showing the complete correct sentence
- If incorrect: the correct arrangement is displayed below the user's attempt for comparison

### Accessibility

- Word bank and answer area are both `role="list"` with items as `role="listitem"`
- Each word chip is `role="button"` with `aria-label` including position: "Word 3 of 8: negro"
- Announce placement: "Placed 'gato' in position 2"
- Announce removal: "Removed 'gato' from answer, returned to word bank"

---

## 8. Dictation / Listen-and-Type

### Interaction Pattern

An audio clip plays a sentence. The user must type what they hear.

**Used by:** Duolingo ("Type what you hear"), Babbel, Busuu, Skyeng

### Full Dictation

```
+------------------------------------------+
| [X]  [==========------]                 |
+------------------------------------------+
|                                          |
|  Type what you hear                      |
|                                          |
|  +------------------------------------+ |
|  |     [SPEAKER ICON]                 | |  <- Large tap target (64x64)
|  |     [Tap to replay]               | |
|  |     [Turtle icon = slow speed]     | |
|  +------------------------------------+ |
|                                          |
+------------------------------------------+
|                                          |
|  [__________________________________ ]  |  <- Auto-focused text input
|  [__________________________________ ]  |     multi-line for sentences
|                                          |
+------------------------------------------+
|  [        CHECK        ]                |
+------------------------------------------+
```

**Interaction flow:**
1. Audio auto-plays once when exercise loads
2. Large speaker icon (64x64px minimum) for replay. Tap = replay at normal speed.
3. Turtle/slow icon: replay at 0.7x speed (Duolingo uses this)
4. Text input auto-focuses, keyboard opens
5. User types what they heard
6. CHECK activates when input is non-empty

### Audio Player UI

```
+------------------------------------+
|                                    |
|         [Speaker Icon]             |   64x64px, centered
|            ))) or |>               |
|                                    |
|   [Normal speed]  [Slow speed]     |   Two buttons, 44px height each
|                                    |
+------------------------------------+
```

- **No progress bar needed** for short audio clips (< 5 seconds)
- **Add progress bar** for longer clips (> 5 seconds) -- thin line below the speaker icon
- Replay count: unlimited in practice, limited in tests (e.g., max 3 replays in Duolingo English Test)
- Visual pulse animation on the speaker icon while audio is playing

### Partial Dictation (Gap Fill + Audio)

```
+------------------------------------------+
|  Type what you hear                      |
|                                          |
|  [Speaker icon]                          |
|                                          |
|  "The students ___ to the ___            |
|   every morning."                        |
|                                          |
|  Gap 1: [________]                       |
|  Gap 2: [________]                       |
|                                          |
+------------------------------------------+
|  [        CHECK        ]                |
+------------------------------------------+
```

- Sentence is partially shown with blanks for key words
- User listens and types only the missing words
- Input fields are inline or listed below the sentence
- Each input should have a numbered label matching the gap

### Answer Diff Display (After Checking)

For full dictation, show a character-level diff:

```
Your answer:   The cat is sleep on the mat
Correct answer: The cat is sleeping on the mat
                           ^^^
                        [missing: "ing"]
```

Implementation:
- Use green text for correct parts
- Use red strikethrough for wrong parts
- Use green underline for missing parts
- Show the diff inline, not as two separate lines

For partial dictation:
- Each gap shows green (correct) or red (incorrect) with the correct answer below

### TMA Keyboard Considerations

- On iOS, viewport height may not update when keyboard opens
- Use `visualViewport` API to detect keyboard presence and adjust layout
- Scroll the input field into view when keyboard opens
- Consider using `position: fixed` for the CHECK button and adjusting its bottom position when keyboard is visible

```javascript
window.visualViewport.addEventListener('resize', () => {
  const keyboardHeight = window.innerHeight - window.visualViewport.height;
  checkButton.style.bottom = keyboardHeight + 'px';
});
```

### Feedback

- Correct: Green highlight on all text, "Perfect!" or "Correct!"
- Minor typo: Yellow/orange, "Almost correct! You made a typo" -- still marked as correct
- Incorrect: Red text on wrong words, correct answer shown below
- Bottom panel with explanation (e.g., grammar note)

### Accessibility

- Audio auto-play should be toggleable in settings (some users use screen readers)
- Provide text alternative or transcript toggle for deaf/HoH users
- Replay buttons clearly labeled: "Play audio" and "Play audio slowly"
- Input field has `aria-label="Type what you hear"`

---

## 9. Translation Exercises

### Interaction Pattern

A sentence in one language is shown. The user translates it into the other language.

### L2 -> L1 (Target to Native): Easier

Typically done with word bank, since the user constructs in their native language.

```
Translate to English:
[speaker] "El gato negro esta durmiendo"

[The] [black] [cat] [is] [sleeping]  <- word bank
```

This is identical to Sentence Building (Section 7). Use the same implementation.

### L1 -> L2 (Native to Target): Harder

Two variants:

#### Variant A: Word Bank

Same as L2->L1 but word bank is in target language. Good for beginners/intermediate.

#### Variant B: Free Text Input -- RECOMMENDED for Advanced

```
+------------------------------------------+
|  Translate to Spanish:                   |
|  "The black cat is sleeping"             |
|                                          |
|  [__________________________________ ]  |
|  [__________________________________ ]  |
|                                          |
+------------------------------------------+
|  [        CHECK        ]                |
+------------------------------------------+
```

### Handling Multiple Correct Answers

This is the critical challenge for free-text translation.

**Backend approach:**
1. Store 2-5 accepted translations per sentence
2. Use fuzzy matching: normalize whitespace, ignore case, allow equivalent punctuation
3. Use a "meaning-equivalent" check: accept word order variations that are semantically correct
4. For articles/pronouns: accept common alternatives (e.g., "el/la" flexibility where grammatically appropriate)

**Frontend approach:**
- If the user's answer matches any accepted translation: "Correct!"
- If the user's answer is close but has a minor difference: "Correct! Another valid translation:" + show primary accepted answer
- If incorrect: show the primary accepted answer as "Correct answer"
- Add a "Report: My answer should be accepted" button for edge cases

**Used by:** Duolingo (has both word bank and free text options -- user can toggle), Busuu, Babbel

### Layout Considerations

- For word bank translation: same as Sentence Building layout
- For free text: use multi-line `<textarea>` with 3 rows minimum
- Show character count for target languages with different scripts (e.g., Chinese, Arabic)
- For right-to-left languages: ensure input field has `dir="rtl"`

### Feedback

Same as Sentence Building (word bank) or Dictation (free text). Always show the primary correct answer even if the user was correct, so they learn the "most natural" phrasing.

---

## 10. Listening Comprehension

### Interaction Pattern

An audio clip (dialogue, monologue, or sentence) plays. The user answers questions about what they heard.

### Audio Player Design

#### Short Audio (< 15 seconds) -- Sentence Level

```
+------------------------------------+
|        [PLAY/PAUSE BUTTON]         |   64x64px
|                                    |
|   [Replay]       [Slow speed]      |
+------------------------------------+
```

No timeline needed. Tap to play/pause. Replay from start.

#### Long Audio (15-120 seconds) -- Dialogue/Passage Level

```
+------------------------------------+
|  [|> / ||]  [=====*==========]     |   Play/pause + scrubber
|   0:23 / 1:15                      |   Time display
|                                    |
|  [Replay]  [Back 5s]  [Fwd 5s]    |   Skip controls
+------------------------------------+
```

- Scrubber/progress bar: thin horizontal bar, 4px height, with a draggable thumb (24px diameter)
- Time display: current position / total duration
- Skip buttons: -5s and +5s for precise navigation (44px touch targets)
- Playback speed: 0.75x / 1x / 1.25x toggle (optional)

### Question Display Timing

| Timing | Use When | UX |
|--------|----------|-----|
| **Before audio** | Testing listening for specific info | Show question, then user plays audio knowing what to listen for |
| **After audio** | Testing general comprehension | Audio plays, then question appears with replay option |
| **During audio** (interleaved) | Dialogue exercises | Pause audio at key moments, ask question, resume |

**Recommendation for TMA:** Show question BEFORE audio for most exercises. This reduces cognitive load and gives the user a purpose for listening. Allow unlimited replays.

### Typical Flow

```
1. [Screen loads: Question + answer options visible, audio not yet played]
2. [Audio auto-plays or user taps play]
3. [User listens]
4. [User selects answer (MC) or types answer]
5. [User taps CHECK]
6. [Feedback shown]
```

### Combined Layout

```
+------------------------------------------+
| [X]  [==========------]                 |
+------------------------------------------+
|                                          |
|  Listen and answer                       |
|                                          |
|  +------------------------------------+ |
|  |  [|> ] [====*============]  1:15  | |  audio player
|  +------------------------------------+ |
|                                          |
|  What did the woman order?               |
|                                          |
|  +------------------------------------+ |
|  |  (o) Coffee                        | |
|  +------------------------------------+ |
|  |  ( ) Tea                           | |
|  +------------------------------------+ |
|  |  ( ) Juice                         | |
|  +------------------------------------+ |
|                                          |
+------------------------------------------+
|  [        CHECK        ]                |
+------------------------------------------+
```

### Progress Indicator for Audio

- Show a waveform-style visualization (simplified: 20-30 vertical bars that animate with audio amplitude) -- optional, adds polish
- Simpler alternative: pulsing speaker icon while audio plays
- Progress bar fills left to right during playback

### Accessibility

- All audio content must have a transcript available (togglable)
- Questions and answers are fully navigable via screen reader
- Audio controls have clear labels: "Play audio", "Pause audio", "Replay audio"
- Provide visual indicator of audio state (playing, paused, finished)

---

## 11. Flashcard / Spaced Repetition Review

### Interaction Pattern

A card with a word/phrase is shown. The user tries to recall the meaning, then reveals the answer and self-rates difficulty.

### Card Layout

#### Front of Card

```
+------------------------------------------+
|                                          |
|  [Optional: small image]                 |
|                                          |
|          "gato"                          |   <- Target word, large (24-32px)
|                                          |
|      [Speaker icon]                      |   <- Tap for pronunciation
|                                          |
|      [Tap to reveal]                     |   <- Hint text
|                                          |
+------------------------------------------+
```

#### Back of Card (After Reveal)

```
+------------------------------------------+
|                                          |
|  [Image: cat photo]                      |   <- 120x120px max
|                                          |
|          "gato"                          |   <- Target word
|           cat                            |   <- Translation
|                                          |
|  [Speaker icon]                          |   <- Audio
|                                          |
|  "El gato negro esta durmiendo"          |   <- Example sentence
|  "The black cat is sleeping"             |   <- Translation
|                                          |
+------------------------------------------+
|                                          |
|  [Hard]    [Good]    [Easy]              |   <- Self-rating buttons
|   (red)    (yellow)  (green)             |
|                                          |
+------------------------------------------+
```

### Card Flip Animation

**CSS 3D flip** (works in most WebViews):

```css
.card {
  perspective: 1000px;
}
.card-inner {
  transition: transform 0.4s ease;
  transform-style: preserve-3d;
}
.card-inner.flipped {
  transform: rotateY(180deg);
}
.card-front, .card-back {
  backface-visibility: hidden;
}
.card-back {
  transform: rotateY(180deg);
}
```

**Trigger:** Tap anywhere on the card (large tap target = entire card area)

**Alternative for TMA (if 3D transforms are janky):** Simple slide-up reveal. Back content slides up from below the front content, or front content slides up to reveal back underneath. Simpler, more reliable.

### Self-Rating Buttons

| Button | Label | Color | SRS Effect |
|--------|-------|-------|------------|
| Hard / Again | "Hard" or "Again" | Red (#FF6B6B) | Review in 1 min (if Again) or reduced interval |
| Good | "Good" | Yellow/Orange (#FFB347) | Review at normal interval |
| Easy | "Easy" | Green (#77DD77) | Review at extended interval |

Buttons: full-width, stacked horizontally (3 columns), 48px height each. Show the next review time under each button (e.g., "Hard -- 10 min", "Good -- 1 day", "Easy -- 4 days").

**Used by:** Anki (4 buttons: Again/Hard/Good/Easy), Memrise (implicit rating based on correctness), Babbel (flashcard review mode)

### Swipe Gestures

- In native apps, left-swipe = "Hard", right-swipe = "Easy" is common
- **In TMA: Do NOT rely on swipe.** Swipe is unreliable in WebView and conflicts with Telegram's own navigation gestures. Use buttons only.

### Card Content Hierarchy

1. **Word** (always shown, largest text)
2. **Audio** (always available, speaker icon next to word)
3. **Translation** (shown on back)
4. **Image** (shown if available, 100-150px, above the word on back)
5. **Example sentence** (shown on back, smaller text 14px)
6. **Part of speech / Transcription** (optional, shown in gray below the word)

### Accessibility

- Card flip triggered by tap and `Enter`/`Space` key
- After flip, announce: "Answer revealed: cat"
- Rating buttons have clear labels: "Rate as Hard, next review in 10 minutes"
- Image has `alt` text describing the content

---

## 12. Image-Based Exercises

### Variant A: Select the Correct Image

```
+------------------------------------------+
| [X]  [==========------]                 |
+------------------------------------------+
|                                          |
|  Select "el gato"                        |
|                                          |
|  +--------+  +--------+                 |
|  |  [CAT] |  |  [DOG] |                 |  2x2 grid
|  |  image  |  |  image  |                 |  Each: ~160x120px
|  +--------+  +--------+                 |
|  +--------+  +--------+                 |
|  | [BIRD] |  | [FISH] |                 |
|  |  image  |  |  image  |                 |
|  +--------+  +--------+                 |
|                                          |
+------------------------------------------+
|  [        CHECK        ]                |
+------------------------------------------+
```

**Interaction:** Tap an image to select (blue border). Tap CHECK. Correct = green border. Incorrect = red border + correct image highlighted green.

**Used by:** Duolingo ("Picture flashcard matching"), Rosetta Stone (entire method is image-based)

### Variant B: Label Parts of an Image

```
+------------------------------------------+
|                                          |
|  Label the body parts                    |
|                                          |
|  [  Image of human body with            |
|     numbered markers:                    |
|     1 -> head area                       |
|     2 -> arm area                        |
|     3 -> leg area     ]                  |
|                                          |
|  1: [________]                           |
|  2: [________]                           |
|  3: [________]                           |
|                                          |
+------------------------------------------+
```

**Interaction:** Number markers overlay on the image. Below the image, corresponding input fields (type or word bank selection). This is essentially multi-gap fill-in-blank with an image context.

### Variant C: Describe What You See

```
+------------------------------------------+
|  What do you see?                        |
|                                          |
|  [Image: A man reading a book in a park] |
|                                          |
|  Write a sentence describing this image: |
|  [__________________________________ ]  |
|                                          |
+------------------------------------------+
```

**Advanced exercise.** Better for intermediate+ learners. Checking is harder -- requires fuzzy semantic matching or teacher review.

### Image Sizing in TMA

- **2x2 grid**: Each image ~(screen_width/2 - 24px) wide, aspect ratio ~4:3 or 1:1
- **Single image**: Full width - 32px margin, max height 200px
- **Images must be compressed**: WebP or JPEG, max 100KB each for fast loading in TMA
- Use `object-fit: cover` with `border-radius: 12px`

### Accessibility

- Every image MUST have descriptive `alt` text
- For image selection: `aria-label="Image of a cat"` on each option
- For label exercises: markers must be associated with their input fields via `aria-describedby`

---

## 13. Error Correction Exercises

### Interaction Pattern

A sentence with an error is displayed. The user must identify and/or correct the error.

### Variant A: Tap the Wrong Word

```
+------------------------------------------+
|  Find the error in this sentence:        |
|                                          |
|  [She] [go] [to] [school] [every] [day] |
|         ^                                |
|     (user taps "go" -- it highlights)    |
|                                          |
+------------------------------------------+
|  [        CHECK        ]                |
+------------------------------------------+
```

**Interaction flow:**
1. Sentence is displayed as individual tappable word chips (48px height each)
2. User taps the word they think is wrong -- it highlights (orange/red border)
3. Tapping another word moves the selection
4. CHECK verifies if the correct error word was identified

**After CHECK (if correct):**
```
  [She] [go] [to] [school] [every] [day]
         ^^
     [RED strikethrough]

  Correct! "go" should be "goes"
  (She goes to school every day.)
```

### Variant B: Tap and Correct

```
+------------------------------------------+
|  Find and fix the error:                 |
|                                          |
|  [She] [go] [to] [school] [every] [day] |
|                                          |
|  After selecting "go":                   |
|  Replace with: [________]               |
|  Suggestions: [goes] [went] [going]      |
|                                          |
+------------------------------------------+
```

1. User taps the wrong word
2. A correction input appears (either text field or suggestion chips)
3. User types or selects the correct form
4. CHECK verifies both identification and correction

### Variant C: Rewrite the Sentence

```
  "She go to school every day."
  Rewrite correctly:
  [__________________________________ ]
```

Full-sentence rewrite. Checking uses string matching with accepted answers.

**Recommendation for TMA:** Use Variant A (tap the wrong word) for simplicity and reliability. Variant B (tap and correct with suggestions) for grammar-focused exercises.

### Feedback

- Identified word highlighted in red with strikethrough
- Correct word shown in green below or next to it
- Grammar explanation in the bottom panel: "Use the third person singular form 'goes' with 'she'"
- If user tapped the wrong word: "Not quite. The error is in 'go'. She GOES to school."

### Accessibility

- Each word is `role="button"` with `aria-label="Word: go. Tap if this word is incorrect."`
- After selection: "You selected 'go' as the error"
- After check: "Correct. 'go' should be 'goes'. Rule: third person singular present tense."

---

## 14. Drag-and-Drop Categorization

### Interaction Pattern

Words or phrases must be sorted into 2-3 categories (e.g., countable vs. uncountable nouns, past vs. present tense).

### CRITICAL: Avoid Drag-and-Drop in TMA

True drag-and-drop is unreliable in Telegram's WebView:
- Conflicts with scroll
- No native drag events (must polyfill via touch events)
- Poor performance on low-end devices
- Accessibility nightmare

### Recommended Alternative: Tap-to-Categorize

```
+------------------------------------------+
| [X]  [==========------]                 |
+------------------------------------------+
|                                          |
|  Sort these words:                       |
|                                          |
|  COUNTABLE        UNCOUNTABLE            |
|  +-----------+    +-----------+          |
|  | apple     |    | water     |          |  Category boxes
|  | chair     |    |           |          |  grow as items added
|  +-----------+    +-----------+          |
|                                          |
+------------------------------------------+
|  Unsorted:                               |
|  [milk] [book] [rice] [pen] [sugar]      |  Word chips
|                                          |
+------------------------------------------+
|  [        CHECK        ]                |
+------------------------------------------+
```

**Interaction flow:**
1. Two (or three) labeled category zones at top
2. Unsorted words displayed as chips at bottom
3. User taps a word chip -- a selection dialog or toggle appears:
   - **Option A**: After tapping a word, tap a category header to place it there
   - **Option B**: Tapping a word cycles it through categories (first tap = Category A, second = Category B, third = back to unsorted). Show category via color coding.
   - **Option C (Recommended)**: Tap a word -> two category buttons appear as a mini bottom sheet -> tap the category

4. Placed words appear inside their category box
5. Tapping a placed word removes it back to unsorted
6. CHECK activates when all words are categorized

### Preferred Implementation: Two-Step Tap

```
User taps [milk] in unsorted area
  -> [milk] highlights
  -> Category headers become tappable buttons:
     [+ COUNTABLE]  [+ UNCOUNTABLE]
  -> User taps [+ UNCOUNTABLE]
  -> [milk] animates into the UNCOUNTABLE box
```

This is the cleanest TMA-compatible approach.

### Alternative: Color-Coded Toggle

```
Tap once  -> word turns BLUE   (= Countable)
Tap twice -> word turns ORANGE (= Uncountable)
Tap third -> word returns to WHITE (= Unsorted)
```

Simpler but less intuitive. Works if there are only 2 categories.

### Layout

- Category boxes: side-by-side if 2 categories, stacked if 3
- Each category box: min-height 80px, border-radius 12px, dashed border when empty
- Word chips: same styling as sentence building (40-44px height, auto-width)
- Maximum 8-10 words per exercise

### Feedback

- After CHECK: correctly categorized words turn green, incorrectly categorized turn red
- Misplaced words animate to their correct category
- Bottom panel explains the rule: "Water, milk, rice, and sugar are uncountable nouns. They don't have a plural form."

### Accessibility

- Words are `role="button"` with `aria-label="Word: milk. Currently unsorted. Tap to categorize."`
- Category zones are `role="region"` with `aria-label="Countable nouns category"`
- After placement: "Milk placed in Uncountable category"
- Color coding supplemented by text labels in each category zone

---

## 15. Audio Recording / Speaking

### Interaction Pattern

The user records themselves speaking (reading a sentence, answering a question, or pronouncing a word). Their recording is compared to a model.

**Used by:** Duolingo ("Speak this sentence"), ELSA Speak, Babbel, Skyeng

### Record Button UX

```
+------------------------------------------+
|  Say this sentence:                      |
|                                          |
|  [Speaker] "She goes to school every day"|
|                                          |
|  +------------------------------------+ |
|  |                                    | |
|  |        [MICROPHONE BUTTON]         | |  80x80px circle
|  |        [Hold to record]            | |
|  |                                    | |
|  +------------------------------------+ |
|                                          |
+------------------------------------------+
```

### Two Recording Modes

#### Mode A: Tap to Start/Stop

1. User taps mic button -- recording starts
2. Mic button turns red, pulsing animation
3. Timer shows recording duration
4. User taps again to stop
5. Recording plays back for review

#### Mode B: Hold to Record (Push-to-Talk) -- RECOMMENDED for TMA

1. User presses and holds the mic button -- recording starts
2. Mic button turns red, shows waveform visualization
3. User releases to stop recording
4. Recording auto-submits or plays back

**Mode B is better for TMA** because it prevents accidental long recordings and feels more natural for short utterances.

### Visual Waveform

During recording, show a simplified waveform:

```
  | |  |  | ||| |  | |||| |  | | |
  | || || | ||| || | |||| || | | ||   <- 30-40 vertical bars
```

Implementation:
- Use `AudioContext` / `AnalyserNode` to get frequency data
- Draw 30-40 bars in a `<canvas>` element
- Update at 30fps (requestAnimationFrame)
- Bar height: 4-40px, width: 3px, gap: 2px
- Color: red during recording, blue during playback

### Playback Comparison

```
+------------------------------------------+
|  Model:                                  |
|  [|> Play model]  ||||||||||||||||||||    |
|                                          |
|  Your recording:                         |
|  [|> Play yours]  |||| ||| || ||||       |
|                                          |
|  Score: 85% -- Good!                     |
|                                          |
|  [Try Again]      [Continue]             |
+------------------------------------------+
```

- Show static waveform for both model and user recording
- Color-code: green for matched parts, red/orange for divergent parts (if ASR provides word-level timing)
- ELSA-style: highlight individual words in red (poor) / orange (okay) / green (good) based on pronunciation score

### TMA Considerations

- **Microphone access**: Telegram WebView supports `getUserMedia()` but requires user permission
- **Recording format**: Use `MediaRecorder` API with `audio/webm;codecs=opus` (best compression/quality for web)
- **Upload**: Send recording to backend for ASR processing; don't process on-device
- **Fallback**: If mic permission is denied, show "Skip" option and move to next exercise
- **Privacy**: Show clear indicator that recording is active (red dot, recording timer)

### Feedback

- **Pronunciation score**: Percentage or star rating (1-5 stars)
- **Word-level feedback**: Each word in the sentence highlighted green/yellow/red
- **Specific tips**: "Try emphasizing the 'th' sound in 'the'" (requires ASR backend)
- Allow "Try Again" before moving on

### Accessibility

- Provide text-based alternative for users who cannot use voice
- Recording button has clear `aria-label="Hold to record your voice"`
- Waveform visualization is decorative (`aria-hidden="true"`)
- Score and feedback announced via `aria-live="polite"`

---

## 16. Transitions, Progress, and Celebrations

### Transition Between Exercises

**Recommended pattern for TMA:**

1. User taps CHECK -> feedback panel slides up (300ms, ease-out)
2. User taps CONTINUE -> entire screen slides out left, new exercise slides in from right (250ms, ease-out)
3. Progress bar increments with a fill animation (200ms)

**Alternative (simpler):** Fade-out old exercise (150ms) -> fade-in new exercise (150ms). Total: 300ms. Less fancy but very reliable in WebView.

**DO NOT use:**
- Swipe-to-advance (unreliable in TMA)
- Auto-advance without user input (except after matching exercises with inline feedback)
- Complex 3D transitions (performance issues)

### Progress Indicators

#### Progress Bar (Top of Screen)

```
[X] [===========-----------] 11/20
```

- Horizontal bar, full width minus close button
- Filled portion in brand color (green, blue)
- Unfilled portion in light gray
- Optional: show "11/20" text at the right end
- Each correct answer fills one segment
- Incorrect answers: bar doesn't move (but exercise still counts toward total)
- Animation: filled portion grows with ease-out (300ms)

#### Exercise Counter (Alternative)

```
Exercise 11 of 20
```

Simple text. Less visual but clear. Can combine with progress bar.

### Streaks and Completion

#### Lesson Completion Screen

```
+------------------------------------------+
|                                          |
|        [CONFETTI ANIMATION]              |
|                                          |
|           [Star icon]                    |
|         Lesson Complete!                 |
|                                          |
|  +------------------------------------+ |
|  |  Accuracy:    90%                  | |
|  |  Time:        3:24                 | |
|  |  XP earned:   +15                  | |
|  |  Streak:      7 days [flame icon]  | |
|  +------------------------------------+ |
|                                          |
|  [        CONTINUE        ]             |
|                                          |
+------------------------------------------+
```

#### Confetti Animation

- Use lightweight CSS/JS confetti (e.g., `canvas-confetti` library, ~6KB gzipped)
- 50-100 particles, 2-3 second duration
- Colors: brand palette (avoid just red+green for colorblind users)
- Trigger: on lesson completion, on streak milestone (7, 30, 100 days)

#### Streak Display

```
[Flame icon] 7-day streak!
```

- Flame icon animates (flicker/pulse) on milestone days
- Show streak count prominently on completion screen
- If streak would be broken: show "Don't lose your 7-day streak!" as motivation on the home screen

### Celebration Micro-Interactions

| Moment | Animation | Sound | Haptic |
|--------|-----------|-------|--------|
| Correct answer | Brief green flash | Short ding | Light impact |
| Incorrect answer | Brief red flash/shake | Short buzz | Warning notification |
| Streak continued | Flame pulse | Achievement sound | Medium impact |
| Lesson complete | Confetti burst | Victory fanfare | Success notification |
| All exercises correct | Star sparkle + confetti | Special victory sound | Strong impact |
| Milestone (50th lesson, etc.) | Badge animation | Unlock sound | Strong impact |

### Haptic Feedback in TMA

```javascript
// Correct answer
window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');

// Incorrect answer
window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');

// Selection changed
window.Telegram.WebApp.HapticFeedback.selectionChanged();

// Button pressed
window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
```

---

## 17. Dark Mode Considerations

### Telegram Theme Integration

```javascript
const theme = window.Telegram.WebApp.themeParams;
// Available: bg_color, text_color, hint_color, link_color,
// button_color, button_text_color, secondary_bg_color
```

### Color Palette Mapping

| Element | Light Mode | Dark Mode | Notes |
|---------|-----------|-----------|-------|
| Background | #FFFFFF | #1C1C1E (not pure black) | Dark gray reduces eye strain |
| Card/Surface | #F5F5F5 | #2C2C2E | Slightly lighter than bg |
| Primary text | #1A1A1A | #E5E5E7 | Not pure white (reduces halation) |
| Secondary text | #666666 | #8E8E93 | Hint/label text |
| Correct (green) | #4CAF50 | #66BB6A | Slightly lighter green in dark mode |
| Incorrect (red) | #F44336 | #EF5350 | Slightly lighter red in dark mode |
| Selected/Active | #2196F3 | #42A5F5 | Blue remains similar |
| Word chip bg | #FFFFFF | #3A3A3C | Elevated surface |
| Word chip border | #E0E0E0 | #48484A | Subtle border |
| Progress bar fill | #4CAF50 | #66BB6A | Brand green |
| Progress bar bg | #E0E0E0 | #3A3A3C | Track color |

### Key Rules

1. **Never use pure black (#000000)** as background -- use #1C1C1E or similar dark gray
2. **Never use pure white (#FFFFFF)** for text in dark mode -- use #E5E5E7
3. **Maintain 4.5:1 contrast ratio** for all text (test with WebAIM contrast checker)
4. **Don't invert images** -- darken the image overlay or use a subtle border instead
5. **Ensure feedback colors (green/red) work in both modes** -- add icons (checkmark, X) as supplement
6. **Test with deuteranopia simulation** -- red/green distinction is problematic; always pair color with icon/text

### Implementation

```css
:root {
  --bg-primary: #FFFFFF;
  --bg-surface: #F5F5F5;
  --text-primary: #1A1A1A;
  --text-secondary: #666666;
  --correct: #4CAF50;
  --incorrect: #F44336;
  --accent: #2196F3;
}

[data-theme="dark"] {
  --bg-primary: #1C1C1E;
  --bg-surface: #2C2C2E;
  --text-primary: #E5E5E7;
  --text-secondary: #8E8E93;
  --correct: #66BB6A;
  --incorrect: #EF5350;
  --accent: #42A5F5;
}
```

Detect theme from Telegram API and apply `data-theme` attribute to root element.

---

## 18. Offline Capability

### TMA Limitations

**Service Workers on iOS Telegram are NOT supported.** This is a known, documented bug. On Android and macOS desktop, service workers work.

This means:
- **True offline mode is not possible on iOS** TMA
- On Android, you CAN cache static assets via service worker
- On all platforms, you CAN use IndexedDB/localStorage for local data

### Practical Offline Strategy

#### What You CAN Cache (All Platforms)

1. **Exercise data**: Pre-fetch the next 5-10 exercises in the current lesson into IndexedDB when online
2. **User progress**: Store answers locally, sync when back online
3. **Audio files**: Pre-download audio for upcoming exercises into IndexedDB as Blobs
4. **Images**: Pre-download images into IndexedDB as Blobs

#### Implementation Pattern

```javascript
// On lesson start, prefetch upcoming exercises
async function prefetchLesson(lessonId) {
  const exercises = await api.getLessonExercises(lessonId);
  await idb.put('exercises', lessonId, exercises);

  // Prefetch media
  for (const ex of exercises) {
    if (ex.audioUrl) {
      const audioBlob = await fetch(ex.audioUrl).then(r => r.blob());
      await idb.put('media', ex.audioUrl, audioBlob);
    }
    if (ex.imageUrl) {
      const imgBlob = await fetch(ex.imageUrl).then(r => r.blob());
      await idb.put('media', ex.imageUrl, imgBlob);
    }
  }
}
```

#### What You CANNOT Do Offline

- Send recordings for ASR processing (speaking exercises)
- Grade free-text translations (need backend)
- Sync progress to server
- Load new lessons not yet cached

#### Graceful Degradation

- If offline: show cached exercises only
- If a speaking exercise is next but no network: skip to next non-speaking exercise
- Show "You're offline. Your progress will sync when you reconnect." banner
- Queue answers locally and batch-sync on reconnect

---

## Summary: Exercise Type Feasibility in TMA

| Exercise Type | TMA Feasibility | Primary Interaction | Key Constraint |
|--------------|----------------|--------------------|--------------  |
| Fill-in-blank (word bank) | Excellent | Tap | None |
| Fill-in-blank (type) | Good | Type | Keyboard viewport issues |
| Multiple choice | Excellent | Tap | None |
| Matching (tap pairs) | Excellent | Tap | Max 5-6 pairs |
| Sentence building | Good | Tap | Long sentences need wrapping |
| Dictation | Good | Type + Audio | Keyboard viewport, audio API |
| Translation (word bank) | Good | Tap | Same as sentence building |
| Translation (free text) | Good | Type | Multiple correct answers, keyboard |
| Listening comprehension | Good | Tap + Audio | Audio API reliability |
| Flashcard review | Excellent | Tap | Card flip animation may need fallback |
| Image selection | Excellent | Tap | Image loading speed |
| Image labeling | Good | Tap/Type | Layout complexity |
| Error correction (tap) | Excellent | Tap | None |
| Categorization (tap) | Good | Tap-then-tap | Needs careful 2-step UX |
| Speaking / recording | Fair | Hold + Record | Mic permissions, no offline ASR |
| Drag-and-drop (any) | Poor | Drag | Conflicts with scroll, avoid |

### Priority Order for Implementation

1. **Multiple choice** -- simplest, most versatile, works perfectly
2. **Fill-in-blank (word bank)** -- high engagement, clear interaction
3. **Sentence building (tap)** -- Duolingo's signature, highly effective
4. **Matching (tap pairs)** -- good for vocabulary, gamified feel
5. **Fill-in-blank (type)** -- tests active recall, needs keyboard handling
6. **Listening comprehension** -- requires audio infrastructure
7. **Flashcard review** -- good for SRS-based review sessions
8. **Error correction (tap)** -- unique exercise type, grammar-focused
9. **Translation (free text)** -- advanced, needs multi-answer backend
10. **Image selection** -- requires image asset pipeline
11. **Categorization (tap)** -- niche but useful for grammar
12. **Dictation** -- combines audio + typing, complex
13. **Speaking / recording** -- most complex, mic + ASR dependency

---

## Appendix: Key Dimensions Reference

| Element | Size | Notes |
|---------|------|-------|
| Touch target | 48x48px minimum | Apple: 44pt, Material: 48dp |
| Touch target spacing | 8px minimum gap | Between adjacent targets |
| Word chip height | 40-44px | With 8-12px vertical padding |
| Word chip padding | 12px 16px | Horizontal, vertical |
| Button height (primary) | 48-52px | CHECK, CONTINUE |
| Button corner radius | 12px | Rounded rectangle |
| Progress bar height | 8-12px | Thin bar at top |
| Card border radius | 16px | For flashcards, answer cards |
| Font: instruction text | 16px | Regular weight |
| Font: source sentence | 18-20px | Semi-bold |
| Font: word in focus | 24-32px | Bold, flashcard front |
| Font: answer options | 16-18px | Regular weight |
| Animation: feedback slide | 300ms | ease-out |
| Animation: word placement | 150ms | ease-out |
| Animation: card flip | 400ms | ease |
| Animation: confetti | 2000-3000ms | On completion |
| Spacing: screen padding | 16px | Left and right |
| Spacing: section gap | 16-24px | Between prompt, answer, bank |
| Max screen width | 100% | TMA is always full-width |
| Min usable height | 530px | iPhone SE-class devices |
