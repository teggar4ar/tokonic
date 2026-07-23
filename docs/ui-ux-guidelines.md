# Tokonic UI/UX Guidelines

Use this before designing or implementing any screen. `AGENTS.md`, the TDD, and ReUI component APIs remain authoritative.

## Found in Phase 1 — Needs Revisit

- The login page uses the generic centered-card pattern (`max-w-sm` white card on muted background). Keep it functional for now, but do not use it as the default composition for future screens; revisit it with stronger Tokonic identity and a deliberate split/brand context when auth UI is polished.
- Phase 1 uses grayscale shadcn defaults and Arial. Replace these with the Tokonic color and typography tokens below before storefront work; do not allow page-local color/font systems.
- The lock icon uses an icon-in-tinted-square treatment. This is acceptable as one auth cue, but the pattern must not be repeated on every card, feature, or empty state.
- The admin page is a placeholder, not an established dashboard shell. Its `max-w-5xl`, header, and bordered section must not be copied into every admin screen.
- Loading, empty, error, navigation shell, responsive data, and form-submission states are not yet implemented.
- The current `Button`, `Input`, `Label`, and `Card` primitives are valid shadcn-compatible foundations, but input/button heights must reach at least 44px on buyer-facing mobile forms.

## Design Point of View

Tokonic uses **trustworthy Swiss-modern commerce**: structured grid, restrained navy/slate foundations, clear blue actions, warm product imagery, mathematical spacing, and minimal decoration.

- Storefront: credible, calm, buyer-friendly, product-first. It should feel as dependable as a marketplace without looking corporate or generic.
- Admin: compact, operational, predictable, information-first. Optimize repeated daily scanning and action, not marketing impact.
- Use hierarchy, alignment, typography, and whitespace before adding color, shadow, illustration, or motion.
- One screen gets one obvious primary action. Secondary and destructive actions remain visually subordinate.
- Motion is subtle and functional: 150–250ms for state changes, transform/opacity only, and reduced-motion support.

## Explicitly Forbidden: “AI-Generated” Tells

- No default indigo-to-purple gradient heroes unless a documented campaign/brand need requires one.
- No generic centered `rounded-2xl shadow-lg` white card as the default container for every page or section.
- No emoji as navigation, status, feature, or action icons. Use Heroicons consistently.
- No repeated icon-in-circle/tinted-square feature-card grid. Use icons only when they improve scanning or meaning.
- No random stock illustrations, floating blobs, glass panels, neon glow, or 3D assets without one coherent art direction.
- No wall of equal-weight cards. Establish primary, secondary, and supporting information.
- No arbitrary Tailwind spacing/type choices per screen. Use the rhythm and roles below.
- No excessive rounded containers. Group with spacing/dividers first; use surfaces only when a boundary is meaningful.
- No decorative buttons, fake tabs, meaningless metrics, or filler copy.
- No mixed icon families/styles at the same hierarchy level.

## Design Tokens

Implement these as semantic CSS/Tailwind tokens in `globals.css`; components consume token names, never raw hex/OKLCH values.

### Color

| Token role | Reference | Usage |
|---|---:|---|
| `background` | `#F8FAFC` | App/page background; storefront may use white product sections |
| `surface` / `card` | `#FFFFFF` | Forms, tables, meaningful grouped content |
| `foreground` | `#020617` | Primary text |
| `muted-foreground` | `#475569` | Secondary text; preserve 4.5:1 for body-size text |
| `primary` | `#0F172A` | Admin navigation, high-trust anchors, primary dark action |
| `primary-foreground` | `#FFFFFF` | Text/icons on primary |
| `accent` | `#0369A1` | Buyer CTA, links, active focus/navigation; do not use decoratively everywhere |
| `accent-hover` | `#075985` | Accent hover/pressed |
| `muted` | `#E8ECF1` | Subtle controls, skeletons, neutral status background |
| `border` | `#E2E8F0` | Dividers and meaningful surface boundaries |
| `success` | `#15803D` | Paid/completed/success; pair with text/icon, never color alone |
| `warning` | `#B45309` | Pending/review/attention |
| `destructive` | `#DC2626` | Delete, irreversible action, invalid/error |
| `info` | `#0369A1` | Informational state and progress |
| `focus-ring` | `#0284C7` | Visible 2–3px keyboard focus |

Rules:

- Primary navy communicates trust; accent blue drives action. Do not swap their roles page by page.
- Product imagery supplies warmth and variety. Do not compensate with decorative gradients.
- Status colors always include a label and, where useful, an icon.
- Destructive red is reserved for destructive/error meaning; never use it for promotion.
- Validate all foreground/background combinations to WCAG AA: 4.5:1 normal text, 3:1 large text and UI graphics.
- Dark mode is not required until designed and tested as a complete token set; do not auto-invert light tokens.

### Typography

Preferred family: **Figtree** via `next/font`; fallback `Arial, Helvetica, sans-serif`. Use one family initially to keep loading and hierarchy disciplined.

| Role | Mobile / desktop | Weight | Line height |
|---|---|---:|---:|
| Display/store hero | `32 / 44px` | 650–700 | 1.1 |
| Page title / H1 | `28 / 36px` | 650–700 | 1.2 |
| Section title / H2 | `22 / 28px` | 600–650 | 1.25 |
| Component title / H3 | `18 / 20px` | 600 | 1.35 |
| Body | `16px` | 400 | 1.6 |
| Compact admin body | `14px` | 400 | 1.5 |
| Label | `14px` | 500–600 | 1.4 |
| Caption/meta | `12px` | 400–500 | 1.4 |

- Do not use body text below 16px on buyer mobile screens; 14px is acceptable for secondary admin data.
- Use tabular numerals for rupiah, quantities, dates, and table metrics.
- Limit long-form text to 60–75 characters per line; buyer mobile copy typically 35–60.
- Do not create hierarchy using gray text alone; combine size, weight, and spacing.

### Spacing, Radius, Elevation

Use a 4px base rhythm:

- `4`: icon/text micro-gap.
- `8`: related control/content gap.
- `12`: compact admin cell/control spacing.
- `16`: standard component inset and mobile gutter.
- `24`: card/group padding and section sub-gap.
- `32`: mobile section separation.
- `48`: desktop section separation.
- `64–96`: major storefront section separation only.

- Storefront gutters: `16px` base, `24px` at `sm/md`, `32px` at `lg+`.
- Admin gutters: `16px` mobile, `24px` tablet, `32px` desktop.
- Radius roles: controls `8px`, cards/frames `12px`, modal/sheet `16px`; avoid arbitrary pill/2xl rounding.
- Use border/divider before shadow. Reserve one subtle shadow level for floating menus, dialogs, and sticky overlays.

## Component Architecture

### 1. Primitives

Location: `src/components/ui/` and `src/components/reui/`.

- Button, Input, Label, Badge, Dialog, Select, Skeleton, Alert, Frame, Data Grid.
- Install/read the real ReUI API before use; do not invent props or hand-roll an available primitive.
- Do not place business rules, data fetching, domain names, or product-specific copy inside primitives.
- Change primitive appearance through documented variants and semantic tokens, not per-page forks.

### 2. Tokonic Domain Components

Locations by responsibility:

- `src/components/storefront/`: `ProductCard`, `ProductPrice`, `StockIndicator`, `StorefrontHeader`.
- `src/components/admin/`: `AdminPageHeader`, `OrderStatusBadge`, `SalesMetric`, `AdminDataToolbar`.
- `src/components/cart/`: `CartItemRow`, `CartSummary`.
- `src/components/forms/`: `ProductForm`, `CheckoutForm`, `ShippingCostSelector`.
- `src/components/shared/`: `EmptyState`, `ErrorState`, `LoadingSkeleton`, `RupiahAmount`.

Rules:

- If the same meaningful markup/class pattern appears in **2+ places**, extract it.
- Extract earlier when a pattern owns accessibility, status mapping, money formatting, validation feedback, or responsive behavior.
- Use props/variants for controlled differences: `OrderStatusBadge status`, `ProductCard density`, `EmptyState action`.
- Do not create near-duplicates such as `PaidBadge`, `PendingBadge`, and `ShippedBadge`; use one typed component.
- Do not repeat the same long Tailwind combination. Move it to a component, documented variant, or semantic token.
- Domain components receive typed view data; they do not query Supabase or call services.

### 3. Page Composition

- Pages own route-level composition, data loading, metadata, and section order.
- Keep route files readable; move repeated sections/forms/toolbars to domain components.
- A page-specific composition can stay local until it repeats, but must still use primitives and tokens.
- Server Components are the default; isolate only interactive islands as Client Components.

## Storefront Direction — Buyer-Facing

**Non-negotiable: mobile-first.** Base classes target 360–430px phones; `sm:`, `md:`, and `lg:` add enhancements. UMKM buyers predominantly arrive from mobile/social links, so desktop-first compression is unacceptable.

- Product and trust content precedes secondary navigation or decoration.
- Keep primary purchase CTA visible and reachable without covering content; account for bottom safe areas.
- Product grid: one or two columns on phones depending on content width, two/three on tablet, three/four on desktop.
- Product cards emphasize image → name → price → stock/action. Avoid marketing-card ornaments.
- Checkout uses progressive disclosure, visible labels, correct mobile keyboards, and a clear total summary.
- Preserve cart/form state across recoverable errors and back navigation.
- Use product imagery with consistent aspect ratio, declared dimensions, responsive sizes, and lazy loading below fold.
- Storefront max content width: approximately `1280px`; reading/form columns remain narrower.

## Admin Direction — Seller-Facing

Desktop-optimized, not desktop-only. It may start from efficient desktop layouts but must remain operable on mobile.

- Prefer a persistent sidebar at `lg+`; use a compact drawer/top navigation below it.
- Keep page title, context, and one primary action in a reusable `AdminPageHeader`.
- Use denser 14px data text and 12–16px row padding while preserving 44px interactive targets.
- Tables remain semantic and horizontally scroll inside their own bounded region; the whole page must not overflow.
- Put filters/search above the grid and keep bulk/row actions predictable.
- Show actionable states (`paid`, `packed`, `payment_review`) with text labels and semantic badges.
- Do not turn every metric into a large card. Use compact summaries and emphasize only the daily decision-driving figures.

## ReUI Use-Case Map

Use registry items rather than rebuilding them:

- Admin products/orders: **ReUI Data Grid** with sorting, filters, pagination, loading and empty states. Use `dense: true` for admin when readability remains strong. API: https://reui.io/docs/components/base/data-grid — Preview: https://reui.io/components/data-grid
- Pagination baseline example: https://reui.io/preview/base/components/c-data-grid-1
- Dense admin example: https://reui.io/preview/base/components/c-data-grid-3
- Status labels: **ReUI Badge** — Preview: https://reui.io/components/badge
- Inline/form/page feedback: **ReUI Alert** — Preview: https://reui.io/components/alert
- Structured admin sections: **ReUI Frame**; choose one surface system per screen and do not mix random Card/Frame walls — Preview: https://reui.io/components/frame
- RajaOngkir destination search: **Autocomplete** — Preview: https://reui.io/components/autocomplete
- Advanced admin filtering: **Filters** — Preview: https://reui.io/components/filters
- Date/report ranges: **Date Selector** — Preview: https://reui.io/components/date-selector
- Checkout steps only if checkout is genuinely multi-step: **Stepper** — Preview: https://reui.io/components/stepper
- Order history: **Timeline** — Preview: https://reui.io/components/timeline
- Quantity/stock controls where steppers are appropriate: **Number Field** — Preview: https://reui.io/components/number-field
- Indonesian phone input when country selection/normalization UX is needed: **Phone Input** — Preview: https://reui.io/components/phone-input

Phase 1 references: login already composes shadcn-compatible `Card`, `Input`, `Label`, and `Button`; admin logout uses Heroicons plus the shared Button. These are functional baselines, not final visual templates.

## Responsive Rules

Standard review widths: `360`, `375`, `768`, `1024`, `1440px` plus phone landscape.

- Base: phone. No horizontal page scroll; one-column forms/content; 16px gutters.
- `sm` (~640): increase gutters and allow selective two-column compact content.
- `md` (~768): two-column product/detail layouts when hierarchy benefits; do not stretch forms unnecessarily.
- `lg` (~1024): admin sidebar, wider Data Grid controls, multi-column storefront sections.
- `xl` (~1280): cap content width; add whitespace, not endless stretched columns.
- Fixed/sticky headers and bottom CTAs reserve equivalent content padding.
- Avoid nested vertical scrolling. Data Grid may own horizontal scroll and a deliberate bounded vertical region.
- Do not hide core actions/content on mobile; reorder by priority or move secondary actions into an overflow menu.

## Loading, Empty, Error, and Success States

Every data-driven screen ships all relevant states in the same feature PR.

### Loading

- Use layout-matched skeletons after ~300ms; reserve dimensions to avoid CLS.
- Buttons disable on submit and show progress while preserving their width/label context.
- Use a spinner for short indeterminate actions, not as an empty full-page default.

### Empty

- Explain what is empty, why it matters, and the next useful action.
- Do not use oversized illustrations or icon-circle decoration by default.
- Example: `Belum ada produk. Tambahkan produk pertama agar katalog toko bisa mulai diisi.`
- Empty filtered results offer clear/reset filters; true empty datasets offer creation guidance.

### Error

- Show the error near its source and provide recovery (`Coba lagi`, edit input, or support path).
- Form errors appear below fields and use `role="alert"`/`aria-live` where needed.
- Keep buyer-facing provider/security errors generic; never expose raw errors.
- Preserve entered data after recoverable failures.

### Success

- Confirm completed mutations briefly without blocking navigation.
- Use concise toast/inline confirmation; never rely on green color alone.
- Destructive actions require confirmation and clear consequences.

## Microcopy

Use Bahasa Indonesia that is plain, direct, calm, and specific. Avoid corporate jargon, exaggerated claims, blame, and cute filler.

| Generic / off-brand | Tokonic |
|---|---|
| “Oops! Something went wrong.” | “Data belum berhasil dimuat. Coba lagi.” |
| “No data available.” | “Belum ada pesanan yang perlu diproses.” |
| “Submit” | “Simpan produk” / “Lanjut ke pembayaran” |
| “Invalid credentials.” | “Email atau kata sandi tidak valid.” |

- Buttons describe outcomes: `Simpan perubahan`, `Hitung ongkir`, `Bayar sekarang`.
- Status copy uses known domain terms: `Menunggu pembayaran`, `Siap dikemas`, `Perlu ditinjau`.
- Keep sentences short; explain the recovery step when an action fails.
- No emoji in headings, alerts, buttons, or operational statuses.

## Accessibility and Interaction

- Minimum text contrast 4.5:1; meaningful graphics/focus boundaries 3:1.
- Visible keyboard focus ring on every control; never remove focus without replacement.
- Buyer-facing tap targets are at least 44×44px with at least 8px separation.
- Every input has a persistent visible label; placeholder is supplementary only.
- Use semantic input types and `inputMode` (`email`, `tel`, numeric) for mobile keyboards.
- Icon-only controls require an accessible name; decorative icons use `aria-hidden="true"`.
- Heading levels are sequential and each page has one clear H1.
- Color never carries status alone; include text and optionally icon.
- Keyboard order follows visual order; dialogs trap/restore focus and have Escape/close behavior.
- Respect zoom, text scaling, `prefers-reduced-motion`, and touch/keyboard alternatives.
- Product images have descriptive alt text; decorative imagery uses empty alt.
- Do not auto-focus fields on mobile unless it clearly improves the flow and avoids keyboard surprise.

## UI Review Gate

- [ ] Screen has a deliberate hierarchy and one primary action; it does not resemble a generic template.
- [ ] No forbidden AI-generated tell is present.
- [ ] Semantic tokens, type roles, spacing rhythm, radius, and elevation rules are followed.
- [ ] Repeated patterns are extracted at 2+ uses; variants replace near-duplicate components.
- [ ] ReUI API/example was checked before implementing an available component.
- [ ] Storefront starts mobile-first and works at 360px without horizontal overflow.
- [ ] Admin remains usable on mobile and efficient at desktop widths.
- [ ] Loading, empty, error, success, disabled, hover, active, and focus states are covered.
- [ ] Microcopy is direct Bahasa Indonesia and action-specific.
- [ ] Contrast, keyboard navigation, labels, 44px targets, and reduced motion are verified.
- [ ] Images reserve space and use responsive/lazy loading where appropriate.
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` pass.
