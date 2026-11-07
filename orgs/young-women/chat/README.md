# Young Women Chat (Bay 6 Hub)

Kid-safe, invite-only group chat for Farmington Bay 6th Ward Young Women. It replaces the YW GroupMe and lives inside the Bay 6 Hub look.

**Demo path (after merge):** `orgs/young-women/chat/`  
**Live URL (GitHub Pages, default branch only):** https://farmingtonbay6th.github.io/fb6-ward-links/orgs/young-women/chat/

## How It Works

Channels:

- **Main** — all Young Women
- **Gatherers** — Gatherers of Light
- **Messengers** — Messengers of Hope
- **Builders** — Builders of Faith
- **Leaders** — YW presidency and advisers only (fully hidden from youth)

Safety model (kids first):

1. **Invite-only** from the ward Young Women list (no public discovery, no open join links).
2. **Parent or guardian approval** before a youth can join.
3. **Youth opt-in** after parent approval.
4. **Two-deep adult presence** on every channel before youth can post.
5. **No youth-to-youth DMs**, no ads, no public search/discovery.
6. Every message has a **Report** button; YW presidency **moderators** can approve members, remove messages, mute or remove users, and review reports.

The UI is mobile-first and uses the Hub colors (navy / gold / warm paper). Headings, labels, and buttons use Title Case.

## Demo Mode

`config.js` ships with `mode: "demo"`. In Demo Mode the app:

- Shows a clear **Demo Mode** banner
- Stores all data in `localStorage` (key from `demoStorageKey`)
- Needs **no backend**
- Lets you switch **Demo Persona** (youth, parent, adviser, moderator) to walk the join and moderation flows
- **Notification Settings** (bell in the header): per-channel toggles, alert level, quiet hours, delivery choices, parent **Notify Me Too**, plus a **Try Demo Alert** banner/badge simulation
- **Photos** in the composer (choose/take). EXIF/location stripped by canvas re-encode. 5 MB cap. Moderators see **All Photos** and can Remove. Photos are reportable like any message
- **Sign-Ups** tab: per-class Door Greeting and Lessons. This Week is shown first. Girls claim future open spots in their own class and can release their own claims. Presidency and class advisers assign people, dates, and capacity. Greeting months rotate only after a leader sets the starting month and class. Lesson dates are a separate list.

Reset Demo Data from **Moderator Tools** (as a presidency persona).

### Try It Locally

```bash
# from the repo root
python3 -m http.server 8765
# open http://127.0.0.1:8765/orgs/young-women/chat/
```

Or open `orgs/young-women/chat/index.html` from a static preview of this branch.

### Preview This Branch Before Merge

GitHub Pages serves only the default branch. To preview now:

- Use a local static server (above), or
- Open the files on this PR branch in the GitHub UI / Codespaces preview, or
- Use a temporary Pages-from-branch workflow only if the ward already allows it (do not change repo Pages settings for this PR).

## How To Go Live

1. Keep secrets **out of the repo**. Only public web config belongs in `config.js`.
2. Choose a backend and fill placeholders in `orgs/young-women/chat/config.js`:
   - **Firebase:** set `mode: "firebase"` and the `firebase` web config fields (`apiKey`, `authDomain`, `projectId`, …). Add Auth + Firestore (or RTDB) with rules that enforce invite-only membership, parent approval, youth opt-in, moderator roles, and two-deep checks **on the server**.
   - **Supabase:** set `mode: "supabase"` plus `url` and the **anon** key. Put service-role keys only in Edge Functions / server env. Mirror the same safety rules in RLS.
3. Wire the SDK loaders and replace the DEMO adapter in `chat.js` (`initData` / `persist` / live reads). Until SDKs are wired, the app stays in Demo Mode even if placeholders look filled.
4. Seed the ward invite list (youth + linked parents) and YW presidency moderator accounts.
5. Confirm `robots` stays `noindex, nofollow`, and that there is no public directory of members.
6. Merge this PR so GitHub Pages publishes `/orgs/young-women/chat/`.
7. Retire GroupMe only after presidency, parents, and youth have completed the join path.

### Go-Live Notifications Plan

1. Ship a small **PWA**: `manifest.webmanifest` + service worker scoped to `/orgs/young-women/chat/` (Add To Home Screen on iPhone / Android).
2. Use **Web Push** (VAPID keys stored only in server env — never in this repo) so phones get “New Message In Gatherers” style alerts.
3. Respect Notification Settings: channel follows, alert level (All / Leaders Only / Daily Summary / Off), Quiet Hours (default 9:00 PM–7:00 AM), and parent **Notify Me Too**.
4. **Fallbacks:** Twilio (or ward SMS relay) for Text Message Backup; transactional email for Email Backup when push is denied or unavailable.
5. Photos: store encrypted/object-store blobs server-side (not data URLs). Keep client EXIF strip. Moderators keep the All Photos view + Remove.
6. Sign-Ups and the Leaders channel need the same invite-only auth rules as chat (Leaders never listed for youth). Do not call Sign-Ups live until the checks below have been run against a real backend.

## How The Presidency Moderates

Sign in as a **Moderator** (YW presidency). In Demo Mode, pick Traci, Mignon, Lori, or McCall from **Demo Persona**.

- **Chat** — read channels; **Remove Message** on any post; use **Report** like anyone else.
- **Members** — **Approve Member**, **Mute**, **Unmute**, **Remove User**.
- **How To Join** — **Send Invite** from the ward list; parents approve; youth opt in.
- **Moderator Tools** — open **Reports** (Resolve / Dismiss / Remove Message), **Pending Members**, and **Two-Deep Presence** toggles for the current channel.

Recommended practice:

- Keep at least two adults marked present on each active channel.
- Review reports the same day when possible.
- Prefer mute for short issues; remove for ongoing harm; always involve parents for serious concerns.
- Never enable youth-to-youth DMs or public invite links.

## Sign-Ups

Open **Sign-Ups** in the chat (or `#signups`). It is part of the Young Women chat, not a public roster on the ward page.

- **Door Greeting** uses a three-month rotation. Each class greets every third month. The presidency chooses the starting month, the starting class, and the class order. Until that is saved, no greeting class is guessed and no greeting dates are created.
- **Lessons** use their own dates. A Sunday can have a lesson without a greeting, or a greeting without a lesson.
- Young women **Sign Up** for a future open spot in their own class and **Release** their own claim. They cannot take another class’s spots, past dates, or a full date.
- Presidency can assign any class. An adviser can assign only her class. Parents can see a daughter’s class list of names already on the schedule, and cannot claim or assign.
- Leaders can add dates, change capacity (1–12), cancel a date, and add another assignment type (per class, or on the greeting rotation).
- Nothing on this tab sends a message, a notification, or a text.

### Paper Sheet Review

The photographed handwritten sheet is a **review queue**, not live data. Handwritten rows stay under **Paper Sheet Review** with the status **Not Applied**.

Exact class-list matches (for example Brooke, Kate, Brinley R., Brynnlee B.) are shown as suggestions only. **Brooklin** does not match one stored spelling; Brooklyn M. and Brooklyn R. are both possible, so that name stays unresolved. The sheet’s class is not verified, even though the exact matches sit in Gatherers of Light. A leader chooses the class and each person, then uses **Apply Confirmed Rows Only**. Unconfirmed names are not written onto spots. The review does nothing until sign-ups are connected.

### Storage And Migration

Sign-ups are **not connected** yet. The tab does not save on the phone. Chat messages still use Demo Mode `localStorage`. That record is not the sign-up list.

The Hub's only live write backend is Google Apps Script plus a private Google Sheet (the announcement intake already deployed from the ward Google account). Firebase and Supabase in `config.js` are still `YOUR_` placeholders. There is no Supabase or Firebase project in this repo. The Supabase connector was not connected in this session, so it was not used to create a project.

| Item | State |
|---|---|
| Chosen backend | New private Apps Script web app, same pattern as the announcement intake. Not a separate site. |
| Code | `apps-script/Code.js`, `Signups.js`, `SignupApi.js`, `appsscript.json`. |
| Sheet | Created by `setupYwSignups` in the owner's Drive. Must not be published to the web. |
| Auth | Google ID token checked by the script, then the private ward list. The chat persona menu cannot grant access. |
| Atomic claims | `LockService` around read/modify/write, plus slot version. |
| Production sheet | Not created. This agent cannot sign in to the ward Google account. |
| SQL file | `migrations/001_yw_signups.sql` is **NOT APPLIED** and is not the deployment path. |
| `signups.scriptUrl` | Set to the deployed `/exec` URL. Spreadsheet id is not in the repo. |

Rules tests (`signups.test.js`) exercise the shared rules with no network. Handler tests (`signup-api.test.js`) exercise the script's request function with a fake token check and an in-memory sheet. Neither is a live Google test.

The existing announcement web app was probed with a honeypot that writes no row. Its redirect response is JSON and allows browser reads. That is why sign-ups can stay inside the Hub page. The new sign-up script has not been deployed, so that probe is not a sign-up test.

### Deploy From The Ward Google Account

The Mac has git only. Use the browser, signed in as the account that already owns the announcement script. Do not paste cookies or tokens into the repo.

1. Open [script.google.com](https://script.google.com) → New project → name it `Bay 6 YW Sign-Ups`.
2. Add four files and paste: `Code.js`, `Signups.js`, `SignupApi.js`, and `appsscript.json` from `orgs/young-women/chat/apps-script/`.
3. Select `setupYwSignups` → Run → allow Sheets access. Leave the new spreadsheet private. Do not use Publish to the web.
4. Open the script's Project Settings → Google Cloud Platform project. In that Cloud project, APIs & Services → Credentials → Create OAuth client ID → Web application. Authorized JavaScript origins: `https://farmingtonbay6th.github.io`. No client secret belongs in this repo.
5. Apps Script → Project Settings → Script properties → `GOOGLE_CLIENT_ID` = that client id.
6. Deploy → New deployment → Web app → Execute as Me → Who has access: Anyone → Deploy. Copy the `/exec` URL.
7. The `/exec` URL and public client id are now in `config.js`. The sheet id is not.

The Sign-Ups tab asks for Google sign-in. Consent is External/Testing, so only listed test users can sign in. After it, the deploying Google account is the only moderator (`Ward Leader`). Add each person by the Google account they will use. Do not import the handwritten sheet. The paper review stays **Not Applied** until a signed-in leader confirms the class and each name. GitHub Pages updates only from `main`, so the config change is not live until that commit is merged.

Run the checks locally:

```bash
node --check orgs/young-women/chat/signups.js
node --check orgs/young-women/chat/signup-api.js
node --check orgs/young-women/chat/chat.js
node --test orgs/young-women/chat/signups.test.js
node --test orgs/young-women/chat/signup-api.test.js
```

## Files

| File | Purpose |
|---|---|
| `index.html` | Mobile-first chat UI |
| `config.js` | Mode + Firebase/Supabase placeholders (no secrets) |
| `demo-data.js` | Demo seed users, messages, reports |
| `chat.js` | Client app + Demo localStorage backend |
| `signups.js` | Sign-up rules, rotation, review queue, and screen markup |
| `signup-api.js` | Request checks: token, ward list, claims |
| `signup-client.js` | Browser caller. No sign-up localStorage |
| `signup-api.test.js` | Handler tests with a fake token and an in-memory sheet. Not live Google |
| `signups.test.js` | Rules tests. Not live Google |
| `apps-script/` | Paste-ready private web app |
| `migrations/001_yw_signups.sql` | Unused SQL sketch. **Not applied.** |
| `README.md` | This document |

## Hub Link

The Young Women org page includes one card linking here. No other Hub pages, styles, or links were changed for this MVP.

## Later Ideas (Not Built Yet)

- **Feeding Missionaries sign-ups** — Traci floated this; park it until she asks to build it (could sit beside Door Greeters / Lessons on Sign-Ups).
