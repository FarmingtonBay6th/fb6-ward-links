# Relief Society page (DRAFT preview)

URL: https://farmingtonbay6th.github.io/fb6-ward-links/relief-society/
Not linked from the Farmington Bay 6th Ward Links main page, and marked `noindex`. **All content is EXAMPLE / PLACEHOLDER.**

## Two sides
- **Editor side (Presidency):** a Google Form, *Post to Relief Society*, is the main way to post.
  Questions: What kind? (Event / Announcement / Sign-Up / Lesson / Newsletter), Title, Date, Start time,
  End time, Place, Details, Link, Show until. Answers land in the Google Sheet
  **DRAFT – FB6 Relief Society Page Content** (`1siL1YsbL3OdHdkwPgmLH8ELQ7thBfWSw-7LxrrAs-Sg`).
  One comfortable editor can fix or hide items in the sheet (`Hide? (Yes)` column).
- **Reader side (every sister):** this page. Big text, a Bigger-text button, This Week at the top,
  Add-to-calendar on every event, one-tap Text/Call the Presidency, I need help / I can help buttons,
  sign-ups, lesson read-ahead, newsletter + archive, home-screen steps.

## Sheet tabs
| Tab | Who touches it | What |
|---|---|---|
| START HERE | everyone | 3 plain steps |
| Form Responses 1 | editor (fix / hide) | created by `form-setup.gs` |
| Posts | editor (optional) | type posts directly; same columns as the form |
| Contacts | Adam, once | Presidency names + cell numbers (only with each sister's OK) |
| Help Links | Adam, once | links for I need help / I can help forms |
| Page Feed (don't edit) | nobody | formula that merges Posts + Form Responses 1; the page reads this |

Columns (Posts, Form Responses 1, Page Feed): A Posted/Timestamp, B What kind?, C Title, D Date,
E Start, F End, G Place, H Details, I Link, J Show until, K Hide? (Yes). Read by **position**.
Rows starting with 👉 are helper rows and are skipped.

Auto-expire: events and lessons hide after their date; anything with *Show until* hides after it;
announcements/sign-ups with only a Date hide after that date; newsletters stay as an archive.
Posts from the form in the last 7 days get a "New" tag.

## One-time setup (Adam)
1. **Create the form:** in the sheet, Extensions > Apps Script, paste `form-setup.gs`, Run
   `createPostToReliefSocietyForm`, allow access. The form link lands in START HERE row 27.
   (No Forms connector was available, so this couldn't be done automatically.)
2. **Publish the sheet:** File > Share > Publish to web > *Entire document* > *Comma-separated values (.csv)* > Publish.
   Copy the link and paste it into `SHEET_PUBLISHED_URL` in `index.html` (or send it to Grok Bot).
   Publishing makes the sheet's values readable by anyone with the link; that's what the page needs.
   It doesn't give anyone edit access.
3. Make the "I need help" / "I can help" Google Forms (answers go only to the Presidency) and paste their
   links in Help Links.

Until step 2, the page shows `data.json` (examples). After it, the page reads the sheet; if the sheet
can't be reached it shows the last copy saved on that phone, then `data.json`.

## Newsletter (DRAFT)
- **Readers:** a big dark-blue/yellow-edged **Read This Month’s Newsletter** button at the top of the Newsletter
  section. It opens `newsletterUrl` (data.json) if set, otherwise the newest row with What kind? = **Newsletter**
  (Posts / Form Responses 1). Example data: `"newsletterUrl": "PLACEHOLDER"`, so the button shows *EXAMPLE: link coming*.
- **Presidency:** a "For the Presidency" box with a big green **Upload Newsletter** link. Its URL is
  `UPLOAD_FORM_URL` in `index.html` (now `PLACEHOLDER`). Text shown above it (also used as the form description):

  > 1. Tap ‘Add file’.  2. Pick your newsletter.  3. Tap ‘Submit’.
  > A PDF works best. Word (.doc, .docx), Google Docs, and pictures (.jpg, .png) also work.
  > Google may ask you to sign in with your Google account first. That’s normal.
  > Can’t upload? Just email it to [Newsletter helper] and she’ll post it.   *(placeholder name)*

**Apps Script can’t make file-upload questions** (FormApp has no file-upload creator). So:
1. In Apps Script, Run `createUploadNewsletterForm` (from `form-setup.gs`). Links land in START HERE rows 29–30.
2. Open the edit link. Click **(+) Add question**.
3. Click the type menu (“Multiple choice”) → **File upload** → **Continue**.
4. Title “Your newsletter”; turn on **Allow only specific file types** → check **Document, PDF, Image**;
   **Maximum number of files: 1**; **Maximum file size: 10 MB**; turn on **Required**.
5. Done (it saves itself). Uploads save to the form’s Drive folder *Upload Newsletter (File responses)*.
   Paste the form’s link into `UPLOAD_FORM_URL` in `index.html`. Don’t share the folder.
After an upload, post the file’s link as a Newsletter row (or put it in `newsletterUrl`) so the Read button opens it.
Uploaders must sign in to Google (Google’s rule for file uploads).

## Going live later (not done)
Remove the DRAFT bar, `noindex`, and EXAMPLE rows; then add a Relief Society button to the main page,
e.g. after the "Submit an Announcement" card in `../index.html`:

```html
<a class="card" href="relief-society/" rel="noopener">
  <span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z"/></svg></span>
  <span class="tx"><b>Relief Society</b><small>This week, events, sign-ups, lessons, and the newsletter. Text the Presidency in one tap.</small><i class="v">“Charity never faileth” <span>1 Corinthians 13:8</span></i></span><span class="go" aria-hidden="true">›</span>
</a>
```
and bump `CACHE` in `../sw.js`.

Files: `index.html` (whole page), `data.json` (fallback), `sw.js` (offline copy of this page only; cache `fb6-rs-v2`),
`manifest.webmanifest` + `icons/` (home-screen icon, label "Relief Society"), `form-setup.gs`.
