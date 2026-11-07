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

## Sister Missionary Lessons

**Path:** [`missionaries/lesson/`](missionaries/lesson/)

Members choose an open weekday evening and enter time, name, ward, and home address. That is the same set of fields as the stake calendar, “Farmington Bay Stake Member/Missionary Lessons.” Existing names and addresses are not copied onto the Hub.

The page is **not connected**. `missionaries/lesson/config.js` has an empty `scriptUrl`, so Save Draft On This Phone keeps the request in this browser only. It does not write the stake calendar, and it does not send a message. A draft is not a reserved evening.

The missing piece is a web app deployed by an editor of that existing Google Doc. Paste-ready script: [`tools/apps-script/MissionaryLessonIntake.gs`](tools/apps-script/MissionaryLessonIntake.gs). It must refuse a cell that already has a name, and its public response may contain only the date and open or taken. Do not point this form at the announcement intake or the Young Women sign-up script, and do not publish the calendar as a public sheet.
