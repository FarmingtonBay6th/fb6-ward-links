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
