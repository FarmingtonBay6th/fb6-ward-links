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
- **Sign-Ups** tab: Door Greeters and class Lessons for This Week plus the next ~8 Sundays

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
6. Sign-Ups and the Leaders channel need the same invite-only auth rules as chat (Leaders never listed for youth).

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

## Files

| File | Purpose |
|---|---|
| `index.html` | Mobile-first chat UI |
| `config.js` | Mode + Firebase/Supabase placeholders (no secrets) |
| `demo-data.js` | Demo seed users, messages, reports |
| `chat.js` | Client app + Demo localStorage backend |
| `README.md` | This document |

## Hub Link

The Young Women org page includes one card linking here. No other Hub pages, styles, or links were changed for this MVP.

## Later Ideas (Not Built Yet)

- **Feeding Missionaries sign-ups** — Traci floated this; park it until she asks to build it (could sit beside Door Greeters / Lessons on Sign-Ups).
