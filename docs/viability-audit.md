# Simplified Deal Viability financial screen

## Implemented behaviour

The feature now produces an estimated financial appraisal score directly from imported spreadsheet inputs and the selected assumptions. No extra contribution ledger, funding commitment or due-diligence evidence is required to score a normal imported deal.

The five criteria, weights, thresholds and configurable score bands are retained. Capital recycling uses the existing equity/refinance waterfall and is labelled **Estimated capital recycled**. When actual-ledger mode is selected, the entered ledger is respected and labelled accordingly; an empty selected actual ledger remains unavailable rather than silently falling back to an estimate. Zero equity is N/A. Over-100% recycling is displayed while score input is capped at 100%.

Downside resilience now awards its weight solely when the configured downside monthly cash flow is positive. The dashboard separately shows downside capital remaining, any new cash required at refinance, and monthly cash flow. Capital retained in a deal is distinguished from a new cash contribution.

The headline is **GO candidate / REVIEW / NO-GO — Financial screen only**. Missing financial inputs still require REVIEW. Planning, valuation, lender and funding-evidence statuses no longer affect the score or its band. Their editor is a collapsed optional due-diligence checklist, preserving all existing statuses, notes, references and dates. A financial GO candidate is not investment approval or a substitute for those checks.

## Optional funding check

The optional **Total investor funds available** field uses the existing saved committed-equity value, so entries are not lost. It means funds already invested plus still-available committed investor money, excluding borrowing. An optional additional cash buffer defaults to £0. Legacy blank buffers remain stored as blank but are evaluated as £0, with a visible “no additional buffer assumed” statement.

Required funds = max(0, modeled downside development equity requirement) + any downside refinance top-up + additional buffer. Available investor funds are compared with this total, yielding **Funding covered**, **Funding gap**, or **Not assessed**. Missing funds are not treated as zero; an explicit zero produces a gap where appropriate. The check never alters the financial score. It is a conservative estimate, not a month-by-month peak funding forecast. When fixed loan/payment overrides prevent reliable downside recalculation, the funding check remains not assessed.

## Architecture and compatibility

`financial.js` remains the unchanged canonical financial engine. `viability.js` continues to calculate base and downside cases through it; `viability-ui.js` reuses the existing currency formatting, panels, forms, tables and native disclosures. Existing recovery GDV, headroom, case comparison, financial summary, Excel import, JSON save/open and scenario workflows are preserved.

Saved project/version-1 configuration remains compatible. Custom weights, thresholds, bands, downside settings, evidence, finance assumptions and funding entries are preserved. The legacy equity-evidence policy is retained for file compatibility but no longer blocks estimated recycling; its selector has been removed from the simplified settings. Resetting score settings preserves optional evidence and funding entries.

No underlying finance formula changed. Bridge interest and fixed refinance fees remain counted once. Full-capital-recovery GDV still solves the actual equity/debt waterfall and explains cases where caps, independent refinance valuations or actual-loan overrides make a GDV-based threshold unavailable. The recovery threshold is not economic break-even.

## Assumptions and unavailable figures

- Default downside assumptions remain GDV −10%, build +10%, rent −10%, operating costs +10%, refinance LTV −5 percentage points and bridge +3 months. GDV/rent shocks are independent; base inputs are never mutated.
- Original bridge facility and scheduled draws remain fixed; extra build costs require equity. Extra months increase bridge/holding costs. Rooms earn no development-period rent. Occupancy and separate reserves stay fixed.
- Actual contribution ledgers stay fixed as historical entries; future overruns appear in modeled funding requirements. Downside cash-left figures using actual ledgers do not themselves forecast future contributions.
- Debt service follows the existing interest-only/repayment model. Fixed loan/payment overrides remain reference figures and make downside resilience unknown. DSCR is N/A at zero debt service under the existing explicit policy.
- Optional costs missing from the spreadsheet remain zero estimates under the existing application model. Users should review occupancy, management charges, maintenance, insurance, licensing and other operating costs as applicable. Tax, disposal costs, planning approval, credible lender valuations and financing eligibility are not inferred.

## Verification

**49 automated Node tests pass**, including all existing appraisal tests. Coverage includes immediate spreadsheet-import scoring, estimated/actual/incomplete equity ledgers, optional funding independence, funding gaps/coverage and buffer defaults, unchanged legacy-data roundtrips, optional evidence having no scoring effect, canonical fees/waterfall reconciliation, missing/zero inputs, fixed overrides, immutable downside calculations and semantic/escaping checks.

Browser checks at desktop 1440×1000 and mobile 390×844 confirmed no document horizontal overflow, keyboard disclosure activation, immediate 100/100 scoring for the example, separate funding gaps/coverage without score changes, saved funding and checklist evidence surviving reload, and the checklist defaulting to collapsed. Empty available-funds and buffer fields return “Not assessed” with £0 assumed buffer. No browser console errors were observed.

All distribution/test JavaScript modules pass syntax checks. This buildless application has no configured lint, TypeScript compiler or build step.
