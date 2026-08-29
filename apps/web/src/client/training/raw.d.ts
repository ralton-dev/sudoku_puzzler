/**
 * Vite's `?raw` import suffix, typed.
 *
 * `prose/<techniqueId>.md` is imported as a string (decision 18: the prose is
 * content, not code, and lives next to the component that renders it). Vite
 * ships `vite/client` with a declaration for this, but the client `tsconfig`
 * does not pull `vite/client` in — it would drag `import.meta.env` and the
 * whole asset-module surface into a package that wants neither — so the one
 * form actually used is declared here instead.
 */

declare module '*.md?raw' {
  const content: string;
  export default content;
}
