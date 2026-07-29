## Why

The sync subsystem imports Xiaomi health data into the same `Exercise`, `Sleep`, and `Weight` tables that manual entries use. Currently, imported records are not displayed consistently with native records: machine-only exercise types (`steps`, `heart_rate`, `calories`, etc.) have no translation keys, the source is invisible in the UI, and synced activity objects are rendered as broken empty tags because the detail page assumes every activity is `{name: string}`. This makes imported data feel like a second-class citizen and can confuse users.

This change unifies the dashboard display so that synced records look and behave like native records, with minimal and safe UI-only edits.

## What Changes

**Phase 1 (minimum viable)**:
- Add translation keys for synced exercise types (`steps`, `heart_rate`, `calories`, `spo2`, `valid_stand`, `intensity`, `stress`) in both `messages/en.json` and `messages/zh.json`.
- Add a small `SourceBadge` component that shows the sync source (e.g. `小米` / `Mi`) when `sourceId` is present.
- Surface `sourceId` in dashboard TypeScript interfaces and render `SourceBadge` on list, detail, and timeline views for `Exercise`, `Sleep`, and `Weight`.
- Fix the exercise detail page to render synced `activities` as a readable key-value grid when the payload is an object instead of an array of `{name: string}`.
- Change visible labels in the exercise dashboard to reflect that records may be daily summaries, not only workout sessions.

**Phase 2 (future)**:
- Split the exercise statistics view into two distinct sections: one for human-logged workout sessions and one for synced daily health metrics, so that totals and averages are not misleading.

**Out of scope**:
- No API endpoint changes, no Prisma schema changes, no sync engine changes, and no changes to how soft-deleted synced records are handled.

## Capabilities

### New Capabilities
- `synced-data-display`: Unified dashboard rendering for records imported via `lib/sync`, including source badges, translated machine types, and generic activity/object rendering.

### Modified Capabilities
- None. This is a pure display-layer change; existing spec requirements around sync, data models, or API contracts do not change.

## Impact

- Affected UI: `packages/web/app/dashboard/exercise/*`, `packages/web/app/dashboard/sleep/*`, `packages/web/app/dashboard/weight/*`, `packages/web/app/dashboard/timeline/page.tsx`, `packages/web/app/dashboard/page.tsx`.
- Affected i18n: `packages/web/messages/en.json`, `packages/web/messages/zh.json`.
- New component: `packages/web/app/components/SourceBadge.tsx`.
- No backend or API impact.
