# Alvin Silva — Production Update Package

This package contains the corrected shared CSS layer, visualization layer,
static-site validator, strengthened GitHub Actions workflow, and exact patches
for the two malformed stylesheet declarations identified during the deployment
audit.

## Apply

Copy:

- `assets/css/components.css` → repository `assets/css/components.css`
- `assets/css/visualizations.css` → repository `assets/css/visualizations.css`
- `scripts/validate-static-site.mjs` → repository `scripts/validate-static-site.mjs`
- `.github/workflows/validate.yml` → replace repository workflow

Then apply:

- `patches/index.html.patch`
- `patches/portfolio.html.patch`

The HTML patches add the missing `>` that terminates the visualization stylesheet
`<link>` element. No page-level design or business logic is changed.

## Validation

From the repository root:

    node scripts/validate-static-site.mjs

Then run:

    git diff --check

and push to `main` so GitHub Actions executes the production validation workflow.

## Design-preservation rule

The package deliberately avoids a framework migration, npm dependency,
database, external AI service, or redesign. The existing static HTML/CSS/vanilla
JavaScript architecture remains authoritative.
