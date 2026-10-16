# Artifact Markdown Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make one Markdown file per artifact the sole maintained source for artifact metadata and descriptive content while preserving the current frontend and GLB behavior.

**Architecture:** Parse eagerly imported Markdown files with YAML front matter, validate the records, and normalize them to the existing artifact object contract. Provide a one-time, no-overwrite migration command from the old JSON/content pair, then remove those old sources after parity checks.

**Tech Stack:** React 19, Vite 8, Node.js ESM, `yaml` package, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-16-artifact-markdown-data-design.md`

## Global Constraints

- Preserve every current ID, metadata value except the obsolete `contentPath`, asset path, transform, camera setting, and Markdown body; update `contentPath` to `./artifacts/<id>.md`.
- Do not infer missing historical facts or source information; keep blank fields and report them as pending verification.
- Existing frontend data shape and display behavior must remain unchanged.
- Migration must support dry-run, report its actions, and never overwrite an existing Markdown destination.
- Do not keep `artifacts.json` and Markdown as parallel maintained sources after the new reader is verified.

## Review Focus

- Malformed YAML or YAML with a non-object root must cause validation failure and a useful file-specific message (Task 2).
- Duplicate, empty, or filename-mismatched IDs must fail validation without changing records (Task 2).
- Missing/blank source data must remain blank and be reported pending verification (Tasks 1 and 2).
- An existing migration destination must be skipped and preserved byte-for-byte on repeated execution (Task 1).
- Missing model/image files and invalid vector/scalar types must fail validation; valid current paths and transforms must pass (Task 2).

---

### Task 1: Add a safe one-time migration command

**Files:**
- Create: `references/scripts/migrate-artifacts-to-markdown.mjs`\n- Create: `references/scripts/lib/artifact-file-writer.mjs`\n- Create: `references/test/artifactFileWriter.test.mjs`
- Create: `references/scripts/migrate-artifacts-to-markdown.mjs`
- Create: `references/scripts/lib/artifact-file-writer.mjs`
- Create: `references/test/artifactFileWriter.test.mjs`
- Create: `references/test/artifactMigration.test.mjs`
- Modify: `references/package.json`
- Modify: `references/package-lock.json`

**Interfaces:**
- Expose `migrateArtifactRecords({ catalog, readContent, readExisting, writeRecord, dryRun })` from the migration module for testability; return `{ created, skipped, missingContent, pendingFields }`.
- CLI reads old `src/data/artifacts.json`, looks up `src/data/content/<id>.md`, and targets `src/data/artifacts/<id>.md`.
- Serialize all original JSON keys and values to YAML; add `sourceVerified: false` when the source URL is absent/blank and `contentStatus: pending` when the source body is absent. Preserve body bytes after the front matter separator.

- [x] Add migration tests for metadata/body round-trip, dry-run writes nothing, blank source remains blank and is reported, missing body is reported without invented prose, and existing destinations are skipped unchanged on rerun.
- [x] Run `npm test -- --test-name-pattern=artifactMigration` from `references`; confirm tests fail before implementation.
- [x] Add `yaml` as a direct dependency and implement the migration helper plus CLI. Make preview the default; require `--write` to create files. Print a concise per-record report and nonzero exit on unreadable/invalid source data.
- [x] Add `artifacts:migrate` to package scripts and update the lockfile.
- [x] Run the focused migration tests and `npm run artifacts:migrate` dry-run; confirm exactly two current records are planned and the blank source is reported.

### Task 2: Parse, normalize, and validate Markdown records

**Files:**
- Create: `references/src/data/artifactMarkdown.js`
- Delete: `references/src/data/artifactCatalog.js`
- Modify: `references/src/data/artifacts.js`
- Modify: `references/scripts/validate-artifacts.mjs`
- Create: `references/test/artifactMarkdown.test.mjs`

**Interfaces:**
- `parseArtifactDocument(filePath, rawMarkdown)` returns `{ metadata, body }` or throws a file-scoped parse error.
- `loadArtifactRecords(documents, manifest, options)` returns normalized frontend records and validation diagnostics.
- Retain the existing frontend fields, including `id`, `modelFile`, `modelPath`, `name`, `category`, `period`, `material`, `dimensions`, `thumbnailPath`, `sourceUrl`, `keywords`, `modelAttribution`, `modelPosition`, `modelRotation`, `modelScale`, `cameraPosition`, and `contentMarkdown`.

- [x] Add tests for YAML parsing, malformed YAML, non-object front matter, required fields/types, duplicate IDs, filename/ID stability, source URL and verification-state rules, invalid vectors/scales, public path existence, and normalized frontend shape.
- [x] Run focused parser tests and confirm they fail before implementation.
- [x] Implement front matter parsing with the `yaml` dependency; preserve unknown metadata keys in the parsed object and emit warnings for them rather than dropping them. Validate `pendingVerification` as a string array and warn for each listed field.
- [x] Normalize each record while preserving file metadata; join against the generated model manifest to validate `.glb` existence without replacing explicit artifact values. Do not synthesize factual fields.
- [x] Replace `artifacts.js` JSON/content imports with eager `import.meta.glob('./artifacts/*.md', { query: '?raw', import: 'default', eager: true })` loading and expose the normalized `artifacts` array.
- [x] Update the validator command to validate Markdown records and local public assets, reporting counts and pending fields. Keep `artifacts:validate` command name.
- [x] Run focused parser tests and `npm run artifacts:validate` against the migrated documents; confirm malformed values are errors and empty source is a pending warning.

### Task 3: Migrate, verify parity, and remove the legacy source

**Files:**
- Create: `references/src/data/artifacts/local-qingtongrentouxiang.md`
- Create: `references/src/data/artifacts/local-qingtongshenshu.md`
- Modify: `references/scripts/artifact-manifest.mjs`
- Modify: `references/scripts/import-artifacts.mjs`
- Modify: `references/scripts/lib/artifact-import.mjs`
- Modify: `references/README.zh-CN.md`
- Modify: `README.md`
- Delete: `references/src/data/artifacts.json`
- Delete: `references/src/data/content/local-qingtongrentouxiang.md`
- Delete: `references/src/data/content/local-qingtongshenshu.md`
- Modify: `references/test/artifactMarkdown.test.mjs`

**Interfaces:**
- Use the Task 1 migration CLI and Task 2 document parser/validator; no alternate JSON source remains at runtime or build time.

- [x] Run `npm run artifacts:migrate -- --write`; inspect each generated document and confirm all 17 original metadata keys remain, values are retained except `contentPath` now points to the consolidated file, both IDs are unchanged, and each body matches its source file.
- [x] Add or extend parity tests to compare original fixture values (ID, model/image paths, vectors/scales, camera positions, and body) against normalized Markdown output; confirm blank `sourceUrl` remains blank.
- [x] Run the parity tests and `npm run artifacts:validate`; require two records, zero schema/asset errors, and an explicit pending-source warning for the record with no URL.
- [x] Update the generated manifest comment to describe its Markdown metadata source; migrate the CSV import command to read/write Front Matter while preserving existing bodies and creating empty pending bodies for new items; update the Chinese usage guide; remove JSON-specific merge logic.
- [x] Only after parity and validation pass, delete the legacy JSON and content files.
- [x] Run `npm test`, `npm run lint`, and `npm run build` from `references`; all pass when run with subprocess permissions.
- [x] Inspect the final diff and search for `artifacts.json`, `data/content`, `contentPath`, and `mergeArtifactCatalog` references; remove any obsolete runtime/validation dependency while retaining legitimate migration history only if needed.

## Coverage check

- Migration, report, idempotency, and no-overwrite behavior: Task 1.
- Front matter format, YAML and schema validation, and normalized runtime loading: Task 2.
- Existing record/body parity, runtime switch, legacy cleanup, and build/test/lint verification: Task 3.
- UI, search, thumbnail, and 3D behavior are protected by unchanged frontend object properties plus the production build; no component changes are planned.
