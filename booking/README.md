# Booking list for Infinite Jest

The booking page is `visit.html` (live at https://jasperengelhardt.com/visit.html).
The site is static, so bookings are kept in a private Google Sheet in Jasper's own
Google Drive. Nothing personal is stored in this repository.

## Turn it on (about five minutes, once)

1. Open https://sheets.new while signed in to your Google account. Name the sheet
   "Infinite Jest bookings".
2. In the sheet: **Extensions > Apps Script**. Delete what is there and paste all of
   `booking/Code.gs`. Click Save.
3. In the function menu at the top pick **setup** and click **Run**. Google asks for
   permission (sheet + send email as you). Allow it.
4. Click **Deploy > New deployment**. Type: **Web app**. Execute as: **Me**.
   Who has access: **Anyone**. Click Deploy and copy the Web app URL.
5. Paste that URL into `endpoint: ""` near the top of the script in `visit.html`.

Until step 5, the page runs in preview mode: it works, but saves nothing.

## Change dates and times

Edit `SCHEDULE` near the top of the script in `visit.html` (days, hours, closed
weekdays, people per window, Armory times, blocked windows), and the same `SCHEDULE`
in `Code.gs`. After editing Code.gs: **Deploy > Manage deployments > Edit > New version**.

## What runs by itself

- Each booking: a confirmation email to the guest (from your Google account) and a
  short notice to you with a link to the sheet.
- Every morning at 9 am New York time: a reminder to everyone booked for tomorrow,
  and today's list of visits to you.
- Armory times (4 hours before curtain until the show ends) stay bookable; the page
  and the emails tell guests Jasper is performing and links to the Armory.

## Terms page

`terms.html` is built from the guest-facing terms text:

```
python3 booking/make_terms.py path/to/terms.md
```

## Privacy

- The page only ever reads how many people booked each window, never names.
- Guests can cancel with the link in their confirmation email.
- `setup()` schedules `wipe()`, which deletes all bookings on Dec 23, 2026, as the Terms promise.
- Google stores the sheet in your Drive; nobody else can open it unless you share it.
