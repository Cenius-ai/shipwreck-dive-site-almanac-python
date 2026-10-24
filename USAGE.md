# Using the almanac

Four screens, one dataset. Everything below works offline, in a plain browser, with the static
server running (`sh serve.sh`).

## 1. Catalog - `/`

Six wreck cards, each showing region, wreck year, max depth and the certification the site asks
for. The header above them names the tide reference day that every slack window on the site is
computed from. Click or keyboard-activate a card to open its wreck page.

States you may hit: skeleton cards while `data.json` loads, an empty-state panel if the file
publishes no sites, and an error panel with **Retry** if the file is missing or malformed.

## 2. Wreck page - `/wreck.html?id=thistlegorm`

- **Identity line** - vessel type, build year and length beside the wreck name.
- **Facts** - wreck year, max depth, required certification and position.
- **Depth profile** - a proportional bar from the surface to the seabed with markers for the
  shallowest point, the deck and the seabed, plus the numbers in metres underneath.
- **Sinking history** - the cause, the date and a short narrative account.
- **Slack water table** - one row for the site's own published window (anchor time, offset,
  start-end, length), then reference rows for the other three anchor times so you can check the
  arithmetic by hand. Midnight crossovers print as `23:40 - 00:25 (next day)`. A site with
  missing or invalid slack fields shows `No slack window published` instead of a blank cell.
- **Next** - the briefing, the log, or back to the catalog.

An unknown or missing `?id=` renders the shared error panel with a catalog link.

## 3. Dive briefing - `/briefing.html?id=thistlegorm`

Hazards, entry and exit, boat traffic, emergency plan, then the shared pre-dive checklist in
`order`. Tick rows as you brief them - the tick state is held for the visit and never reloads the
page. **Print this briefing** prints the hazards, emergency plan and checklist with the ticks
visible, and hides the site chrome, buttons and form controls.

## 4. Dive log - `/log.html`

Sign in first (you are sent to `/signin.html` and returned to the log afterwards).

- **Diver header** - name and certification from your session, with **Print this log** and a
  link back to the catalog.
- **Entry form** - site, date, max depth, bottom time, visibility, water temperature, buddy and
  notes. Site and date are required; depth must be 1-200 m, bottom time 1-300 min, visibility and
  temperature cannot be negative, and the date cannot be in the future. Errors appear under the
  field they belong to, the first bad field takes focus, and nothing is saved until the form is
  valid.
- **Saved entries** - newest first, with **Edit** (updates the same row, keeping its id) and
  **Delete** (asks for confirmation first). The empty state distinguishes "no dives yet" from
  "no dives at this site".
- **Filter** - the per-site selector rewrites the URL (`/log.html?id=zenobia`) so the filtered
  view is deep-linkable; **All sites** clears it.
- **Persistence** - entries are written to `localStorage` under `sda.log.v1` and survive a
  reload. Corrupt or partial data opens the logbook empty instead of throwing.

You can reach the log from any wreck page with **Log this dive**, which preselects the site.

## 5. Sign out

The diver chip in the left-hand panel shows who is signed in and carries **Sign out**. Signing
out clears `sda.session.v1`; opening the log again returns you to the sign-in card.

## Keyboard and print

Everything is reachable with Tab in reading order: the skip link comes first, every card, field
and button takes a visible focus ring (`--ring`), and no control is hidden behind a hover. The
print stylesheet drops navigation, buttons and form controls, prints black on white, and keeps
the log's diver header and entry table, plus the briefing's checklist glyphs.
