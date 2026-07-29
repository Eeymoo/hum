## Context

The Xiaomi sync source (`lib/sync/sources/miapi.ts`) imports daily health metrics into three existing tables: `Exercise`, `Sleep`, and `Weight`. The same dashboard pages and API endpoints are used for both manual and synced records. The API already returns `sourceId` in payloads (via the serializer spreads in `lib/serializers.ts`), but the frontend does not consume it. The UI currently treats `Exercise` as a workout log, which is a semantic mismatch for imported daily summaries like `steps` or `heart_rate`.

This design keeps the scope minimal and safe: only translation catalogs, a small reusable component, and dashboard TypeScript interfaces change.

## Goals / Non-Goals

**Goals:**
- Display synced exercise types with human-readable, localized names.
- Render a source badge on every synced record (exercise, sleep, weight) in list, detail, and timeline views.
- Fix the exercise detail page to render both manual activity arrays and synced activity objects.
- Adjust exercise-list labels to reflect that some records are daily summaries rather than timed sessions.

**Non-Goals:**
- No changes to the Prisma schema or API endpoints.
- No changes to the sync engine or authentication flow.
- No changes to the soft-delete behavior of synced records.
- No Phase-2 stats split work (that remains a future change).

## Decisions

### Use a single reusable `SourceBadge` component
A new `app/components/SourceBadge.tsx` keeps the badge rendering consistent across all affected pages. The component accepts `sourceId: string | null` and returns `null` when absent, so callers can add it unconditionally.

Rationale: The same concept (this record came from a sync source) is used in five places. A small component avoids duplication and makes future source additions easy.

### Translate synced exercise types via the existing `exercise` namespace
Add the seven machine types (`steps`, `heart_rate`, `calories`, `spo2`, `valid_stand`, `intensity`, `stress`) plus `dailySummary` to both `messages/en.json` and `messages/zh.json`. The list and detail pages already call `t(exercise.type)`, so the keys plug in without code changes.

Rationale: This is the lowest-risk fix because it only adds translation keys. It keeps the `type` field untouched in the database, preserving the sync engine’s deduplication logic.

### Render synced activities generically as key-value pairs
The exercise detail page will detect whether `activities` is an array or an object. If it is an object, it will render a two-column grid of key-value pairs.

Rationale: Synced activity payloads vary by type (steps, heart rate, calories, etc.). A generic renderer covers all existing and future synced types without special-casing each one.

### Keep `duration: 0` records but hide the misleading "0 min" label
For the exercise list, when a synced record has `duration: 0`, the list will render a daily-summary label instead of `0 min`.

Rationale: `duration: 0` is the sync engine’s current way to mark daily aggregates. The existing data should remain unchanged; only the label changes.

### Use the `sourceId` prefix to determine the badge label
The `SourceBadge` component will map `sourceId` prefixes to readable labels: `miapi_*` → `小米` / `Mi`. If the prefix is unknown, it falls back to a generic `Synced` / `同步` label.

Rationale: The sync source already encodes its origin in `sourceId`. No extra API field is needed. The fallback handles future sources without code changes.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Future non-array activity payloads could break the generic renderer | The renderer uses `Object.entries` and `String()` coercion, so any object payload is displayed safely. |
| Unknown `sourceId` prefixes show generic labels | Fallback label plus a tooltip or title attribute can display the full `sourceId` for debugging. |
| Timeline row becomes too crowded with badges | Use a compact badge style (`px-2 py-0.5`, `text-xs`) and place it beside the type label. |
| Phase-1 label changes still mix daily metrics with workouts in stats | Accepted for Phase 1; Phase 2 will split the stats view. |

## Open Questions

- Should `SourceBadge` be i18n-aware via a translation key, or is hard-coded `小米` / `Mi` acceptable for now? (This proposal uses a translation key under `common` for cleanliness.)
- Should the timeline row show the source badge inline or on hover? (Inline, compact.)
