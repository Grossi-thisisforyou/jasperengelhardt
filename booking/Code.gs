/**
 * Infinite Jest booking list. Runs as a Google Apps Script web app,
 * bound to a private Google Sheet in Jasper's own Drive.
 * Setup steps: booking/README.md. Keep SCHEDULE in step with SCHEDULE in visit.html.
 */
const SCHEDULE = {
  firstDay: "2026-12-09", lastDay: "2026-12-22",
  closedWeekdays: [6],                 // Saturdays off
  hours: { open: "12:00", close: "22:00" },
  special: {},                         // e.g. "2026-12-09": { open: "14:00", close: "22:00" }
  slotMinutes: 5,
  perSlot: 6,                          // people arriving per window
  maxGroup: 4,
  // Jasper performs at the Armory: from 4 h before curtain until the show ends.
  armory: { first: "2026-12-08", last: "2026-12-20", curtain: { 0: "15:00", 2: "19:00", 3: "19:00", 4: "19:00", 5: "19:00", 6: "19:00" }, before: 4, length: 4 },
  blocked: []                          // { date, from, to } windows with no visits
};
const PLACE = "The New School, 72 Fifth Avenue, New York, NY 10011, Room 401, 4th floor";
const NOTIFY_ME = true;                // email Jasper on each booking
const DAILY_LIST = true;               // email Jasper each morning with the day's list
const DELETE_ON = "2026-12-23";        // every booking is wiped on this day (matches the Terms)
const HEAD = ["booked_at", "slot", "name", "email", "word", "accounts", "research", "photo", "video", "status", "id", "guests", "new_school", "access_and_notes", "reminded"];

function sheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName("Bookings");
  if (!sh) { sh = ss.insertSheet("Bookings"); sh.getRange("B:F").setNumberFormat("@"); sh.appendRow(HEAD); sh.setFrozenRows(1); }
  return sh;
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function pad_(n) { return ("0" + n).slice(-2); }
function toMin_(t) { const p = t.split(":").map(Number); return p[0] * 60 + p[1]; }
function hm_(m) { return pad_(Math.floor(m / 60)) + ":" + pad_(m % 60); }
function validSlots_() {
  const set = {}, S = SCHEDULE, step = S.slotMinutes;
  for (let d = new Date(S.firstDay + "T12:00:00Z"); d <= new Date(S.lastDay + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
    if (S.closedWeekdays.indexOf(d.getUTCDay()) >= 0) continue;
    const date = d.toISOString().slice(0, 10), h = Object.assign({}, S.hours, S.special[date] || {});
    for (let m = toMin_(h.open); m + step <= toMin_(h.close); m += step) {
      if (S.blocked.some(b => b.date === date && m < toMin_(b.to) && m + step > toMin_(b.from))) continue;
      set[date + "T" + hm_(m)] = true;
    }
  }
  return set;
}
function away_(slot) {
  const a = SCHEDULE.armory, date = slot.slice(0, 10), wd = new Date(date + "T12:00:00Z").getUTCDay();
  if (date < a.first || date > a.last || !a.curtain[wd]) return false;
  const c = toMin_(a.curtain[wd]), m = toMin_(slot.slice(11));
  return m < c + a.length * 60 && m + SCHEDULE.slotMinutes > c - a.before * 60;
}
function meet_(slot) {
  return away_(slot)
    ? "Jasper is performing at the Park Avenue Armory at this time, so he will not be in the room. Check in at the front desk and you will be shown up. The installation will be waiting for you."
    : "Check in at the front desk. Jasper will meet you in the lobby.";
}
function rows_() {
  const v = sheet_().getDataRange().getValues(); v.shift();
  return v.filter(r => r[9] !== "cancelled");
}
function taken_() {
  const t = {};
  rows_().forEach(r => { t[r[1]] = (t[r[1]] || 0) + (Number(r[11]) || 1); });
  return t;
}
function nice_(slot) {
  const d = new Date(slot + ":00-05:00");
  return Utilities.formatDate(d, "America/New_York", "EEEE, MMMM d 'at' h:mm a");
}

/** GET ?action=slots returns only counts per window, never names. GET ?action=cancel&id=... cancels. */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === "cancel" && p.id && p.sure !== "1") {   // ask first, so link scanners in inboxes cannot cancel
    const url = ScriptApp.getService().getUrl() + "?action=cancel&sure=1&id=" + encodeURIComponent(p.id);
    return HtmlService.createHtmlOutput("<div style='font:18px/1.5 sans-serif;max-width:32em;margin:15vh auto;padding:0 16px'><h1 style='font-weight:400'>Cancel your visit?</h1><p><a href='" + url + "' target='_top' style='display:inline-block;background:#0c0c0c;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none'>Yes, cancel my visit</a></p><p>Changed your mind? Just close this page.</p></div>").setTitle("Infinite Jest");
  }
  if (p.action === "cancel" && p.id) {
    const sh = sheet_(), v = sh.getDataRange().getValues();
    for (let i = 1; i < v.length; i++) if (v[i][10] === p.id) {
      sh.getRange(i + 1, 10).setValue("cancelled");
      return HtmlService.createHtmlOutput("<div style='font:18px/1.5 sans-serif;max-width:32em;margin:15vh auto;padding:0 16px'><h1 style='font-weight:400'>Your visit is cancelled.</h1><p>Thank you for letting us know. You are welcome to book another time at <a href='https://jasperengelhardt.com/visit.html'>jasperengelhardt.com/visit.html</a>.</p></div>").setTitle("Infinite Jest");
    }
    return HtmlService.createHtmlOutput("<p style='font:18px sans-serif;margin:15vh auto;max-width:32em'>We could not find that booking. It may already be cancelled.</p>");
  }
  return json_({ ok: true, taken: taken_() });
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, message: "Something went wrong. Please try again." }); }
  if (d.website) return json_({ ok: true });                       // spam trap
  const clean = (s, n) => String(s || "").replace(/[\r\n\t]/g, " ").trim().slice(0, n).replace(/^[=+\-@]/, "'$&");
  const name = clean(d.name, 80), email = clean(d.email, 120), word = clean(d.word, 30), accounts = clean(d.accounts, 200), note = clean(d.note, 500);
  const guests = Math.max(1, Math.min(SCHEDULE.maxGroup, parseInt(d.guests, 10) || 1));
  const ns = d.newschool === "yes" ? "yes" : d.newschool === "no" ? "no" : "";
  if (!validSlots_()[d.slot]) return json_({ ok: false, message: "That time is not available. Please pick another." });
  if (new Date(d.slot + ":00-05:00") < new Date()) return json_({ ok: false, message: "That time has passed. Please pick another." });
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !word || /\s/.test(word) || !ns) return json_({ ok: false, message: "Please check your name, email, word and the New School question." });
  if (!d.terms) return json_({ ok: false, message: "Please tick that you have read the Terms of Participation." });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const rows = rows_(), taken = taken_();
    if ((taken[d.slot] || 0) + guests > SCHEDULE.perSlot) return json_({ ok: false, message: "That time just filled up. Please pick another.", taken: taken });
    if (rows.some(r => String(r[4]).toLowerCase() === word.toLowerCase() && String(r[3]).toLowerCase() !== email.toLowerCase()))
      return json_({ ok: false, message: "Someone already chose that word. Please pick a different one." });
    const id = Utilities.getUuid();
    sheet_().appendRow([new Date(), d.slot, name, email, word, accounts, !!d.research, !!d.photo, !!d.video, "booked", id, guests, ns, note, ""]);

    const cancel = ScriptApp.getService().getUrl() + "?action=cancel&id=" + id;
    const when = nice_(d.slot);
    MailApp.sendEmail({
      to: email,
      name: "Infinite Jest",
      subject: "Your visit to Infinite Jest, " + when,
      body: "Hi " + name + ",\n\nYou are booked for Infinite Jest.\n\n" + when + "\n" + PLACE +
        (guests > 1 ? "\n" + guests + " people" : "") + "\n\n" + meet_(d.slot) +
        "\n\nYour word is: " + word + "\nSay it when you walk in. Stay as long as you like.\n\n" +
        "You chose: research " + (d.research ? "yes" : "no") + ", photo " + (d.photo ? "yes" : "no") + ", video " + (d.video ? "yes" : "no") +
        ". To change your mind, just reply to this email.\n\nCan't make it? Cancel here: " + cancel +
        "\n\nTerms of Participation: https://jasperengelhardt.com/terms.html" +
        "\nYour details are seen only by Jasper and are deleted on Dec 23.\n\nSee you soon,\nJasper"
    });
    if (NOTIFY_ME) MailApp.sendEmail(Session.getEffectiveUser().getEmail(), "New booking: " + when,
      name + " booked " + when + (guests > 1 ? " for " + guests + " people" : "") + ". New School: " + ns + "." +
      (away_(d.slot) ? " (Armory time, you are away.)" : "") + (note ? "\nAccess / notes: " + note : "") + "\n\nAll bookings: " + SpreadsheetApp.getActive().getUrl());
    return json_({ ok: true });
  } finally { lock.releaseLock(); }
}

/** Run once from the editor: creates the sheet, the reminders, the daily list and the wipe. */
function setup() {
  sheet_();
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("morning").timeBased().everyDays(1).atHour(9).inTimezone("America/New_York").create();
  ScriptApp.newTrigger("wipe").timeBased().at(new Date(DELETE_ON + "T09:00:00-05:00")).create();
}

/** Every morning: reminders for tomorrow's guests, and today's list for Jasper. */
function morning() {
  const tz = "America/New_York", now = new Date();
  const today = Utilities.formatDate(now, tz, "yyyy-MM-dd");
  const tomorrow = Utilities.formatDate(new Date(now.getTime() + 864e5), tz, "yyyy-MM-dd");
  const sh = sheet_(), v = sh.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < v.length; i++) {
    const r = v[i]; if (r[9] === "cancelled") continue;
    const slot = String(r[1]);
    if (slot.slice(0, 10) === tomorrow && !r[14]) {
      MailApp.sendEmail({ to: r[3], name: "Infinite Jest", subject: "Tomorrow: your visit to Infinite Jest",
        body: "Hi " + r[2] + ",\n\nA little reminder: you are booked for Infinite Jest tomorrow.\n\n" + nice_(slot) + "\n" + PLACE +
          "\n\n" + meet_(slot) + "\n\nYour word is: " + r[4] + "\n\nCan't make it? Cancel here: " + ScriptApp.getService().getUrl() + "?action=cancel&id=" + r[10] +
          "\n\nSee you tomorrow,\nJasper" });
      sh.getRange(i + 1, 15).setValue(new Date());
    }
    if (slot.slice(0, 10) === today) list.push(r);
  }
  if (DAILY_LIST && list.length) {
    list.sort((a, b) => String(a[1]) < String(b[1]) ? -1 : 1);
    const lines = list.map(r => String(r[1]).slice(11) + "  " + r[2] + (Number(r[11]) > 1 ? " +" + (Number(r[11]) - 1) : "") +
      "  New School: " + r[12] + (away_(String(r[1])) ? "  (Armory time)" : "") + (r[13] ? "\n        " + r[13] : ""));
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), "Today's visits: " + list.length + " bookings", lines.join("\n") + "\n\n" + SpreadsheetApp.getActive().getUrl());
  }
}

/** Deletes every booking. Runs by itself on DELETE_ON. */
function wipe() {
  const sh = sheet_();
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
}
