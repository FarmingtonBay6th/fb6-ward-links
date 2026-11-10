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
