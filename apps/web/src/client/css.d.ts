/**
 * Plain `.css` side-effect imports, typed.
 *
 * `main.tsx` and the training entry import their stylesheets for the side
 * effect alone (`import './styles.css'`); vite bundles them. With
 * `noUncheckedSideEffectImports` on — set in tsconfig.base.json, and the
 * default from TypeScript 6 — tsc has to resolve every such import, and a
 * stylesheet is not something it can resolve on its own. As with `?raw` (see
 * training/raw.d.ts), `vite/client` would declare this, but it would drag
 * `import.meta.env` and the whole asset-module surface into the project, so
 * the one form actually used is declared here instead.
 */

declare module '*.css';
