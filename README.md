# Bay 6 Hub · Farmington Bay 6th Ward

Private ward link hub (GitHub Pages). This is not an official website of The Church of Jesus Christ of Latter-day Saints.

## Young Women Chat

Kid-safe chat that replaces the YW GroupMe. Channels: **Main**, **Gatherers**, **Messengers**, and **Builders**.

- **Path:** [`orgs/young-women/chat/`](orgs/young-women/chat/)
- **After merge (Pages):** https://farmingtonbay6th.github.io/fb6-ward-links/orgs/young-women/chat/
- **Demo Mode:** ships with local mock data (`localStorage`); no backend required. Look for the Demo Mode banner.
- **Sign-Ups:** Door Greeting and Lessons inside the chat, stored by the private Google script. The public class list does not grant access. See the chat README.
- **Safety:** invite-only ward list → parent/guardian approval → youth opt-in → two-deep adult presence; report on every message; YW presidency moderators; no ads, no public discovery, no youth-to-youth DMs.

Full setup, go-live (Firebase / Supabase placeholders), and presidency moderation steps: [`orgs/young-women/chat/README.md`](orgs/young-women/chat/README.md).

## Young Men Activity Calendar

The Young Men page reads [`data/ym-activities.json`](data/ym-activities.json). It lists upcoming activities from today forward, grouped by week, with an All / Deacons / Teachers / Priests filter. Combined nights are stored once. The same file is part of the Young Men unread-dot hash, and `tools/build_calendar.py` copies upcoming rows onto the Bay 6 Calendar (Young Men) so This Week stays in step.

Mutual with no time is Wednesday at 7:00 PM. A home is stored as “Member Home (details from leaders)”. Do not add youth names, the Coordinators column, phone numbers, or street addresses.

To refresh from the leaders' sheet (tab **YM Activities Calendar 2026**):

1. Export that tab as CSV or text.
2. Run `python3 tools/ym_activities.py path/to/export.txt`
3. Read the printed corrections. Priests dates stay on the day written in their column. A Teachers date typed 2026 beside the same month and day in 2027 is corrected to 2027.
4. Commit `data/ym-activities.json` and `orgs/young-men/activities.ics`.

Hand edits: change the JSON, then run `python3 tools/ym_activities.py --ics` so the downloadable calendar matches. The next Church calendar sync keeps the sheet events because `build_calendar.py` merges this file.

## Upcoming Events

Flyers on [Upcoming Events](events/) come from two places:

- Hardcoded cards in [`events/events.json`](events/events.json), rendered into `events/index.html` and the matching organization pages by `python3 tools/build_events.py`.
- Approved items in [`data/approved-announcements.json`](data/approved-announcements.json), which the events page loads in the browser.

An event's last day is its `endDate` when that field is a `YYYY-MM-DD` date, otherwise its `date`. For a hardcoded card, the last day is the calendar date of `end` in America/Denver. The event stays through that day and is deleted starting the next calendar day. Organization pages that repeat the card lose it too. Images and PDFs under `events/flyers/` are deleted once no HTML or JSON file still names them.

The same rule applies to the class and quorum activity lists in `data/yw-classes.json`, `data/ym-quorums.json`, and `data/primary-classes.json`. Those pages already hide past rows in the browser; deleting the row is what lets the flyer file leave the repo. Calendars, This Sunday, and Young Women chat are left alone.

`python3 tools/prune_events.py` does the deletion. It writes nothing when every event is still current, so a daily run does not create an empty commit. `--today YYYY-MM-DD` checks a specific Denver date. `--dry-run` prints the list without writing.

GitHub Actions runs the script at 07:15 UTC (12:15 AM MST, 1:15 AM MDT), which is after midnight in America/Denver. The date comparison uses America/Denver even though the runner clock is UTC. The workflow needs permission to push, the same way the calendar sync does. If that permission is read-only, the push fails and the committed files stay as they were. The script itself is safe to run from any other scheduler that can commit.

The daily job edits the HTML in place. It does not rerun `build_events.py`. A hand-added activity inside an organization's `<!--EV-->` block stays until that card's own end date. Running `build_events.py` still replaces the whole block from `events/events.json`.
