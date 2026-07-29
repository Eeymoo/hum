## ADDED Requirements

### Requirement: Synced exercise types are translated in the UI
The dashboard SHALL display human-readable names for synced exercise types imported from Xiaomi (`steps`, `heart_rate`, `calories`, `spo2`, `valid_stand`, `intensity`, `stress`) in both English and Chinese.

#### Scenario: English locale
- **WHEN** the user views the exercise list or detail page in English
- **THEN** a synced record of type `steps` is shown as `Steps`, `heart_rate` as `Heart Rate`, `calories` as `Calories`, `spo2` as `SpO2`, `valid_stand` as `Stand`, `intensity` as `Intensity`, and `stress` as `Stress`

#### Scenario: Chinese locale
- **WHEN** the user views the exercise list or detail page in Chinese
- **THEN** a synced record of type `steps` is shown as `步数`, `heart_rate` as `心率`, `calories` as `卡路里`, `spo2` as `血氧`, `valid_stand` as `站立`, `intensity` as `中高强度`, and `stress` as `压力`

### Requirement: Sync source is visible on dashboard records
The dashboard SHALL render a source badge on any record that has a non-null `sourceId`, including list views, detail views, and the timeline.

#### Scenario: Synced exercise record
- **WHEN** a synced exercise record appears in the exercise list
- **THEN** a badge is visible next to the record indicating the source (e.g. `小米` / `Mi`)

#### Scenario: Manual exercise record
- **WHEN** a manually entered exercise record appears in the exercise list
- **THEN** no source badge is shown

#### Scenario: Synced sleep and weight records
- **WHEN** synced sleep or weight records appear in their respective lists or detail pages
- **THEN** a source badge is visible next to each record

### Requirement: Synced exercise activities render correctly
The exercise detail page SHALL render synced activity payloads whether they are an array of `{name: string}` objects or a plain object of key-value metrics.

#### Scenario: Manual activity array
- **WHEN** a manual exercise record with `activities: [{name: "Jogging"}]` is opened
- **THEN** the page shows a tag for each activity name and any additional fields

#### Scenario: Synced steps object
- **WHEN** a synced `steps` record with `activities: {steps: 8245, distance: 5.2, goal: 8000}` is opened
- **THEN** the page shows a readable grid with `steps: 8245`, `distance: 5.2`, and `goal: 8000`

#### Scenario: Synced heart rate object
- **WHEN** a synced `heart_rate` record with `activities: {avg: 72, max: 90, min: 55, resting: 62}` is opened
- **THEN** the page shows a readable grid with `avg: 72`, `max: 90`, `min: 55`, and `resting: 62`

### Requirement: Daily summary records are labeled honestly
The exercise dashboard SHALL label records with `duration: 0` from synced sources as daily summaries rather than workout sessions.

#### Scenario: Steps record in list
- **WHEN** a synced `steps` record with `duration: 0` is listed
- **THEN** the list does not display `0 min` and instead shows a daily summary label (e.g. `Daily Summary` / `每日汇总`)

### Requirement: Phase 2 — Exercise stats split by record category
The exercise stats view SHALL present two separate sections: one summarizing human-logged workout sessions and one summarizing synced daily health metrics, each with their own totals and averages.

#### Scenario: Mixed exercise records
- **WHEN** the exercise stats page loads and the user has both manual workouts and synced daily metrics
- **THEN** the page shows distinct sections for "Workouts" and "Daily Health Metrics" without mixing their totals
