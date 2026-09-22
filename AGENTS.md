# Agent instructions

## Project and priorities

This is an Obsidian plugin that displays a formatted reference in the sidebar
for each Pandoc citekey in the active document.

Prioritize, in order:

1. Correctness and user data/privacy protection.
2. Compatibility with current Obsidian desktop and mobile APIs.
3. Simplicity and maintainability.
4. Minimal dependencies and release output.
5. Appropriate performance for normal vaults.

Prefer the smallest clear change that solves the problem. Avoid speculative
refactors, unnecessary abstractions, and new dependencies when the platform,
existing code, or a small local helper is sufficient.

## Documentation and external APIs

When a task involves an external API or integration, consult the authoritative
documentation before editing code. Do not rely on memory, old examples, issue
comments, logs, or third-party posts when authoritative documentation exists.

- **Zotero Web API:** use
  https://www.zotero.org/support/dev/web_api/ and, as a source fallback,
  https://github.com/zotero/zotero-docs. The published documentation is
  authoritative if the two differ. This plugin uses the local Zotero API at
  `localhost:23119/api/`, which implements the Zotero Web API v3 against the
  user's local database. The schema is available here: https://api.zotero.org/schema
- **Obsidian:** use https://docs.obsidian.md/ for lifecycle, views, menus,
  settings, workspace events, metadata, Markdown, CodeMirror, and mobile APIs.
  Prefer documented public APIs; avoid private internals and Electron/Node APIs
  unless the desktop-only boundary explicitly requires them.

Before implementation, report the sources consulted and the requirements that
affect the change. If a source cannot be fetched, state why, identify any
fallback, mark memory or inference as unverified, and use a conservative
implementation. After implementation, verify the relevant code against the
documentation again and report unresolved mismatches.

## Build, test, and lint

Development and release builds require Node.js 24.21.0 or newer. Use the
repository's npm scripts:

- `npm run dev` - esbuild watch mode, writing the development bundle to
  `main.js`.
- `npm run build` - create the production bundle.
- `npm run check-types` - TypeScript checking without emitting files.
- `npm run lint` - lint `src`.
- `npm run lint:fix` - apply ESLint fixes under `src`.
- `npm run prettier` - format TypeScript and TSX files under `src`.
- `npm test` - run the Jest suite.
- `npm test -- src/parser/tests/parser.test.ts` - parser tests only.
- `npm test -- src/bib/tests/bibManager.test.ts` - bibliography helper tests
  only.
- `npm test -- src/parser/tests/parser.test.ts -t "getCitationSegments"` -
  run a focused parser test group.

Local Zotero integration tests and locale/style network tests are skipped by
default; production downloads remain enabled. Run all integration tests with
`RUN_INTEGRATION_TESTS=1 npm test`.

For normal source changes, run `npm run check-types`, `npm run lint`, and the
relevant tests. Run `npm run build` for bundling, release-file, or runtime
integration changes. `main.js` and source maps are ignored generated artifacts;
do not commit them. The tag-triggered release workflow builds and publishes
`main.js`, `manifest.json`, and `styles.css`.

## Architecture and invariants

- `src/main.ts` is the lifecycle/orchestration layer. It loads settings,
  creates `BibManager`, and registers the sidebar view, settings tab, editor
  suggestion provider, Markdown postprocessor, CodeMirror extensions, and
  workspace/metadata handlers.
- Initialization is asynchronous. Code needing bibliography data must wait for
  both `plugin.initPromise` and `bibManager.initPromise`.
- `src/bib/bibManager.ts` converts BibTeX/YAML/etc. through Pandoc `csljson`
  while accepting CSL JSON directly; loads and caches CSL styles and locale XML
  in the vault's `.pandoc` directory; builds citeproc engines; handles global
  settings and per-file frontmatter overrides; maintains the global
  bibliography and LRU per-file cache; watches bibliography files; and
  integrates with the local Zotero API. Bibliography, style, and locale
  resources may be overridden per file.
- `src/parser/parser.ts` parses Pandoc citation syntax into typed segments and
  groups, including locators, prefixes/suffixes, suppressors, explicit
  locators, and links. `src/parser/citeproc.ts` adapts groups to citeproc.
- `src/editorExtension.ts` handles CodeMirror/live-preview decorations and
  rendered citation widgets. `src/markdownPostprocessor.ts` handles reading
  mode and citation tooltips. These paths must remain behaviorally consistent.
- `src/view.ts` renders the active document's formatted bibliography in the
  sidebar. `src/citeSuggest/citeSuggest.ts` completes `@citekey` input using
  the active bibliography cache and Fuse.js. Settings are in `src/settings.tsx`
  and persist through Obsidian's plugin data API.

Preserve these invariants:

- Citation parsing is shared infrastructure; never add a second parser. When
  syntax changes, update parser fixtures and verify both rendering paths.
- Preserve asynchronous initialization, cache invalidation, bibliography
  watchers, and per-file overrides when changing bibliography or settings.
- Preserve user-facing frontmatter aliases `csl`/`citation-style` and
  `lang`/`citation-language`, and use existing reinitialization paths when
  settings change.
- Reproduce the actual Live Preview lifecycle before claiming a fix: test
  focused editing and unfocused/prerendered states, including Obsidian-rendered
  callout DOM when CM6 replaces source lines.

## Mobile compatibility

Use public, cross-platform Obsidian APIs and browser-compatible APIs for new or
changed code. Do not introduce Electron, filesystem, process, child-process,
shell, or Node-only APIs into shared runtime paths. Isolate desktop-only
behavior behind capability checks with a safe mobile path or graceful omission.
Consider touch interaction, narrow layouts, lifecycle, reduced resources,
offline operation, vault permissions, and the absence of desktop keyboard,
hover, or workspace assumptions. Test or reason about both desktop and mobile
behavior and document limitations that cannot be tested locally.

## Security, privacy, and dependencies

Treat vault contents, bibliography files, Zotero data, API credentials, and
downloaded resources as sensitive. Never log, commit, display, or include
secrets, authorization headers, private URLs, or full private API responses.
Validate untrusted paths, URLs, frontmatter, citekeys, API responses, and
rendered HTML at their boundaries. Preserve request origin/scope checks; do
not broaden network access or create an arbitrary proxy without an explicit
requirement and security review.

Prefer safe DOM APIs and existing Obsidian rendering mechanisms. Avoid unsafe
HTML, dynamic script execution, `eval`, and `new Function`. Bound external
downloads and cache them only in the existing controlled location. Handle
malformed, oversized, unavailable, or unexpected resources safely; fail closed
where practical. Do not change files outside explicitly required vault or
plugin-owned cache locations.

Before adding or retaining a dependency, check registry metadata, deprecation,
maintenance/source location, licensing, security, size, and transitive cost.
Prefer no dependency, or a small well-maintained dependency with a narrow
purpose. Keep source changes under `src`; `src/main.ts` is the only esbuild
entry point and `esbuild.config.mjs` externalizes Obsidian, Electron, Node
built-ins, and CodeMirror packages.

## Repository conventions and change workflow

- `tsconfig.json` sets `baseUrl` to the repository root; both relative and
  `src/...` imports are used.
- Treat referenced repository documentation as authoritative for external
  integrations. Respect explicit privacy boundaries and do not inspect excluded
  or confidential directories; do not infer undocumented API behavior from
  logs when documented behavior is available.
- Follow Prettier: two spaces, single quotes, semicolons, LF endings, and an
  80-column print width. ESLint applies to `src`.
- Keep generated locale/style downloads, test-created caches, coverage, and
  build artifacts out of commits.
- Release metadata is coordinated across `package.json`, `manifest.json`, and
  `versions.json`; use the existing `npm run bump`/`version-bump.mjs` flow.

For each change:

1. Inspect the relevant implementation, tests, package scripts, and release
   configuration.
2. Consult and report the relevant authoritative documentation.
3. Make the smallest focused change while preserving compatibility.
4. Add or update tests for behavior, errors, security boundaries, and
   desktop/mobile differences where applicable.
5. Run targeted tests first, then the standard checks required by the change.
6. Review the diff for generated files, dependency changes, secret exposure,
   platform assumptions, and unnecessary complexity.
7. Summarize documentation consulted, validation performed, and limitations.
