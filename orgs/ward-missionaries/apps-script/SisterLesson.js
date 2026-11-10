/* Sister lesson nights for the Bay 6 Hub.
   The Young Women sign-up keeps a private Google Sheet behind an Apps Script
   web app and tests the rules in Node. This follows that shape and leaves the
   Young Women script alone. One row per weeknight is enough: there is no
   sign-in and no class list. The public response is date, time, status, and
   the family's name on a reserved night. Phone numbers, addresses, and the
   source and docSync columns stay on the private sheet. Texting is a webhook
   the Apps Script calls after a saved claim. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SisterLesson = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var TIME = "7:30 PM";
  var START = "2026-11-11";
  var END = "2026-12-31";

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fail(error, message) { return { ok: false, error: error, message: message }; }
  function reply(status, body) { return { status: status, body: body }; }

  function utcNoon(ymd) {
    var p = String(ymd).split("-");
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12, 0, 0));
  }
  function ymdFromUtc(date) {
    return date.getUTCFullYear() + "-" + pad(date.getUTCMonth() + 1) + "-" + pad(date.getUTCDate());
  }
  function addDays(ymd, days) {
    var d = utcNoon(ymd);
    d.setUTCDate(d.getUTCDate() + days);
    return ymdFromUtc(d);
  }
  function isYmd(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
    return ymdFromUtc(utcNoon(value)) === value;
  }
  function isWeekday(ymd) {
    var day = utcNoon(ymd).getUTCDay();
    return day >= 1 && day <= 5;
  }
  function isCatalogDate(value) {
    return isYmd(value) && value >= START && value <= END && isWeekday(value);
  }
  function denverYmd(now) {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(now);
    var y = "", m = "", d = "";
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type === "year") y = parts[i].value;
      if (parts[i].type === "month") m = parts[i].value;
      if (parts[i].type === "day") d = parts[i].value;
    }
    return y + "-" + m + "-" + d;
  }
  function formatDate(ymd) {
    var d = utcNoon(ymd);
    var weeks = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return weeks[d.getUTCDay()] + ", " + months[d.getUTCMonth()] + " " + d.getUTCDate();
  }

  function buildNights() {
    var nights = [];
    var ymd = START;
    while (ymd <= END) {
      if (isWeekday(ymd)) {
        nights.push({ date: ymd, time: TIME, status: "open", name: "", phone: "", claimedAt: "" });
      }
      ymd = addDays(ymd, 1);
    }
    return nights;
  }
  function reservedRow(row) {
    if (!row) return false;
    var status = String(row.status || "").trim().toLowerCase();
    return status === "reserved" || !!String(row.name || "").trim() || !!String(row.phone || "").trim();
  }
  function merge(stored) {
    var byDate = {};
    (stored || []).forEach(function (row) {
      if (!row) return;
      var date = String(row.date || "").trim();
      if (!isCatalogDate(date)) return;
      byDate[date] = row;
    });
    return buildNights().map(function (night) {
      var row = byDate[night.date];
      var taken = reservedRow(row);
      return {
        date: night.date,
        time: TIME,
        status: taken ? "reserved" : "open",
        name: taken ? String(row.name || "").trim() : "",
        phone: taken ? String(row.phone || "").trim() : "",
        claimedAt: taken ? String(row.claimedAt || "") : ""
      };
    });
  }
  function publicNights(nights, now) {
    var today = denverYmd(now || new Date());
    var out = [];
    (nights || []).forEach(function (night) {
      var date = String(night && night.date || "").trim();
      if (!isCatalogDate(date) || date < today) return;
      var reserved = String(night.status || "").toLowerCase() === "reserved";
      var item = { date: date, time: TIME, status: reserved ? "reserved" : "open" };
      if (reserved) {
        var name = cleanName(night && night.name);
        if (name) item.name = name;
      }
      out.push(item);
    });
    return out;
  }
  function cleanName(value) {
    var name = String(value || "").replace(/\s+/g, " ").trim();
    if (name.length < 2 || name.length > 80) return "";
    if (/[<>]/.test(name) || /https?:|www\./i.test(name) || /\d/.test(name)) return "";
    if (/[^\p{L}\s.'’&-]/u.test(name)) return "";
    return name;
  }
  function nameMessage(value) {
    var raw = String(value || "").replace(/\s+/g, " ").trim();
    if (/\d/.test(raw)) return "Leave Your Address Off This Page.";
    return "Enter Your Name.";
  }
  function cleanPhone(value) {
    var raw = String(value || "").trim();
    if (!raw || !/^[0-9+().\-\s]+$/.test(raw)) return "";
    var digits = raw.replace(/\D/g, "");
    if (digits.length === 11 && digits.charAt(0) === "1") digits = digits.slice(1);
    if (digits.length !== 10) return "";
    return digits.slice(0, 3) + "-" + digits.slice(3, 6) + "-" + digits.slice(6);
  }
  function findNight(nights, date) {
    for (var i = 0; i < nights.length; i++) if (nights[i].date === date) return nights[i];
    return null;
  }
  function handle(opts) {
    opts = opts || {};
    var body = opts.body || {};
    var now = opts.now || new Date();
    var op = body.op || "list";
    var nights = merge(opts.loadNights ? opts.loadNights() : []);
    if (op === "list") return reply(200, { ok: true, nights: publicNights(nights, now) });
    if (op !== "claim") return reply(400, fail("validation", "That Action Is Not Available."));

    var date = String(body.date || "").trim();
    if (!isCatalogDate(date)) return reply(400, fail("validation", "Choose An Open Weeknight."));
    if (date < denverYmd(now)) return reply(400, fail("validation", "That Night Has Passed."));
    var name = cleanName(body.name);
    if (!name) return reply(400, fail("validation", nameMessage(body.name)));
    var phone = cleanPhone(body.phone);
    if (!phone) return reply(400, fail("validation", "Enter A Phone Number So The Sisters Can Confirm."));

    var night = findNight(nights, date);
    if (!night || night.status !== "open") {
      return reply(409, {
        ok: false,
        error: "reserved",
        message: "That Night Is Reserved.",
        nights: publicNights(nights, now)
      });
    }
    night.status = "reserved";
    night.name = name;
    night.phone = phone;
    night.claimedAt = now.toISOString();
    delete night.address;
    if (typeof opts.saveNights !== "function") return reply(503, fail("unavailable", "Sign-Up Could Not Be Saved."));
    opts.saveNights(nights);
    if (typeof opts.notify === "function") {
      try {
        opts.notify({ type: "sister-lesson-signup", name: name, phone: phone, date: date, time: TIME });
      } catch (ignore) {}
    }
    return reply(200, { ok: true, message: "You're Signed Up.", nights: publicNights(nights, now) });
  }

  return {
    TIME: TIME,
    START: START,
    END: END,
    buildNights: buildNights,
    publicNights: publicNights,
    handle: handle,
    formatDate: formatDate,
    denverYmd: denverYmd,
    cleanName: cleanName,
    cleanPhone: cleanPhone
  };
});
