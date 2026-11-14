# Financial metrics upgrade — 14 November 2026

## Source and scope

The existing Sites source repository was opened and synchronised before editing. Its starting commit was `9cf16aa159f4b8f7348538f8f308d653d388ec26`. The implementation follows the supplied `hmo_appraisal_codex_spec.md`. The private site's source and local preview were the inspection baseline; private URL access is not assumed to be public.

The app remains buildless JavaScript with relative static assets. Pure JSDoc-typed calculation functions use fractional rates internally; the legacy saved-project and UI percentage convention is preserved by an adapter. No new backend, accounts, remote file processing or database was introduced.

## Existing functionality inventory

| Area | Before | After |
|---|---|---|
| Inputs | Purchase, SDLT, architects, build, project fee, miscellaneous; option-specific legal and valuation costs | Preserved, with optional acquisition/development/holding costs |
| Operations | Rooms, per-room rent, occupancy, management percentage, aggregate bills | Preserved, with optional fixed/variable operating costs, management amount override and separate reserves |
| Valuation | Rent multiplier and optional manual override | Explicit indicative/manual mode; entered manual value is preserved across switches; separate refinance value, haircut and loan cap |
| Bridge | Acquisition/build funding percentages, monthly rate, combined fee percentage and term | Preserved, with facility/drawn/net-advance distinction, full/average/staged draw modes, annual nominal rate option, simple/compound monthly interest, paid/rolled/retained charges and additional fee amounts |
| Refinance | LTV and interest-only mortgage | Preserved, with advance fees, closing cash costs, debt redemption, retained secured debt, actual loan override, repayment mortgage and payment override |
| Equity | Cost less bridge principal estimate | Explicit estimated or actual contribution ledger; cash available, cash returned, top-up and signed cash remaining are separate |
| Scenarios | Rent slider, 0/1/3/6-month overruns, rent/overrun grid and two SVG charts | Preserved, with valuation/LTV/build/term/rent/occupancy/rate sensitivity and editable row values |
| Comparison | Two funding options with differing legal/valuation costs | Differences flagged; optional cost normalisation and sorting by cash left, cash flow, profit on cost or DSCR |
| Persistence | Browser localStorage and JSON save/open | Same storage key and format version; missing new fields migrate to explicitly labelled assumptions; original scalar values retained |
| Import/export | Excel import and print | Preserved; manually rounded worksheet valuations are now retained in manual mode; print expands all metric groups |

## Metric presentation

Six headline cards: signed cash left in deal, monthly pre-tax cash flow, development profit on cost, GDV, adjustable refinance LTV and DSCR. The previous request to remove the cash card is superseded by the new specification explicitly requesting it in the headline group. A negative amount is accompanied by “released above original cash contribution”; positive capital is labelled as remaining.

Expandable groups provide development cost/uplift/profit margins/funding/duration; refinance value/loans/redemption/equity injection/cash returned/top-up/recycling/equity retained; rent/expenses/NOI/yields/debt service/cash flow/DSCR/cash-on-cash/break-even occupancy/income recovery. Question-mark controls show each formula, a line-item breakdown and the relevant assumption warnings. DSCR below 1.00×, negative income and required cash are explicitly identified; colour is not the only signal.

## Calculation changes and safeguards

- Default costs, borrowing, rental cash flow and the user's six-item income-recovery measure remain regression-tested. At default 8% management, Option A is 60.2 income months; Option B is 59.5. This measure does not deduct refinance cash.
- Cash returned previously could be negative. It is now `max(0, cashAvailableAtRefinance)`, with the deficit shown as additional cash required. Signed cash left uses equity cash injected minus signed cash available, so a refinance top-up increases cash remaining correctly.
- The primary cash calculation follows net bridge advance, finance paid in cash, actual/estimated equity, net refinance funds and redemption. It does not use total project cost less refinance as a shortcut. Coincidence with that shortcut in simple examples is not assumed for complex cases.
- Retained fees/interest reduce bridge cash advanced. Only unpaid, unretained rolled amounts enter redemption. Paid and retained amounts are not charged a second time at refinance.
- Total development cost includes entered bridge finance, holding costs and refinance transaction/closing cash costs. Other debt principal repayments are not labelled project costs.
- Entered actual equity ledgers are held fixed under sensitivity. An empty actual ledger produces N/A for dependent equity measures, not a false zero. Future equity contributions or missing overruns must be entered explicitly.
- NOI excludes interest and principal. Annual debt service includes scheduled principal for repayment mortgages. Cash reserves entered separately are deducted after NOI.
- DSCR is N/A for zero debt service. Cash-on-cash is N/A unless capital remains invested. Zero valuation/rent/project-cost denominators produce N/A instead of Infinity or NaN.
- Manual GDV does not change with rent. Refinance valuation stress changes the refinance valuation, not an independently entered development GDV. A separately entered refinance valuation stays independent of rent. An actual loan or mortgage-payment override is held fixed and clearly identified.
- The original importer could replace a manually rounded worksheet value with the precise multiplier value. Import now preserves the worksheet's selected value when they differ, showing manual and indicative figures separately.
- Optional new costs remain blank/not entered. Totals treat them as zero estimates, not verified zero costs. Bills remain the original aggregate; users are told to enter only incremental costs in the additional categories.

## Verification

Baseline: all 11 pre-existing tests passed before editing. Current automated suite: **31 tests pass**, covering the three supplied illustrative worksheets, valuation modes and rounding, full/partial/excess capital recovery, refinance top-ups/fees/caps, staged/average/partial drawdowns, retained/paid/rolled charges, additional arrangement/exit fees, simple/compound and annual nominal interest, interest-only/repayment/zero-interest payments, operating costs/reserves/DSCR/break-even occupancy, zero denominators, migration/validation, valid/invalid dates and sensitivity immutability.

All application JavaScript receives Node syntax checks. No framework build or linter was configured in the original project; no dependency installation is required.

Scripted browser checks exercise headline values, native metric dialogs, cost normalisation, LTV changes, manual valuation remaining fixed under rent changes, missing valuation N/A, occupancy zero/negative cash flow, repayment mortgages, missing actual-equity ledger N/A, contribution-ledger apply, temporary sensitivity and reset, mobile assumption expansion, console warnings/errors and responsive widths. Desktop 1440×1000 and mobile 390×844 views were reviewed; no horizontal page overflow was observed. Screenshots were displayed during browser QA.

## Assumptions and limits

- These are pre-tax assumption-based estimates, not verified valuations or lending offers. Multiplier GDV remains indicative; room count does not establish planning, licensing or lending eligibility.
- Existing projects default to full drawn funding, simple interest and rolled unpaid charges, preserving their original numbers. Average drawn share (50%) and repayment amortisation (25 years) are visibly labelled defaults, used only when their modes are selected.
- Draws and equity entries use months relative to purchase. Optional date timing converts actual elapsed days to months using 365.25 days per year. This is not a lender-specific daily accrual or servicing system.
- Funding requirement is the estimated total equity requirement, not peak cash from a monthly cash-flow forecast. Development-period rental cash is not forecast. Stabilised rent begins after the assumed completion.
- Actual equity, actual-loan/payment overrides and separately entered valuations require review when stressing a case. The app does not invent future investor contributions or lender affordability rules. A maximum loan and valuation haircut can be entered; no product-specific ICR/DSCR lending approval is inferred.
- Reserve inputs are separate from NOI; do not duplicate maintenance already entered as an operating cost. Break-even occupancy excludes those separate reserves and can exceed 100%, which is labelled unachievable.
- This task updates the private Sites app. The previously created personal GitHub repository is a separate source mirror and is not automatically synchronised by a Sites deployment. A complete updated source ZIP is supplied. This GitHub mirror was subsequently synchronised at the user’s request, retaining its manual Pages deployment workflow.

## Files changed

- `dist/financial.js`: new pure typed calculation layer.
- `dist/model.js`: compatible input adapter, migration, validation and legacy output aliases.
- `dist/metrics-ui.js`: metric groups, formula dialogs, optional inputs, sensitivity and comparison.
- `dist/app.js`: preserved import/save/chart/navigation flows, new rendering and input handlers.
- `dist/index.html` and `dist/styles.css`: summary groups, dialog, responsive assumption panel and additional controls.
- `dist/xlsx.js`: preserve selected/rounded worksheet valuation.
- `test/financial.test.mjs`: new financial reference and edge-case tests; existing `test/model.test.mjs` retained.
- `README.md` and this report: methods, assumptions and verification.
