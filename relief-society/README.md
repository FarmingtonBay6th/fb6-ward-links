# Relief Society page (DRAFT preview)

URL: https://farmingtonbay6th.github.io/fb6-ward-links/relief-society/
Not linked from the main page, and marked `noindex`. **All content is EXAMPLE / PLACEHOLDER.**

## Editing content
Everything shown comes from `data.json` in this folder:
- `newsletter`: Kelsey Kerr's monthly one-sheet (`url` = link to the PDF/Doc)
- `events`: `date` YYYY-MM-DD, `start`/`end` HH:MM (24h), `place`, `details`
- `lesson`: this Sunday's topic, teacher, read-ahead link
- `signups`: meal/service sign-up buttons
- `contacts`: Relief Society Presidency; `phone` digits only enables "Text"
- `posted` (YYYY-MM-DD): items posted within the last 7 days get a "New" tag

## Switching to a Google Sheet later (recommended)
So Kelsey can edit without touching code:
1. Make a Sheet with one tab and columns: `type,title,date,start,end,place,details,url,name,phone,posted`
   (`type` = newsletter | event | lesson | signup | contact; for lesson put topic in `title`, teacher in `name`;
   for contact put the calling in `title`).
2. File → Share → Publish to web → that tab → CSV. Copy the URL.
3. In `index.html` set `SHEET_CSV_URL` to that URL. The page then reads the CSV and
   converts rows into the same shape as `data.json` (see `fromRows()`); `data.json` is the fallback.
