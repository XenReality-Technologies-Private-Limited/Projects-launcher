## Visual & UX Requirements

### Top menu bar (header) with logo

The dashboard has a **fixed top header bar** that spans the full viewport width and sits above the main content. Use it as the single source of truth for layout and CSS when replicating in another project.

#### Structure (HTML semantics)

- One `<header>` (or `<nav>`) with a class like `.dashboard-header` or `.app-header`.
- Inside: a single inner wrapper (e.g. `.header-inner`) that constrains width and centers content.
- Three logical regions in one row:
  1. **Logo area** (left): logo image or app name text.
  2. **Center** (optional): can be empty or used for a title.
  3. **Right group**: system status pill + live IST clock, with a small gap between them.

#### Layout & dimensions (CSS)

- **Bar:**
  - `height: 64px` (fixed height).
  - `background-color: #ffffff`.
  - `border-bottom: 1px solid #e5e7eb`.
  - `box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06)` (very subtle, optional).
  - `position: sticky` and `top: 0` so it stays visible on scroll; `z-index: 50` so it stays above cards.
- **Inner container:**
  - `max-width: 1400px` (or your app’s content max-width), `margin: 0 auto`, `padding: 0 24px`.
  - `height: 100%`, `display: flex`, `align-items: center`, `justify-content: space-between`.
- **Logo area:**
  - `display: flex`, `align-items: center`, `gap: 12px`.
  - If **logo image**: `height: 36px`, `width: auto` (or fixed e.g. `120px`), `object-fit: contain`.
  - If **text-only logo (app name):**
    - `font-family:` same as body (e.g. `'Inter', system-ui, -apple-system, sans-serif`).
    - `font-size: 1.25rem` (20px), `font-weight: 600`, `color: #111827`, `letter-spacing: -0.02em`.
    - `text-decoration: none` if it’s a link.
- **Right group (status + clock):**
  - `display: flex`, `align-items: center`, `gap: 20px`.
- **System status pill (“SYSTEM ONLINE”):**
  - `background-color: #10b981`, `color: #ffffff`, `padding: 6px 12px`, `border-radius: 9999px` (full pill).
  - `font-size: 0.75rem` (12px), `font-weight: 600`, `letter-spacing: 0.05em`.
  - Optional: `text-transform: uppercase` for consistency.
- **Live clock (IST):**
  - `font-variant-numeric: tabular-nums`, `font-size: 0.9375rem` (15px), `font-weight: 500`, `color: #6b7280`.
  - Same font family as body; tabular-nums keeps digits from shifting when the time updates.

#### Spacing and alignment

- No extra vertical padding on the bar beyond the 64px height; content is vertically centered with `align-items: center`.
- Minimum horizontal padding inside the inner container: `24px` left/right; increase on larger breakpoints if desired (e.g. `32px` at `min-width: 1024px`).

#### Relationship to the rest of the dashboard

- The main content (KPI cards) starts **below** the header with no overlap.
- Page background (`#f3f4f6`) shows in the viewport; the header is a white strip on top, so the first visible “content” is the header, then the scrollable card grid.
- If you use a wrapper for the main content, give it `padding-top: 0` so the 64px header is the only top chrome; no double spacing.

#### Copy-paste–friendly CSS (menu bar only)

```css
.dashboard-header {
  position: sticky;
  top: 0;
  z-index: 50;
  height: 64px;
  background-color: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.header-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-logo img {
  height: 36px;
  width: auto;
  object-fit: contain;
}

.header-logo-text {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
  letter-spacing: -0.02em;
  text-decoration: none;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-status {
  background-color: #10b981;
  color: #ffffff;
  padding: 6px 12px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.header-clock {
  font-variant-numeric: tabular-nums;
  font-size: 0.9375rem;
  font-weight: 500;
  color: #6b7280;
}
```

Use these classes on the header, inner container, logo block, status pill, and clock span so the menu bar matches the dashboard and can be reused in another project.

---

- Modern, minimal, responsive layout:
  - Left side video, right side metrics + graphs.
  - Use cards with rounded corners, subtle shadows, neutral background.
- **Color system (primary + neutrals):**
  - Primary: `#2563eb` (brand blue – buttons, active states, key accents)
  - Secondary accent: `#8b5cf6` (violet – theft card accent, secondary highlights)
  - Danger/accent red: `#ef4444` (spike / alert emphasis)
  - Success/healthy: `#10b981` (system online, healthy status pills)
  - Background: `#f3f4f6` (page background), `#ffffff` (cards)
  - Borders: `#e5e7eb`
  - Text:
    - Primary text: `#111827`
    - Secondary/muted: `#6b7280`
- **Per-card visual differentiation:**
  - Smoke card graph line & small accents: primary blue `#2563eb`
  - Theft card: violet `#8b5cf6`
  - Grouping card: red `#ef4444`
  - Person card: green `#10b981`
- Use a clean sans-serif typeface (e.g. Inter / system sans):
  - Headings: slightly tighter letter spacing, medium/bold weight.
  - Numbers (metrics / timestamps): use a monospace-like style or tabular numbers for alignment.
- Handle missing DB or empty tables gracefully:
  - If fetch or DB load fails, show an error message in console and fallback labels (`ERROR`).
- Avoid heavy frameworks or state management; keep the codebase simple and understandable.

---
