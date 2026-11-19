/* Meet with the Bishop request.
   The phone's message app is the delivery path: one group text to Adam Bingham
   and Spencer Sorenson. There is no server. Extra scheduling details are packed
   into that same message. The sender's number arrives as the text's from-number;
   this file never adds a phone field. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Fb6Meet = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var NUMBERS = ["+18019921414", "+18012052600"];

  // tuesday:false means a counselor usually takes it, so Tuesday evening is not offered.
  // Lengths on the split types match the appointment list. Kept types keep their old length.
  var REASONS = [
    { id: "temple", label: "Temple Recommend", minutes: 15, tuesday: false, phrase: "a temple recommend appointment with a member of the bishopric" },
    { id: "youth", label: "Youth Interview", minutes: 15, tuesday: false, phrase: "a youth interview with a member of the bishopric" },
    { id: "tithing", label: "Tithing Declaration", minutes: 10, tuesday: true, tithing: true, phrase: "a tithing declaration appointment with the Bishop" },
    { id: "set-apart", label: "Set Apart", minutes: 10, tuesday: true, phrase: "a setting apart with the bishopric" },
    { id: "mission", label: "Mission Papers", minutes: 45, tuesday: true, phrase: "a mission papers appointment with the Bishop" },
    { id: "endowment", label: "Endowment Prep", minutes: 45, tuesday: true, phrase: "an endowment preparation appointment with the Bishop" },
    { id: "patriarchal", label: "Patriarchal Blessing Recommend", minutes: 30, tuesday: true, phrase: "a patriarchal blessing recommend appointment with the Bishop" },
    { id: "endorsement", label: "Ecclesiastical Endorsement", minutes: 15, tuesday: true, phrase: "an ecclesiastical endorsement appointment with the Bishop" },
    { id: "general", label: "General / Other", minutes: 30, tuesday: true, phrase: "a meeting with the Bishop" },
    { id: "first-recommend", label: "First Temple Recommend, New to the Ward, or Graduating Senior", minutes: 15, tuesday: true, phrase: "a temple recommend appointment with the Bishop" },
    { id: "melchizedek", label: "Melchizedek Priesthood Ordination", minutes: 30, tuesday: true, phrase: "a Melchizedek Priesthood ordination appointment with the Bishop" },
    { id: "sealing", label: "Sealing", minutes: 45, tuesday: true, phrase: "a sealing appointment with the Bishop" }
  ];

  var TIMES = [
    { id: "sun-am", label: "Sunday morning" },
    { id: "sun-pm", label: "Sunday afternoon" },
    { id: "tue", label: "Tuesday evening" },
    { id: "other", label: "Other" }
  ];

  var TUESDAY_NOTE = "Bishop only. Counselors don't meet on Tuesdays.";

  function reasonById(id) {
    for (var i = 0; i < REASONS.length; i++) if (REASONS[i].id === id) return REASONS[i];
    return null;
  }

  function timeChoices(reason) {
    return TIMES.map(function (t) {
      var disabled = t.id === "tue" && !!(reason && reason.tuesday === false);
      return { id: t.id, label: t.label, disabled: disabled, note: disabled ? TUESDAY_NOTE : "" };
    });
  }

  function cleanName(name) {
    return String(name == null ? "" : name).replace(/\s+/g, " ").trim();
  }

  function cleanNote(note) {
    return String(note == null ? "" : note).replace(/\s+/g, " ").trim();
  }

  function chosenIds(ids) {
    var want = {};
    (ids || []).forEach(function (id) { want[id] = true; });
    return TIMES.filter(function (t) { return want[t.id]; }).map(function (t) { return t.id; });
  }

  function validate(input) {
    input = input || {};
    var errors = [];
    var reason = reasonById(input.reasonId);
    var name = cleanName(input.name);
    var times = chosenIds(input.times);
    var note = cleanNote(input.note);
    if (!reason) errors.push({ field: "reason", message: "Please choose an appointment." });
    if (name.length < 2) errors.push({ field: "name", message: "Please add your name." });
    else if (name.length > 80) errors.push({ field: "name", message: "Please use a shorter name." });
    if (!times.length) errors.push({ field: "times", message: "Please choose at least one time that works." });
    if (reason && reason.tuesday === false && times.indexOf("tue") !== -1) {
      errors.push({ field: "times", message: "Tuesday evening is with the bishop. Please choose a Sunday time." });
    }
    if (times.indexOf("other") !== -1 && note.length < 2) {
      errors.push({ field: "note", message: "Since you chose Other, add a day and time in the note. Scheduling only, please." });
    }
    if (note.length > 160) errors.push({ field: "note", message: "Please keep the note to one short scheduling line." });
    return { ok: errors.length === 0, errors: errors };
  }

  function buildMessage(input) {
    var check = validate(input);
    if (!check.ok) {
      var err = new Error(check.errors[0].message);
      err.errors = check.errors;
      throw err;
    }
    var reason = reasonById(input.reasonId);
    var name = cleanName(input.name);
    var labels = chosenIds(input.times).map(function (id) {
      for (var i = 0; i < TIMES.length; i++) if (TIMES[i].id === id) return TIMES[i].label;
      return "";
    });
    var note = cleanNote(input.note);
    var lines;
    if (reason.tithing) {
      lines = [
        "Hi Adam and Spencer, I'd still like a tithing declaration appointment with the Bishop (10 min). Name: " + name,
        "Time needed: 10 minutes",
        "Preferred time: " + labels.join(", ")
      ];
    } else {
      lines = [
        "Hi Adam and Spencer, this is " + name + ". I'd like to schedule " + reason.phrase + ".",
        "Time needed: " + reason.minutes + " minutes",
        "Preferred time: " + labels.join(", ")
      ];
    }
    if (note) lines.push("Scheduling note: " + note);
    return lines.join("\n");
  }

  function smsHref(text, env) {
    env = env || {};
    var ua = env.userAgent != null ? env.userAgent : (typeof navigator !== "undefined" ? navigator.userAgent : "");
    var touch = env.ontouchend != null ? env.ontouchend : (typeof document !== "undefined" && "ontouchend" in document);
    var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch);
    var body = encodeURIComponent(text);
    var nums = NUMBERS.join(",");
    return ios ? "sms:/open?addresses=" + nums + "&body=" + body : "sms:" + nums + "?body=" + body;
  }

  function prepare(input, env) {
    var check = validate(input);
    if (!check.ok) return { ok: false, errors: check.errors };
    var text = buildMessage(input);
    return { ok: true, text: text, href: smsHref(text, env), numbers: NUMBERS.slice(), dry: !!(env && env.dry) };
  }

  return {
    NUMBERS: NUMBERS,
    REASONS: REASONS,
    TIMES: TIMES,
    FIELDS: ["appointment", "name", "times", "note"],
    reasonById: reasonById,
    timeChoices: timeChoices,
    validate: validate,
    buildMessage: buildMessage,
    smsHref: smsHref,
    prepare: prepare
  };
});
