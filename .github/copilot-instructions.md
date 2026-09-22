# Copilot instructions

## Build, test, and lint

Use the repository's npm scripts:

Development and release builds require Node.js 24.21.0 or newer.

- `npm run dev` - run esbuild in watch mode and write the development bundle to `main.js`.
- `npm run build` - create the production bundle in `main.js`.
- `npm run check-types` - run TypeScript checking without emitting files.
- `npm run lint` - lint `src`.
- `npm run lint:fix` - apply ESLint fixes under `src`.
- `npm run prettier` - format TypeScript and TSX files under `src`.
- `npm test` - run the Jest suite.
- `npm test -- src/parser/tests/parser.test.ts` - run only the parser tests.
- `npm test -- src/bib/tests/bibManager.test.ts` - run only the bibliography helper tests.
- `npm test -- src/parser/tests/parser.test.ts -t "getCitationSegments"` - run a focused Jest test group.

The local Zotero integration tests are skipped by default because they depend on
a user's private Zotero instance. The locale/style network tests are also
skipped by default; production downloads remain enabled. Run all integration
tests explicitly with `RUN_INTEGRATION_TESTS=1 npm test`.

The production build is the release artifact. `main.js` and source maps are
ignored by Git; do not commit the generated bundle. The tag-triggered release
workflow installs dependencies, runs `npm run build`, and publishes
`main.js`, `manifest.json`, and `styles.css`.

## Architecture

This is a desktop-only Obsidian plugin. `src/main.ts` is the lifecycle and
orchestration layer: it loads settings, creates the `BibManager`, registers
the sidebar view, settings tab, editor suggestion provider, Markdown
postprocessor, CodeMirror extensions, and workspace/metadata event handlers.
Initialization is intentionally asynchronous; code that needs bibliography
data must wait for both `plugin.initPromise` and `bibManager.initPromise`.

`src/bib/bibManager.ts` is the data and citation-rendering center. It:

- Converts BibTeX/YAML/etc. through Pandoc's `csljson` output, while accepting
  CSL JSON directly.
- Loads CSL styles and locale XML, caches them in the vault's `.pandoc`
  directory, and builds citeproc engines.
- Supports global settings and per-file frontmatter overrides for
  `bibliography`, `csl`/`citation-style`, and `lang`/`citation-language`.
- Maintains the global bibliography plus an LRU per-file cache containing
  parsed citation keys, resolved/unresolved keys, rendered citations, and
  bibliography HTML.
- Watches bibliography files and invalidates/reprocesses affected references.
- Optionally discovers Zotero groups through the local Better BibTeX HTTP API
  and loads bibliography entries through Zotero's local API.

`src/parser/parser.ts` parses Pandoc citation syntax into typed segments and
citation groups, including locators, prefixes/suffixes, suppressors, explicit
locators, and link handling. `src/parser/citeproc.ts` adapts those groups to
citeproc output.

There are two rendering paths that must stay behaviorally consistent:

- `src/editorExtension.ts` decorates CodeMirror/live-preview text and replaces
  resolved citations with rendered widgets.
- `src/markdownPostprocessor.ts` transforms reading-mode Markdown output and
  binds citation tooltips.

`src/view.ts` renders the active document's formatted bibliography in the
sidebar. `src/citeSuggest/citeSuggest.ts` uses the active bibliography cache
and Fuse.js to complete `@citekey` input. Settings UI is in `src/settings.tsx`
and persists through Obsidian's plugin data API.

## Repository conventions

- Before adding or retaining a dependency, check its current registry metadata,
  deprecation status, maintenance/source location, and whether Node.js, Obsidian,
  browser DOM APIs, or esbuild already provide the required capability. Prefer a
  small local helper for narrow functionality when it is clearer than another
  runtime dependency.
- Treat referenced repository documentation as authoritative for external
  integrations. Respect explicit privacy boundaries and do not inspect excluded
  or confidential directories. Do not infer undocumented API behavior from logs
  when the documented API can be used instead.
- Reproduce the exact rendering lifecycle described by the issue before claiming
  a fix. For Live Preview, validate both focused editing and unfocused/prerendered
  states, including Obsidian-rendered callout DOM when CM6 replaces source lines;
  parser-only or initial-render checks are not sufficient.
- Keep source changes under `src`; the only esbuild entry point is
  `src/main.ts`, and dependencies such as `obsidian`, Electron, Node built-ins,
  and CodeMirror packages are externalized by `esbuild.config.mjs`.
- Use the existing TypeScript path convention: `tsconfig.json` sets `baseUrl`
  to the repository root, so both relative imports and `src/...` imports are
  present in the codebase.
- Citation parsing is shared infrastructure. When changing citation syntax,
  update the parser fixtures and verify both the CodeMirror and Markdown
  rendering paths rather than adding a second parser.
- Bibliography/style/locale resources are cached and may be overridden per
  file. Preserve cache invalidation and file-watcher behavior when changing
  settings or bibliography loading.
- Obsidian settings keys and frontmatter aliases are part of the user-facing
  behavior. Preserve existing aliases (`csl`/`citation-style`,
  `lang`/`citation-language`) and call the existing reinitialization paths
  when settings change.
- Formatting follows the repository Prettier configuration: two spaces,
  single quotes, semicolons, LF line endings, and an 80-column print width.
  ESLint applies to `src` with the repository's TypeScript rules.
- Keep generated locale/style downloads, test-created cache files, and
  coverage output out of commits; the repository's ignore rules already cover
  these artifacts.
- Release metadata is coordinated across `package.json`, `manifest.json`, and
  `versions.json`; use the existing `npm run bump`/`version-bump.mjs` flow rather
  than editing only one version file.
