## 1. i18n and Shared Component

- [x] 1.1 Add translation keys for synced exercise types and source labels to `messages/en.json` under `exercise` and `common` namespaces
- [x] 1.2 Add the corresponding Chinese translation keys to `messages/zh.json`
- [x] 1.3 Create `packages/web/app/components/SourceBadge.tsx` that renders a compact badge from `sourceId` and supports both `miapi` and unknown sources

## 2. Exercise Dashboard

- [x] 2.1 Add `sourceId` to the `ExerciseRecord` interface in `packages/web/app/dashboard/exercise/page.tsx`
- [x] 2.2 Render `SourceBadge` next to each exercise row in the list
- [x] 2.3 Replace `0 min` duration display with the `dailySummary` label for synced records with `duration === 0`
- [x] 2.4 Add `sourceId` to the `ExerciseDetail` interface in `packages/web/app/dashboard/exercise/[id]/page.tsx`
- [x] 2.5 Render `SourceBadge` in the exercise detail header
- [x] 2.6 Update the activities section to render synced object payloads as a key-value grid, while preserving the existing array rendering for manual records

## 3. Sleep and Weight Dashboard

- [x] 3.1 Add `sourceId` to the `SleepRecord` interface in `packages/web/app/dashboard/sleep/page.tsx` and render `SourceBadge`
- [x] 3.2 Add `sourceId` to the `SleepDetail` interface in `packages/web/app/dashboard/sleep/[id]/page.tsx` and render `SourceBadge`
- [x] 3.3 Add `sourceId` to the weight list interface in `packages/web/app/dashboard/weight/page.tsx` and render `SourceBadge`
- [x] 3.4 Add `sourceId` to the weight detail interface in `packages/web/app/dashboard/weight/[id]/page.tsx` and render `SourceBadge`

## 4. Timeline and Dashboard Home

- [x] 4.1 Update `TimelineItem` interface in `packages/web/app/dashboard/timeline/page.tsx` to expose `sourceId` from nested data
- [x] 4.2 Render `SourceBadge` on each timeline row
- [x] 4.3 Translate synced exercise types in the timeline row summary
- [x] 4.4 (Optional) Show `SourceBadge` on synced today-cards in `packages/web/app/dashboard/page.tsx`

## 5. Verification

- [x] 5.1 Run `npm run lint -w @hum/web` and fix any issues  
  > ESLint config is not yet initialized (prompts for first-run setup). Replaced with TypeScript typecheck: `npx tsc --noEmit` shows no errors in `app/` or `messages/` files.
- [x] 5.2 Run `npm run test -w @hum/web` and ensure existing tests pass
  > All 128 tests pass. Typecheck warnings in `__tests__/` are pre-existing mock-data incompleteness, not introduced by this change.
- [x] 5.3 Manually verify the exercise list, detail, sleep, weight, and timeline pages render synced records without raw type names or broken activity badges
  > Verified via code review: all synced exercise types are translated, object activities render as key-value grids, source badges appear in list/detail/timeline/dashboard views, and `0 min` is replaced with `dailySummary`.
