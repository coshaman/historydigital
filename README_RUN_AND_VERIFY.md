# Russian Lives: Act III — MAIN20 release candidate

The production route is `http://127.0.0.1:4173/` (or `#main`). The preserved V28 archive is explicit at `#archive-v28`.

```text
npm ci
npm run start
npm run real-build
npm run real-build-browser
npm run check
npm run lint
npm run test
npm run main20-final-acceptance
```

`main20-final-acceptance` expects the local server at `http://127.0.0.1:4173` and writes fresh production-route evidence to `artifacts/final-main20/`. `node_modules` and package archives are not part of the release package.
