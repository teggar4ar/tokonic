# Tokonic — Product Requirements Document

**Document status:** Draft for approval  
**Product stage:** Self-study MVP with a possible future commercial path  
**Primary audience:** Product owner and future collaborators  
**Product requirements source:** This document  
**Technical design:** `tokonic-technical-design-document.md`  
**Historical input:** `tokonic-ringkasan-diskusi.md`  
**Timeline:** TBD  
**Last updated:** 2026-07-22

---

## 1. Executive Summary

### 1.1 Problem Statement

Small and micro-business (UMKM) sellers commonly depend on marketplaces that deduct relatively high administration fees or sales commissions. Selling manually through WhatsApp may avoid those fees, but it provides less trust for new buyers and weak transaction, inventory, and order tracking for sellers.

### 1.2 Proposed Solution

Tokonic is a simple, single-tenant online store for UMKM sellers. It provides a public storefront, product catalog, cart, shipping-cost calculation, integrated payment, guest order tracking, product and order administration, and basic sales reporting.

Tokonic is initially a self-study project operated as one development/demo store. It retains a possible future business direction based on a setup fee and flat monthly subscription, but seller acquisition and commercial validation are not MVP commitments.

### 1.3 Value Proposition

For sellers:

- Lower and more predictable selling costs than percentage-based marketplace commissions.
- A branded store that can increase buyer trust compared with manual bank transfers.
- Automatic order, payment, stock, and sales records.
- A manageable fulfillment flow without automated courier booking.

For buyers:

- A clear product catalog and conventional checkout experience.
- Familiar payment methods such as QRIS, virtual accounts, and e-wallets.
- Transparent shipping fees and order status tracking without account registration.
- WhatsApp access for pre-purchase questions and buyer-initiated confirmation.

### 1.4 MVP Learning Outcomes

The MVP is intended to demonstrate:

1. A reliable end-to-end online commerce flow from product discovery through payment and fulfillment.
2. Secure seller administration and safe handling of buyer transaction data.
3. Correct order totals, payment outcomes, and inventory updates.
4. A maintainable foundation that can be extended if a commercial opportunity arises.

### 1.5 MVP Completion Criteria

Commercial adoption targets are intentionally excluded. The MVP is successful when:

| Area | Completion target |
|---|---|
| Complete commerce flow | One sandbox order can move from product selection through checkout, payment, packing, shipment, tracking, and completion |
| Payment reliability | Authoritative payment confirmation updates the correct order exactly once |
| Critical correctness | No known incorrect charged total, duplicate stock reduction, or negative stock occurs in the acceptance tests |
| Seller capability | The seller can manage products, images, store settings, orders, tracking numbers, and basic sales summaries |
| Access control | Public users cannot access seller administration or another buyer's order information |
| Maintainability | Product and technical documentation are sufficient to recreate, test, and extend the project |
| Demo readiness | One development/demo deployment is usable for self-study and portfolio demonstration |

If Tokonic later becomes a business, seller acquisition, activation, retention, revenue, support, and unit-economics metrics must be defined in a separate commercial-validation plan.

---

## 2. Product Scope and Principles

### 2.1 MVP Scope

The MVP must provide the smallest complete commerce flow that lets a seller publish physical products, lets a buyer place and pay for an order, and lets the seller record fulfillment through completion.

Tokonic is not intended to match a full marketplace. Features that do not directly support product discovery, checkout, payment, fulfillment, or basic transaction records are excluded unless required for user trust, privacy, or correctness.

### 2.2 Product Principles

1. **Learning before scale:** Complete one understandable store before considering commercial scaling.
2. **Correctness over breadth:** Payment, totals, stock, and order state are more important than feature count.
3. **No buyer account:** Reduce checkout friction and account-management scope.
4. **WhatsApp supports checkout:** WhatsApp is for questions and buyer-initiated confirmation, not the primary purchase flow.
5. **Manual fulfillment is acceptable:** The seller ships parcels and enters tracking numbers manually.
6. **Preserve transaction history:** Product changes must not alter historical order details.
7. **Low operational overhead:** The MVP should remain practical for one developer to operate.

### 2.3 Intended Future Business Model

If Tokonic is commercialized:

- Each seller may receive a separately operated single-tenant store.
- Pricing may use a one-time setup fee plus a flat monthly subscription.
- Tokonic will not charge a percentage of seller sales.
- Payment-provider fees remain separate.

Pricing, subscription terms, support boundaries, suspension policy, and multi-seller operations are future commercial decisions, not MVP requirements.

### 2.4 Initial Rollout

- Initial implementation: one development/demo store operated by the project owner.
- Primary future audience: Indonesian small/micro businesses and individual sellers.
- External seller onboarding occurs only if a real commercial opportunity arises.
- Multi-tenant and self-service provisioning require a separate future product decision.

---

## 3. Users and Jobs to Be Done

### 3.1 Seller/Admin

An owner-operated UMKM seller who wants a branded store with predictable costs and simple administration.

Primary jobs:

- Publish and maintain products, prices, images, shipping weight, and stock.
- Receive trusted online payments.
- See which orders require action.
- Record packing, shipment, and tracking information.
- Review basic order volume and revenue.

### 3.2 Buyer

A mobile-first customer arriving through a shared link, social profile, or seller promotion. The buyer may not know the seller personally.

Primary jobs:

- Browse products and understand price and stock.
- Ask a pre-purchase question through WhatsApp.
- Add products to a cart and see delivery cost.
- Pay using a familiar payment method.
- Check order and shipment status without an account.

### 3.3 Product Operator

The project owner responsible for configuring and maintaining the demo store.

Primary jobs:

- Configure the store and external service accounts.
- Diagnose failed payments, shipping-cost requests, or access problems.
- Maintain the application and its documentation.
- Decide whether the project remains educational or enters commercial validation.

---

## 4. Functional Requirements

Priority notation:

- **P0:** Required for MVP completion.
- **P1:** Valuable but may be deferred.
- **Future:** Explicitly outside the MVP.

### 4.1 Storefront Home and Catalog — P0

**User story:** As a buyer, I want to view the store identity and available products so that I can decide what to buy.

Requirements:

- Display store name and logo.
- Display published products in a responsive grid.
- Each product shows a primary image or fallback, name, price in rupiah, and stock availability.
- Out-of-stock products are clearly marked and cannot be purchased.
- Search, category filters, and catalog pagination are not required for MVP.

Acceptance criteria:

- The storefront is accessible without login.
- Published products show current price and stock state.
- Unpublished products are not purchasable.
- The page is usable on common mobile and desktop sizes.
- Missing images do not produce a broken layout.

### 4.2 Product Detail — P0

**User story:** As a buyer, I want complete product information so that I can make a purchase decision.

Requirements:

- Display product name, price, description, stock state, and up to five images.
- Allow purchase when stock is available.
- Provide a buyer-initiated WhatsApp action for pre-purchase questions.
- Product variants are excluded from MVP.

Acceptance criteria:

- The buyer can navigate available product images.
- The purchase action is unavailable when stock is zero.
- The WhatsApp action includes enough product context to identify the item.
- An unavailable product shows an appropriate not-found or unavailable state.

### 4.3 Shopping Cart — P0

**User story:** As a buyer, I want to collect products before checkout so that I can place one combined order.

Requirements:

- Add, remove, and change product quantities.
- Preserve the cart across refreshes in the same supported browser.
- Display merchandise subtotal.
- Recheck current product availability, price, and stock before order creation.

Acceptance criteria:

- Quantity cannot be below one or above currently available stock.
- Changes in price or availability are shown before the buyer creates an order.
- Totals are exact in rupiah.
- Invalid or unavailable cart items do not proceed silently to payment.

### 4.4 Checkout and Shipping — P0

**User story:** As a buyer, I want to enter delivery details and select shipping so that I know the complete payable total.

Requirements:

- Collect buyer name, phone number, complete address, and a recognized delivery destination.
- Calculate shipping options from the seller's origin to the buyer's destination.
- Use RajaOngkir as the MVP shipping-cost provider.
- Display courier, service, cost, and estimated delivery information when available.
- Display merchandise subtotal, shipping cost, and total.
- Prevent duplicate submissions from creating multiple payable orders.

Acceptance criteria:

- Required buyer and destination data must be valid before order creation.
- The payable total reflects current products and a valid selected shipping option.
- Shipping-service failure produces a recoverable error and does not create a misleading total.
- If a shipping price changes, the buyer must see and accept the current amount.

### 4.5 Payment — P0

**User story:** As a buyer, I want to pay through a trusted provider so that I do not need to transfer money directly to an unfamiliar seller.

Requirements:

- Duitku is the selected MVP payment provider.
- Use the project owner's single Duitku merchant account for the demo store.
- Offer QRIS, virtual account, and e-wallet methods where enabled by the account.
- Show clear pending, paid, expired, failed, and cancelled outcomes.
- Only authoritative provider confirmation may establish successful payment.
- Use Duitku invoice expiration.
- An expired payment attempt becomes a cancelled order and the buyer must begin a new checkout.

Acceptance criteria:

- The charged amount equals the confirmed order total.
- The buyer cannot alter the charged amount.
- A failed payment attempt does not reduce stock.
- Expired unpaid orders do not hold or reduce stock.
- Relevant payment references are available to the seller for support and reconciliation.

### 4.6 Payment and Inventory Correctness — P0

Requirements:

- A confirmed payment updates the correct order exactly once.
- Stock is not reserved or reduced while payment is pending.
- Stock is reduced only after successful payment confirmation.
- Stock must never become negative.
- Invalid, duplicated, unmatched, or inconsistent provider notifications must not duplicate business effects.
- If payment succeeds after stock has become insufficient, preserve the paid order and clearly surface it for manual resolution.

Acceptance criteria:

- Repeated confirmation does not reduce stock more than once.
- Payment and stock outcomes cannot leave a normal paid order partially updated.
- A paid order with insufficient stock is visible as requiring manual action.
- Payment evidence is preserved for support and potential manual refund.

Technical verification and inventory algorithms are defined in `tokonic-technical-design-document.md`.

### 4.7 Buyer-Initiated WhatsApp Confirmation — P0

**User story:** As a buyer who has paid, I want a ready-made WhatsApp action so that I can notify the seller.

Requirements:

- Provide a buyer-initiated WhatsApp confirmation action after payment.
- Include a safe minimum of order context.
- Automatic or server-initiated WhatsApp messaging is excluded.

Acceptance criteria:

- The action targets the seller's configured WhatsApp number.
- It does not expose sensitive payment information or unnecessary buyer data.
- Using WhatsApp does not determine or alter payment status.

### 4.8 Guest Order Lookup — P0

**User story:** As a buyer, I want to check my order without an account so that I can follow fulfillment progress.

Requirements:

- Require both order code and buyer phone number.
- Display current status, ordered items, shipping service, and tracking number when available.
- Only the matching buyer may view the order.
- Failed lookup must not disclose whether an order or payment exists.

Acceptance criteria:

- Incorrect lookup data reveals no order details.
- Internal identifiers, provider payloads, and payment secrets are not displayed.
- Displayed status matches the recorded order state.

### 4.9 Admin Authentication — P0

**User story:** As the seller, I want protected administration so that only I can manage the store.

Requirements:

- Support one seller-admin account.
- Provide login, logout, and password recovery.
- Require authentication for every admin function.
- Public admin signup is unavailable.

Acceptance criteria:

- Unauthenticated users cannot read or change admin data.
- Successful login grants access to the admin area.
- Logout removes access.
- Invalid credentials return a generic error.
- Password recovery is limited to the configured store account.

### 4.10 Product Management — P0

**User story:** As the seller, I want to maintain products so that the storefront remains accurate.

Requirements:

- Create, view, edit, unpublish, and conditionally delete products.
- Manage name, description, price, stock, shipping weight, publication state, and images.
- Accept JPG/JPEG, PNG, and WebP images.
- Maximum image size: 2 MB per stored image.
- Maximum images: five per product.
- Stored images must meet the size limit and must not unnecessarily degrade storefront performance.
- A product may be published without an uploaded image; the storefront uses a fallback.
- Products referenced by historical orders are archived/unpublished rather than destructively deleted.
- Never-ordered products may be deleted.

Acceptance criteria:

- Only the authenticated seller can change products.
- Unsupported files, compressed outputs above 2 MB, and image counts above five are rejected clearly; a larger source file may be accepted if preprocessing produces a valid output.
- Upload, replacement, or deletion failures do not leave a broken product state without an actionable error.
- Historical order items remain unchanged after product edits or archival.

### 4.11 Order Management — P0

**User story:** As the seller, I want to see and process orders so that I know what to pack and ship.

Requirements:

- Show order list, current status, total, buyer, and creation time.
- Show complete order detail and status history.
- Support these normal transitions:
  - `pending → paid` after authoritative payment confirmation.
  - `paid → packed` by seller.
  - `packed → shipped` by seller with tracking number.
  - `shipped → completed` by seller.
- Support `pending → cancelled` for expired or seller-cancelled unpaid orders.
- Support a separate manual-review state for paid orders that cannot be fulfilled normally.
- Prevent arbitrary backward or skipped transitions.
- Automatic completion and buyer-confirmed completion are excluded from MVP.

Acceptance criteria:

- Only valid transitions are accepted.
- Every status change is recorded in history.
- Shipment requires a tracking number.
- Tracking information becomes visible to the buyer.
- Seller completion ends the normal fulfillment flow.

### 4.12 Cancellation and Refund Rules — P0

Requirements:

- Unpaid pending orders may be cancelled without refund or stock changes.
- Expired invoices produce cancelled unpaid orders.
- For MVP, normal paid and packed orders are not cancelled through the ordinary workflow.
- Exceptional paid orders enter manual review.
- Any refund is processed manually by the seller outside Tokonic's automated flow.
- Tokonic may record the manual resolution and refund outcome for audit/support.
- Stock is not automatically restored after refund; the seller decides whether goods are sellable and adjusts stock manually.

### 4.13 Store Settings — P0

**User story:** As the seller, I want to configure store details so that the storefront and shipping calculation are correct.

Requirements:

- Manage store name, logo, shipping-origin address, business timezone, and WhatsApp number.
- Payment-provider and infrastructure credentials are not ordinary seller-editable settings.
- Seller bank-account fields are excluded from MVP because the demo store uses the project owner's Duitku account.

Acceptance criteria:

- Storefront and checkout reflect saved settings.
- Phone, origin, and required store information are validated.
- Only the authenticated seller can change settings.

### 4.14 Basic Sales Summary — P0

**User story:** As the seller, I want a simple sales summary so that I can understand store activity.

Requirements:

- Display total orders and gross paid sales by day and month.
- Pending, expired, failed, and unpaid cancelled orders are excluded from gross paid sales.
- Manual refunds are shown separately and are not silently netted from gross paid sales.
- Use `Asia/Jakarta` as the default business timezone.
- Advanced analytics are excluded.

Acceptance criteria:

- Empty periods show zero/empty states.
- Summary figures can be reconciled with order records for the same period.
- Actionable orders requiring packing, shipment, or manual review are visible.

---

## 5. End-to-End User Flow

1. Buyer browses products and adds available items to the cart.
2. Buyer enters contact and delivery information.
3. Tokonic presents current shipping options.
4. Buyer selects shipping and reviews the total.
5. Tokonic creates a pending order and payment attempt.
6. Buyer pays through Duitku.
7. Authoritative payment confirmation changes the order to paid and reduces available stock once.
8. Buyer may send a WhatsApp confirmation.
9. Seller packs the paid order.
10. Seller ships the parcel and enters the tracking number.
11. Buyer checks status using order code and phone number.
12. Seller marks the shipped order completed.

### 5.1 Exception Outcomes

- **Expired payment:** Order becomes cancelled; buyer begins a new checkout.
- **Invalid or duplicate payment notification:** No duplicated business effect.
- **Paid but insufficient stock:** Order is preserved for manual resolution and possible manual refund.
- **Shipping service unavailable:** Buyer retries; no unverified payable total is used.
- **Image operation failure:** Seller receives an actionable error and the product must not silently appear complete when it is not.
- **Manual refund:** Seller handles the refund and records the outcome if needed.

Detailed workflows and recovery procedures are defined in `tokonic-technical-design-document.md`.

---

## 6. Explicit MVP Exclusions

The following are intentionally excluded:

- Multi-tenant architecture and self-service seller registration.
- Automated seller provisioning and subscription billing.
- Buyer accounts, profiles, wishlists, and saved addresses.
- Product variants.
- In-app live chat.
- Automatic or paid WhatsApp notifications.
- Email notifications.
- Automated courier pickup or booking.
- Multi-warehouse inventory.
- Complex discounts, coupons, promotions, or loyalty programs.
- Product reviews and ratings.
- Multi-admin roles.
- Advanced analytics and forecasting.
- Native mobile applications.
- Automatic order completion.
- Buyer-confirmed completion.
- Automatic refunds.
- Automatic stock restoration after refunds.

---

## 7. Technical Design Boundary

Architecture, technology choices, project structure, data model, service interfaces, payment and shipping integration contracts, authorization controls, image-storage design, inventory algorithms, deployment, observability, migrations, and technical test design are defined in `tokonic-technical-design-document.md`.

The PRD defines product behavior and acceptance outcomes. If a technical implementation conflicts with this PRD, the product behavior in this PRD takes precedence until both documents are deliberately revised.

---

## 8. Security, Privacy, and Reliability Requirements

### 8.1 Security Outcomes

- Only the seller-admin may access administration and buyer fulfillment data.
- Buyers may access only an order that matches their order code and phone number.
- Payment success must be based on authentic provider confirmation.
- Secrets and sensitive payment information must not be exposed publicly.
- Public inputs and uploaded images must be validated.
- Abuse-prone actions such as login, checkout, shipping lookup, and order lookup require reasonable protection.

### 8.2 Privacy Requirements

Tokonic stores buyer name, phone number, and delivery address for transaction, fulfillment, support, and dispute purposes.

- Collect only data required for these purposes.
- Restrict access to the seller-admin and authorized operator.
- Retain buyer-identifying data for one year after an order reaches `completed` or `cancelled`.
- After one year, delete or anonymize buyer-identifying fields while preserving non-identifying transaction data needed for reporting.
- Guest phone-based lookup is no longer available after anonymization.
- Provide a simple one-page privacy notice describing collection, purpose, access, retention, and deletion/anonymization.
- Review applicable Indonesian privacy and commerce obligations before any public commercial launch.

### 8.3 Reliability and Data Integrity Outcomes

- Order totals and historical item details remain accurate.
- Payment confirmation cannot be applied twice.
- Stock cannot become negative.
- A failure in an external service must not be shown as success.
- Payment, shipping, and order problems must be diagnosable and recoverable by the operator.
- Product changes must not corrupt historical orders.

---

## 9. Non-Functional Requirements

### 9.1 Performance

- Target a Lighthouse performance score of at least 80 on representative mobile storefront pages under controlled testing.
- Target Largest Contentful Paint of 2.5 seconds or less when real-user measurement becomes available.
- Core application interactions should remain responsive under one-store demo usage.
- Product images must not unnecessarily degrade storefront loading performance.

### 9.2 Accessibility

- Target WCAG 2.1 AA for core storefront and admin flows.
- All form controls require labels and actionable validation messages.
- Core checkout and admin actions must be keyboard accessible.
- Status must not be conveyed by color alone.
- Target a Lighthouse accessibility score of at least 90 on core pages.

### 9.3 Browser and Device Support

- Support current stable Chrome, Edge, Firefox, and Safari.
- Prioritize storefront usability from 360 px viewport width upward.
- Admin must remain usable on mobile, with desktop optimized for broader management tasks.

### 9.4 Capacity

- Support one low-traffic development/demo store.
- Commercial capacity and cost assumptions require a separate readiness review.

### 9.5 Operational Visibility

- The operator must be able to identify failed shipping requests, payment problems, invalid order transitions, and image-management failures.
- Diagnostic information must not expose secrets or unnecessary personal data.

---

## 10. Measurement Plan

### 10.1 MVP Learning Evidence

Track enough information to confirm:

- Products can be published and purchased.
- Checkout reaches payment.
- Payment confirmation reaches fulfillment.
- Stock remains correct.
- Orders can be packed, shipped, tracked, and completed.
- Manual-review and expiration outcomes are understandable.

### 10.2 Future Commercial Validation

If external sellers are introduced, separately define and measure:

- Seller activation.
- Paid-order volume.
- Checkout completion.
- Seller support burden.
- Renewal intent and willingness to pay.
- Infrastructure cost and margin per store.
- Reasons buyers or sellers bypass Tokonic checkout.

---

## 11. Release Acceptance

The self-study MVP is ready for completion review when:

- All P0 acceptance criteria are satisfied or an exception is explicitly documented.
- The complete sandbox checkout and fulfillment flow succeeds.
- Invalid and duplicate payment confirmation does not corrupt orders or stock.
- Authentication and guest-order privacy behavior pass acceptance testing.
- Product and image limits behave as specified.
- Expiration, manual review, shipment, completion, and retention behavior are demonstrable.
- No known critical defect affects payment amount, stock, access control, or buyer personal data.
- The one-page privacy notice exists.
- Product and technical documentation are consistent.

Technical verification procedures and test coverage are defined in `tokonic-technical-design-document.md`.

---

## 12. Product Risks and Mitigations

| Risk | Product impact | Product mitigation |
|---|---|---|
| Buyers and repeat customers bypass checkout through WhatsApp | Lower recorded transaction volume | Position WhatsApp as pre-purchase support while keeping checkout as the primary purchase action |
| Payment confirmation is delayed, duplicated, or invalid | Incorrect buyer/seller expectations | Show clear order states and preserve authoritative payment evidence |
| Stock changes before delayed payment succeeds | Paid order cannot be fulfilled normally | Do not allow negative stock; surface the order for manual seller resolution |
| Shipping rates are unavailable or inaccurate | Checkout cannot present a trustworthy total | Prevent payment using an unverified shipping total and let the buyer retry |
| Seller misses a paid order because notifications are manual | Delayed fulfillment | Make actionable paid orders prominent in admin and provide buyer-initiated WhatsApp confirmation |
| Guest order lookup is abused | Buyer-data exposure | Require two matching identifiers and disclose no information on failed lookup |
| Product images consume excessive resources | Slow pages or service limits | Enforce product image count, size, and preprocessing limits |
| Privacy obligations are unclear | Inappropriate data retention | Use a fixed one-year policy and review legal obligations before commercial launch |
| Educational deployment is mistaken for production readiness | Reliability or cost problems | Require a separate commercial readiness review before onboarding external sellers |

---

## 13. Product Roadmap

Dates and sprint duration remain TBD.

### Phase 1 — Store Foundation

- Seller access.
- Store settings.
- Product and image management.
- Public catalog and product detail.
- Shopping cart.

**Exit criterion:** The seller can publish products and a buyer can create a valid cart.

### Phase 2 — Checkout and Payment

- Buyer/delivery form.
- RajaOngkir shipping options.
- Order creation.
- Duitku payment and expiration outcomes.
- Correct payment and stock behavior.

**Exit criterion:** A sandbox order can move reliably from checkout to paid or cancelled with correct totals and stock.

### Phase 3 — Fulfillment and Operations

- Order list and detail.
- Status history.
- Packing, shipment, and tracking.
- Guest order lookup.
- WhatsApp confirmation.
- Basic sales summary.

**Exit criterion:** A complete sandbox order can move from payment through seller completion.

### Phase 4 — Privacy and MVP Hardening

- Privacy notice.
- One-year anonymization behavior using test data.
- Accessibility and responsive checks.
- Exception and manual-review flows.
- Product/technical documentation alignment.

**Exit criterion:** The completion criteria and release acceptance requirements are met for the operator-owned demo store.

### Future — Commercial Validation

Only if a real opportunity arises:

- Define seller onboarding and support.
- Define pricing and subscriptions.
- Review provider-account ownership.
- Review paid infrastructure, backups, uptime, and unit economics.
- Test with external sellers before considering multi-tenancy.

---

## 14. Dependencies

- Duitku account access, enabled payment methods, sandbox behavior, and authoritative payment status.
- RajaOngkir account access, shipping coverage, and available rates.
- Availability of the selected application, data, authentication, and image-hosting services defined in the TDD.
- Domain and DNS access; Tokonic domain availability is confirmed, with the exact domain omitted here.
- Seller-origin, product-weight, and courier information needed to calculate shipping.

---

## 15. Decisions and Deferred Items

### 15.1 Resolved MVP Product Decisions

1. The MVP is a self-study/demo store, not a seller-acquisition pilot.
2. RajaOngkir provides shipping costs.
3. One project-owner Duitku account handles demo payments.
4. Stock is not reserved while payment is pending.
5. Expired payment attempts become cancelled and require a new checkout.
6. Paid fulfillment exceptions and refunds are handled manually.
7. One seller-admin account is used.
8. Buyer-identifying data is retained for one year, then deleted or anonymized.
9. Product images use JPG/JPEG, PNG, or WebP; maximum 2 MB each and five per product.
10. Product variants and automatic completion are excluded.
11. Status history is required.
12. Seller-admin alone completes shipped orders in MVP.
13. Gross paid sales and manual refunds are displayed separately using `Asia/Jakarta` by default.
14. Tokonic domain availability is confirmed.

### 15.2 Future Decisions

- Commercial pricing and subscription terms.
- Support and suspension policies.
- External seller onboarding.
- Provider-account ownership for external sellers.
- Production infrastructure, backup, uptime, and unit economics.
- Automated onboarding and billing.
- Multi-tenant architecture.
- Automated notifications.
- Advanced analytics.

---

## 16. Definition of MVP Completion

The self-study cycle is complete when:

1. Section 1.5 completion criteria are met.
2. The complete sandbox transaction and fulfillment flow passes acceptance review.
3. Critical payment, stock, authentication, privacy, and image behavior is demonstrated.
4. Product and technical documentation are aligned and sufficient to extend the project.
5. A retrospective records learning, technical debt, and whether to stop, continue as a portfolio project, or begin separate commercial validation.

---

## 17. Approval Checklist

- [ ] MVP completion criteria.
- [ ] P0 scope and explicit exclusions.
- [ ] Order lifecycle, expiration, manual review, and refund rules.
- [ ] Product/image constraints.
- [ ] One-year privacy and retention policy.
- [ ] Sales-summary definition and timezone.
- [ ] Product roadmap order.
- [ ] Timeline, once known.

---

## Appendix A — PRD-to-TDD Responsibility Map

| Product concern in this PRD | Technical design location |
|---|---|
| Storefront, cart, and checkout | TDD Sections 4–5, 11–13 |
| Payment and inventory correctness | TDD Section 14 |
| Order lifecycle and fulfillment | TDD Sections 15 and 18 |
| Guest order lookup | TDD Section 16 |
| Product and image management | TDD Sections 9 and 17 |
| Seller authentication | TDD Sections 6 and 10 |
| Privacy and retention | TDD Section 19 |
| Security and reliability controls | TDD Sections 8, 20, and 22 |
| Technical testing and release verification | TDD Section 25 |
| Deployment and implementation plan | TDD Sections 23–29 |
