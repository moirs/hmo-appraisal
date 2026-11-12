# HMO Appraisal

A browser-local HMO conversion appraisal based on the corrected Habiti workbook. No accounts, analytics, remote APIs or server storage. Files are read on the device. Values persist in localStorage on that browser; use Save project to exchange a JSON project file.

## Run

Requires a current Node.js version. No dependency installation or build is needed.

    npm start

Open http://127.0.0.1:4173. Use current Chrome or Edge for Excel import (requires DecompressionStream with deflate-raw).

    npm test

## Excel import

Supports the two original Habiti template layouts and the corrected linked template. Preserves each option's legal, valuation and bridging assumptions; common property inputs come from the first matching sheet. Different shared purchase/build/rental inputs are reported. Original and corrected template structures must retain source labels. Import reads saved cell values, not a live Excel calculation engine. Save an edited workbook in Excel before import. Unmatched or incomplete workbooks show an error; the current project is retained.

## Calculations

- Full-occupancy annual rent = rooms × room rent × 12. Scenarios vary room rent. Occupancy affects collected income only.
- Calculated valuation = full-occupancy annual rent × multiplier. An optional manual valuation replaces it for refinancing.
- Refinance loan = chosen valuation × refinance LTV. Mortgage is interest-only at the annual mortgage rate.
- Management = percentage of collected rent. Monthly surplus = collected rent − management − bills − mortgage interest.
- Borrowing = purchase × purchase LTV + build × funded share. Full borrowing is assumed drawn from day one. Simple bridging cost = borrowing × (combined fee % + monthly rate × total months).
- Delay adds months of interest and postpones rental commencement until completion. Eventual monthly income is unchanged by delay alone. Holding costs and penalties are not modelled.
- Cost and cashback follow the workbook; capital recovery corrects its duplicated-investment calculation. Cash contributed = property costs including miscellaneous less bridge principal. Cash returned = refinance proceeds less bridge principal and finance costs. Remaining invested cash is their difference. Months of income to all money out uses a separate initial cash basis: 25% of purchase price + stamp duty + architects + solicitors + valuation + Habiti/project fee. Divide this total by net monthly rental surplus, without deducting cashback or cash returned at refinance. The fixed 25% deposit is independent of either LTV control. Miscellaneous, build and bridging costs are excluded from this recovery basis. It is unavailable if the basis is positive and surplus is non-positive. This period starts when letting starts. Option B gives £165,950 / £2,789 = 59.5 months; Option A gives £167,950 / £2,789 = 60.2 months. Refinance LTV defaults to 75% and is adjustable in the GDV panel. All calculations are before tax.

The defaults match the corrected workbook: Option A £35,343.75 bridge cost and £856.25 additional cash released; Option B £28,275 and £9,925 additional cash released. Both show £2,789 monthly surplus at 100% occupancy and 8% management.

## GitHub Pages

The application is completely static with relative asset URLs. The included `.github/workflows/pages.yml` publishes `dist` using GitHub Actions. In a new repository, enable Pages with source **GitHub Actions**, then run the Deploy to GitHub Pages workflow manually from Actions. Project data is not stored in the repository; only the example defaults are in source. Do not commit exported project files. GitHub deployment has not been configured for your account.

## Layout

- `dist/`: standalone deployable application.
- `test/`: financial and import mapping checks.
- `server.mjs`: local preview server.

