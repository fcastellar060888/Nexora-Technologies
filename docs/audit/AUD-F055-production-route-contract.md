# AUD-F055 — Production route contract

## Finding

The forensic matrix records that production routes historically redirected to propagation, a non-equivalent domain.

## Reaudit result

The current application router no longer aliases production URLs to propagation. The six production workflow routes (`harvest`, `drying`, `trimming`, `selection`, `packing`, `flow`) are permission-guarded with `view_production` and render `ProductionUnavailablePage` explicitly.

This is the correct fail-closed behavior while those production capabilities are not implemented: navigation remains semantically truthful and does not expose propagation as if it were production.

## Regression evidence

`tests/aud-f055-production-route-contract.test.js` locks both sides of the contract:

1. every production workflow route renders the explicit unavailable surface;
2. none of those route declarations may redirect to `/propagation/*` or mount `PropagationPage`.

## Certification state

**Ready for Quality / 0 Verified.**

Do not mark AUD-F055 Verified without a GitHub Actions Quality run that receives a real runner and executes its steps successfully.
