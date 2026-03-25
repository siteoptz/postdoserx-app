# Weight progress bar chart widget — implementation spec

Instructions for implementing a user-facing weight tracking widget with goal, progress summary, and bar chart views (7 / 30 / 90 days).

---

## 1. Goals

- Let users **log weight** with a **date** (and optional time of day if useful).
- Let users set and edit a **target weight (goal)**.
- Show **progress** toward the goal (e.g. delta from start, delta from goal, or % of journey).
- Render a **bar chart** whose bars represent **weight per period** appropriate to the selected view (see section 3).
- All displayed values must come from **this user’s data** only (no cross-user data).

---

## 2. Data model

- **Weight entries:** `{ id, date (ISO date), weight (number, same unit everywhere, e.g. lb or kg), optional note }`
- **User settings:** `{ goalWeight, unit ('lb' | 'kg'), optional startWeight or “baseline date” for progress }`

Persist entries and settings wherever the app stores user data (e.g. API + DB keyed by `user_id`, per `POSTDOSERX_DASHBOARD_IMPLEMENTATION_PLAN.md`). Do not use fake demo series in production.

---

## 3. Timeframe behavior (7 / 30 / 90 days)

- **7-day view:** One bar per **calendar day** in the last 7 days (including today). If a day has no entry, show **no bar**, **zero-height bar**, or a clear **missing** state—document the choice; prefer **“no entry”** styling over inventing weight.
- **30-day view:** One bar per **day** for the last 30 days, OR aggregate to **weekly** bars if daily bars are too crowded—if aggregating, define it (e.g. **one bar per week = average weight that week**).
- **90-day view:** Prefer **weekly aggregates** (e.g. **one bar per week**, value = **average** of entries in that week) or **bi-weekly** if clearer; **daily** is acceptable if the chart handles density well—state the choice in code comments.

**X-axis:** Labels for the selected range (dates or week ranges).  
**Y-axis:** Weight in the user’s unit. Use sensible **min/max** padding (e.g. around min–max in range) so small changes are visible; include **goal** in the scale when relevant.

---

## 4. Weight goal and progress in the UI

### Goal input

- Numeric field + unit (or inherit global unit). Save on blur or explicit Save.

### Progress summary (non-chart)

Show at least:

- **Current weight** — latest entry overall (recommended), with the **range** applied only to the chart unless product specifies otherwise.
- **Goal weight**
- **Difference to goal** (e.g. “12 lb to goal”)
- Optional: **change over selected period** (e.g. “−3 lb in last 30 days” using first vs last entry in range—document the rule).

### Visual progress (optional)

- Horizontal **progress bar** from baseline to goal (requires baseline: first logged weight in period or user-defined starting weight).

---

## 5. Bar chart requirements

- Use a solid chart approach (Chart.js, Recharts, Victory, SVG, etc.) with **accessible** contrast and a **legend** if multiple series.
- **Goal line:** Horizontal reference at `goalWeight`.
- **Tooltips:** On hover — date (or week), weight (and entry count if aggregated).
- **Empty state:** “Log your weight to see this chart.” when there is no data in range.
- **Responsive:** Works on narrow widths; shorten or angle x-labels if needed.

---

## 6. Inputs / actions

- **Add weight:** Date picker (default today) + weight + submit.
- **Edit/delete entry** (preferred): Small list or table below the chart.
- **Range toggle:** **7d | 30d | 90d** — recomputes from stored entries only.

---

## 7. Validation

- Reject non-numeric weight; reject negative weight unless product allows.
- Policy on **future dates** — disallow or allow; document.
- **Multiple entries per day:** Supported; for **daily** bars use **last entry of day** or **average** — one rule, applied everywhere.

---

## 8. Acceptance criteria

- [ ] User can save goal and multiple weight entries.
- [ ] Chart switches between 7d, 30d, 90d (client-side recompute or refetch acceptable).
- [ ] Bars reflect only the authenticated user’s data.
- [ ] Goal appears as a horizontal line; summary shows current vs goal and optional period change.
- [ ] Empty and sparse data handled gracefully.

---

## 9. Optional enhancements

- Export CSV of entries.
- Moving average overlay on 30d/90d views.
- Milestone messaging when baseline and goal exist (e.g. “halfway to goal”).

---

## 10. API alignment (PostDoseRX)

If using the dashboard backend plan, wire to:

- `GET/POST /api/progress` for weight logs and summaries keyed by `user_id`.
- Store goal in `user_profiles.preferences` or a dedicated column/table as decided in implementation.

---

*Last updated: March 2026*
