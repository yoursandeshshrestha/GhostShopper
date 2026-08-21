# GhostShopper Pricing Specification
### For implementation. v1.0, August 2026. This supersedes the pricing table in the Developer PRD section 7 and the tier list in the v1 design doc.

## The tiers

| Tier ID | Name | Price | Location band | Cadence | Billing |
|---|---|---|---|---|---|
| `local` | Local | £199 per month | 2 to 6 | Weekly shops | Monthly |
| `growth` | Growth | £549 per month | 7 to 15 | Weekly shops | Monthly |
| `scale` | Scale | £1,299 per month | 16 to 40 | Weekly shops | Monthly |
| `brand` | Brand | £40 per location per month | 41+ | Weekly shops | Monthly or annual invoice |

All prices exclude VAT. Currency GBP only in v1.

## Add-ons and modifiers

| Item | Amount | Rules |
|---|---|---|
| Setup fee | £750 one-off | Added as a line item to the first invoice of every new subscription. Waived automatically when the customer takes annual billing. |
| Intensive cadence | +60% on the tier price (or +60% per location on Brand) | Twice-weekly shops. Sold on request only; never displayed on the public pricing page. Stored as a boolean modifier on the subscription. |
| Annual billing | 2 months free (charge 10 months' price for 12) | Offered at point of sale. Also triggers the setup fee waiver. |
| Free audit | £0 | 10 test calls, one round, full scored report. Not a subscription; exists as an org state (`audit`) before any billing record. The previously specced £499 paid pilot is removed; do not build it. |

## Stripe implementation (v1: invoices and payment links, no Checkout)

- Create Products and Prices via a seed script, never by hand in the dashboard:
  - `local_monthly` £199/mo, `growth_monthly` £549/mo, `scale_monthly` £1,299/mo as flat recurring prices
  - `brand_monthly` £40/mo per-unit recurring price, quantity = active location count
  - `setup_fee` £750 one-off price
  - Annual variants: `local_annual` £1,990/yr, `growth_annual` £5,490/yr, `scale_annual` £12,990/yr, `brand_annual` £400 per location per year
  - Intensive is NOT separate Stripe prices in v1: apply it as a 60% invoice line adjustment labelled "Intensive cadence (2x weekly)" so the maths stays visible on the invoice
- Invoices are raised and sent manually from the admin area per the v1 design doc. One webhook (`invoice.paid`) updates the `subscriptions` table.
- Brand tier quantity: sync `location_quantity` from the org's active (non-opted-out, non-paused) location count nightly and on any location change. Quantity changes take effect from the next invoice; no mid-cycle proration in v1.

## App enforcement rules

1. **Band limits are soft-blocked in admin, not customer-facing (customers cannot add locations themselves in v1).** When an operator tries to add a location that exceeds the org's tier band, show the upgrade requirement; superadmin may override, and the override is written to `audit_log`.
2. **Tier stored on the subscription record**: `tier` (`local | growth | scale | brand`), `cadence` (`weekly | intensive`), `billing_period` (`monthly | annual`), `location_quantity` (Brand only).
3. **Scheduling reads cadence**: weekly = 1 shop per location per week; intensive = 2, spaced at least 3 days apart. The existing hard frequency cap (never more than one call per location per 5 days) is amended to: never more than one call per location per 3 days, and never more than the cadence allows.
4. **Audit orgs** (`subscription_status = audit`): scheduler permits exactly one round of up to 10 calls total, then blocks until a subscription exists. Attestation is still required before any audit call; the free audit changes billing state, never safety state.
5. **Past due**: per the existing design, dashboards stay readable, new call scheduling pauses after 7 days past due, nothing is ever deleted.

## Display rules (marketing site and any quotes)

- Public pricing page shows: Local £199, Growth £549, Scale £1,299, and Brand as "£40 per location". Setup fee shown as a footnote line. Intensive cadence not shown.
- The anchor line to use wherever pricing is explained: "Less than one human mystery-shop call per location, for four AI test calls a week."
- Never write a discounted price into any customer-facing document or email template. Discounting is a manual sales action, capped at 10%, applied as an invoice-level adjustment, logged.
- Copy rules apply as everywhere: British English, no em dashes.

## Worked examples (use these as test fixtures)

| Customer | Tier | First invoice | Ongoing |
|---|---|---|---|
| 3-branch letting agency, monthly | Local | £199 + £750 setup = £949 | £199/mo |
| 12-location dental group, monthly | Growth | £549 + £750 = £1,299 | £549/mo |
| 30-site garage group, annual | Scale | £12,990 (setup waived) | £12,990/yr |
| 120-location franchise, monthly, intensive | Brand | (120 × £40 × 1.6) + £750 = £8,430 | £7,680/mo |
| 55-location brand, annual | Brand | 55 × £400 = £22,000 (setup waived) | £22,000/yr, quantity re-synced at renewal |

## Out of scope for v1 (do not build)

Self-serve checkout, customer portal upgrades/downgrades, proration, coupons, multi-currency, usage metering of customers' inbound calls (their call volume is never billed or measured), and the removed £499 paid pilot.
