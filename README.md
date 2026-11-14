# HMO Appraisal

A static browser-local appraisal for development, refinance and rental investment. Inputs and imported Excel files stay on the device. No runtime API, backend, database or analytics is used. The private Sites deployment separately requires its host's sign-in.

## Run and test

Current Node.js is required; no dependency installation or build is needed.

    npm start
    npm test

Open http://127.0.0.1:4173. Excel import uses browser `DecompressionStream('deflate-raw')`; use a current Chrome or Edge. Node syntax checks can be run against each `dist/*.js` file. There is no configured framework build or linter.

## Dashboard

Six headline metrics lead to expandable Development, Refinance and Rental groups. Every metric has a formula and line-item dialog. Input categories stay in the original Property/Income/Finance tabs. Additional inputs are collapsed by default; on mobile use Edit assumptions.

`dist/financial.js` contains JSDoc-typed pure functions with rates as fractional decimals and unrounded GBP arithmetic. `dist/model.js` converts the established UI/saved-project percentage convention to the canonical model, validates inputs and preserves original output aliases. `dist/metrics-ui.js` owns metric definitions, explanations and views.

## Funding and cash ledger

Facility limit, drawn principal, retained charges, net advance, finance paid in cash and redemption are separate. Full, simplified average and entered staged drawdowns are supported. Fees are based on drawn principal. Additional arrangement/exit cash fees should not duplicate the combined fee percentage. Unpaid charges may be rolled; retained or already-paid charges are not redeemed twice. Annual rates are nominal and converted to monthly rates; compound mode compounds monthly.

Estimated equity = base costs + holding costs + finance paid in cash − net bridge advance. Actual mode instead sums the contribution entries; an empty actual ledger makes dependent equity metrics unavailable. Contributions and draws use relative months. This is not a monthly peak-cash forecast.

Net refinance = gross loan − advance fees. Signed cash available = net refinance − redemption − other debt redeemed − closing cash costs. Cash returned is floored at zero; a deficit is additional cash required. Signed cash left = equity injected − signed cash available. Capital recycled is signed cash available divided by positive equity injected, so it can exceed 100% or be negative. Actual equity entries must cover every relevant payment; the app does not invent future contributions in stress cases.

## Operating and development measures

Development uplift is GDV less development costs, finance, holding and refinance cash costs. It is paper value uplift, not realised sale profit. Gross and net operating yields use selected GDV. NOI deducts operating costs, but not finance, principal or separately entered reserves. Cash flow deducts full debt service and separate reserves. DSCR is N/A for no debt service; cash-on-cash is N/A unless cash remains invested. Break-even occupancy separates fixed and variable costs and excludes separate reserves.

The user's separate income-recovery measure remains `(25% purchase deposit + SDLT + architects + acquisition legal + acquisition valuation + Habiti fee) / monthly pre-tax cash flow`. It does not deduct refinance cash. Default results are 60.2 months for Option A and 59.5 months for Option B, at 8% management and 100% occupancy.

Rent-multiplier GDV is explicitly indicative. Manual and independent refinance valuations are preserved. Rent changes do not change manual GDV. Refinance valuation stress does not overwrite development GDV. Loan caps/haircuts and actual mortgage principal/payment overrides are explicit. Repayment mortgages include principal in debt service. No tax, product eligibility, licensing approval or lender affordability decision is inferred.

## Compatibility and assumptions

The original localStorage key and project version remain supported. New fields migrate to labelled defaults or null (not entered). Saved values are preserved; unreadable stored data is backed up under the original key plus `-backup`. JSON save/open includes the new assumptions and ledgers. Temporary stress views do not rewrite baseline assumptions.

Optional blank costs count as zero for estimates, not verified zero expenses. Additional operating costs must not duplicate Bills. Excel import supports the established Habiti layouts and uses saved values rather than executing formulas. A worksheet's rounded entered value is preserved in manual mode when it differs from the multiplier value. Date-based interest uses elapsed days / 365.25 × 12; draw schedules remain month-based. Development-period rental cash is not forecast. All results are before tax.

## Source and deployment

`dist/` is the complete standalone website. `test/` contains 31 automated financial and migration tests. `docs/metrics-audit.md` records the inspection, changes and browser checks. The Sites hosting binding is kept in the separate Sites source repository and is excluded from this GitHub mirror.

This personal GitHub repository is a separately synchronised source mirror; Sites deployments do not automatically update it. The included GitHub Pages workflow is manually triggered and can publish `dist` once Pages is enabled with GitHub Actions. Review visibility and account-plan requirements before enabling Pages. Never commit exported user projects or personal workbooks. The updated source ZIP includes this complete implementation.
