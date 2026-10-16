# Artifact Markdown Data Design

## Goal and constraints

Move artifact metadata and its existing descriptive Markdown into one file per artifact under `references/src/data/artifacts/<id>.md`. Preserve every current artifact ID, metadata field, asset path, model setting, camera setting, and body byte-for-byte where practical. Update only the obsolete `contentPath` value to point to its consolidated Markdown document. Do not infer missing historical facts, dimensions, source URLs, or other catalog values. Missing and unverifiable information must remain explicit and be reported for review.

Keep the existing frontend artifact object contract so list, detail, search, thumbnails, and the GLB viewer continue to work. The generated local GLB manifest remains useful for discovering available model files, but it must not become a competing source of artifact metadata.

## Current architecture

- `references/src/data/artifacts.json` has two records and stores `id`, `modelFile`, `modelPath`, `name`, `category`, `period`, `material`, `dimensions`, `thumbnailPath`, `sourceUrl`, `keywords`, `modelAttribution`, `modelPosition`, `modelRotation`, `modelScale`, `cameraPosition`, and `contentPath`.
- `references/src/data/content/<id>.md` stores the corresponding description body. Both current files have content under `## 文物描述`.
- `artifact-manifest.generated.js` discovers GLB files and assigns default IDs, model paths, and camera positions. `artifactCatalog.js` merges the generated manifest, JSON records, and Markdown content.
- `artifacts.js` is the runtime import used by `App.jsx`; UI components expect the merged object fields, including `contentMarkdown`.
- `validate-artifacts.mjs` validates the old JSON/content pair and local public assets. The project has no YAML front matter dependency. `ArtifactMarkdown` and `parseArtifactMarkdown` are existing Markdown consumers and remain in place.

## Proposed data format and runtime

Each artifact Markdown document starts with YAML front matter containing the full existing record, retaining existing field names to minimize adapter changes. The original Markdown body follows the closing delimiter. Add migration status metadata needed to represent missing or unverified source information; do not rename IDs or modify any model, image, camera, or display values. A blank `sourceUrl` remains blank and is marked pending verification rather than replaced with a guessed URL. Include `pendingVerification` as a list of missing or unverified metadata fields, and keep `sourceVerified: false` until a person verifies the source. Update the legacy `contentPath` value to `./artifacts/<id>.md` so it points at the consolidated document; the runtime maps that document's body directly to `contentMarkdown` and does not read through `contentPath`.

At build time Vite eagerly imports `src/data/artifacts/*.md` as raw text. A shared parser separates front matter and body, parses YAML with a small maintained YAML parser, validates the parsed records, then maps each record to the existing frontend shape. Reuse existing Markdown rendering and section parsing. The generated model manifest continues to check model availability and supplies defaults only where those defaults already exist today; each migrated file takes precedence for its original explicit metadata.

## Migration and safety

Add a one-time Node migration command that reads the current JSON and resolves each `contentPath` by stable ID. It emits one Markdown file per JSON record. Dry-run is the default preview mode or an explicit flag, and the report includes records considered, files to create, missing content, missing/blank metadata, and existing destination files. Normal execution must refuse to overwrite an existing destination; reruns skip existing files and report them, preserving manual edits. Copy body text without generating replacement prose. Missing content is represented as an empty body plus a clear pending-content marker in metadata/report, not invented text.

Initially retain the old JSON and content files. After migrated records pass byte/content and field parity checks and the new reader, validation, tests, and production build pass, remove the old files and old loader branches in the same implementation. This sequencing prevents accidental information loss and avoids a long-lived dual-source arrangement.

## Validation

Update `artifacts:validate` to read the Markdown directory and fail on malformed YAML, non-object front matter, missing/duplicate/unstable IDs, missing required identity/model fields, incorrect primitive or vector types, invalid source URL format, invalid verification status, invalid or missing local model/image paths, and duplicate model files. Unknown front matter keys should be preserved and reported rather than discarded, protecting future business fields. Empty optional factual fields should be warnings/pending verification, not errors that force fabricated values. Verify every document maps to exactly one stable ID and every current catalog record has a migrated document.

## Compatibility and user-visible behavior

No UI or 3D presentation changes are intended. Keep current normalized property names and values so search, categories, metadata rows, selected IDs, model URLs, rotations/scales, camera setup, and thumbnails behave exactly as before. JSON can be removed once Vite directly imports the Markdown documents; no generated JSON compatibility file is needed.

## Implementation scope

Expected files:

- Add `references/src/data/artifacts/<id>.md` for each current catalog record.
- Add a front matter parsing/normalization module and a one-time migration script.
- Update `artifacts.js`, `artifactCatalog.js`, `validate-artifacts.mjs`, the manifest generator comment, and package scripts/dependencies as required.
- Add focused Node tests for parsing, migration idempotency/no-overwrite behavior, schema validation, and frontend-shape normalization.
- Remove `references/src/data/artifacts.json` and `references/src/data/content/` only after parity and build checks succeed.

## Verification criteria

- Both current catalog entries migrate, with unchanged IDs and exact existing metadata values.
- Each original Markdown body is retained without loss.
- Empty source URL on the second record remains empty and is flagged for verification.
- Model/image paths and model transform/camera values match the current data.
- Validation catches malformed YAML, invalid field types, duplicate IDs, and nonexistent assets.
- Existing tests, lint, and production build pass; frontend list/detail and GLB functionality retain the existing data contract.
