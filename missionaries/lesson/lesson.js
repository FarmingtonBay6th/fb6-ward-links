/* Sister Missionary lesson request rules.
   The stake schedule is a Google Doc calendar. Each weekday cell holds
   Time, Name, Ward, and Address. This module does not send mail or text,
   and it does not store anyone else's signup. An empty scriptUrl means the
   draft stays on this phone. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LessonForm = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var TIMES = [
    { value: "6:30", label: "6:30 PM" },
    { value: "7:00", label: "7:00 PM" },
    { value: "7:30", label: "7:30 PM" },
    { value: "8:00", label: "8:00 PM" }
  ];
  var STORAGE_KEY = "fb6-sister-lesson-draft-v1";
  /* These already belong to other Hub tools. A lesson request must not be posted there. */
  var BLOCKED_SCRIPT_URLS = {
    "https://script.google.com/macros/s/AKfycbx9tx5QhPB5vXaAXvwTNNalymcP9YCJaxDQbQEsnbCQts-dSQho0jETdl_AuK_w_K93/exec": true,
    "https://script.google.com/macros/s/AKfycbwAsUucP-s5V1ILI8EzNPh4UuhqowJh8-J7V3K6knDXCkmU2UuW0DNpgieYCPc7D1pr/exec": true
  };

  function parseISO(iso) {
    var p = String(iso || "").split("-");
    if (p.length !== 3) return null;
    var y = Number(p[0]), m = Number(p[1]), d = Number(p[2]);
    if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return dt;
  }

  function isoFromDate(dt) {
    var m = String(dt.getUTCMonth() + 1), d = String(dt.getUTCDate());
    if (m.length < 2) m = "0" + m;
    if (d.length < 2) d = "0" + d;
    return dt.getUTCFullYear() + "-" + m + "-" + d;
  }

  function addDays(iso, n) {
    var dt = parseISO(iso);
    if (!dt) return "";
    dt.setUTCDate(dt.getUTCDate() + n);
    return isoFromDate(dt);
  }

  function weekday(iso) {
    var dt = parseISO(iso);
    return dt ? dt.getUTCDay() : -1;
  }

  function formatMonthDay(iso) {
    var dt = parseISO(iso);
    if (!dt) return "";
    return MONTHS[dt.getUTCMonth()] + " " + dt.getUTCDate();
  }

  function formatLong(iso) {
    var dt = parseISO(iso);
    if (!dt) return "";
    return WEEKDAYS[dt.getUTCDay()] + ", " + MONTHS[dt.getUTCMonth()] + " " + dt.getUTCDate();
  }

  function formatFull(iso) {
    var dt = parseISO(iso);
    if (!dt) return "";
    return MONTHS[dt.getUTCMonth()] + " " + dt.getUTCDate() + ", " + dt.getUTCFullYear();
  }

  function todayInDenver(now) {
    var fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Denver",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return fmt.format(now || new Date());
  }

  function expandSchedule(src) {
    var taken = {};
    var list = src && Array.isArray(src.taken) ? src.taken : [];
    for (var i = 0; i < list.length; i++) taken[list[i]] = true;
    var slots = [];
    var cursor = src && src.rangeStart;
    var end = src && src.rangeEnd;
    var guard = 0;
    while (cursor && end && cursor <= end && guard < 400) {
      var day = weekday(cursor);
      if (day >= 1 && day <= 5) slots.push({ date: cursor, status: taken[cursor] ? "taken" : "open" });
      cursor = addDays(cursor, 1);
      guard++;
    }
    return { checkedOn: src && src.checkedOn || "", slots: slots };
  }

  function mondayOf(iso) {
    var day = weekday(iso);
    if (day < 0) return iso;
    return addDays(iso, day === 0 ? -6 : 1 - day);
  }

  function choiceGroups(schedule, today) {
    var groups = [];
    var map = {};
    var slots = schedule && schedule.slots ? schedule.slots : [];
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      if (!slot || slot.status !== "open" || !slot.date || slot.date < today) continue;
      var key = mondayOf(slot.date);
      if (!map[key]) {
        map[key] = { id: key, title: "Week Of " + formatMonthDay(key), slots: [] };
        groups.push(map[key]);
      }
      map[key].slots.push({ date: slot.date, label: formatLong(slot.date) });
    }
    return groups;
  }

  function line(value, max) {
    return String(value == null ? "" : value).replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max + 1);
  }

  function timeAllowed(value) {
    for (var i = 0; i < TIMES.length; i++) if (TIMES[i].value === value) return true;
    return false;
  }

  function validate(input, opts) {
    input = input || {};
    var errors = {};
    if (String(input.website || "").trim()) {
      return { ok: false, error: "Could Not Save.", errors: { form: "Could Not Save." } };
    }
    var date = String(input.date || "").trim();
    var slots = opts && opts.slots ? opts.slots : [];
    var slot = null;
    for (var i = 0; i < slots.length; i++) if (slots[i].date === date) slot = slots[i];
    var today = opts && opts.today || "";
    if (!date) errors.date = "Choose An Open Evening.";
    else if (!slot || weekday(date) === 0 || weekday(date) === 6) errors.date = "That Evening Is Not On The Schedule.";
    else if (slot.status === "taken") errors.date = "That Evening Is Already Taken.";
    else if (today && date < today) errors.date = "That Evening Has Passed.";
    else if (slot.status !== "open") errors.date = "That Evening Is Not On The Schedule.";

    var time = String(input.time || "").trim();
    if (!timeAllowed(time)) errors.time = "Choose A Time.";

    var name = line(input.name, 80);
    if (name.length < 2) errors.name = "Enter Your Name.";
    else if (name.length > 80) errors.name = "Use 80 Characters Or Fewer For Your Name.";

    var ward = line(input.ward, 40);
    if (!ward) errors.ward = "Enter Your Ward.";
    else if (ward.length > 40) errors.ward = "Use 40 Characters Or Fewer For Your Ward.";

    var address = line(input.address, 120);
    if (address.length < 5 || !/\d/.test(address)) errors.address = "Enter The Home Address, Including The Number.";
    else if (address.length > 120) errors.address = "Use 120 Characters Or Fewer For The Address.";

    var keys = Object.keys(errors);
    if (keys.length) return { ok: false, error: errors[keys[0]], errors: errors };
    return {
      ok: true,
      value: { date: date, time: time, name: name, ward: ward, address: address }
    };
  }

  function scriptUrlKind(scriptUrl) {
    var url = String(scriptUrl || "").trim();
    if (!url) return "empty";
    if (BLOCKED_SCRIPT_URLS[url]) return "blocked";
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) return "invalid";
    return "ready";
  }

  function planSubmit(input, opts) {
    opts = opts || {};
    var schedule = opts.schedule || { slots: [] };
    var checked = validate(input, { slots: schedule.slots, today: opts.today });
    if (!checked.ok) return { state: "invalid", ok: false, error: checked.error, errors: checked.errors };
    var kind = scriptUrlKind(opts.scriptUrl);
    if (kind === "blocked" || kind === "invalid") {
      return {
        state: "draft",
        ok: false,
        error: "Not On The Stake Schedule. This address is not the lesson schedule, so nothing was sent. The draft stays on this phone.",
        draft: checked.value
      };
    }
    if (kind === "empty") {
      return {
        state: "draft",
        ok: false,
        error: "Not On The Stake Schedule. This draft stays on this phone. Nobody has been notified.",
        draft: checked.value
      };
    }
    return {
      state: "send",
      url: String(opts.scriptUrl).trim(),
      body: {
        date: checked.value.date,
        time: checked.value.time,
        name: checked.value.name,
        ward: checked.value.ward,
        address: checked.value.address
      }
    };
  }

  function interpretResponse(body) {
    if (body && body.ok === true) {
      return { state: "saved", message: "Your Evening Is On The Stake Schedule." };
    }
    var error = body && body.error ? String(body.error) : "The Stake Schedule Did Not Save This Request.";
    return { state: "error", error: error };
  }

  function parseSlotText(text) {
    var lines = String(text || "").split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) return null;
    var dayMatch = lines[0].match(/^(\d{1,2})\b/);
    var bookable = false;
    var name = "";
    for (var i = 0; i < lines.length; i++) {
      if (/^time\s*:/i.test(lines[i])) bookable = true;
      if (/^name\s*:/i.test(lines[i])) name = lines[i].split(":").slice(1).join(":").trim();
    }
    if (!dayMatch) return { day: "", bookable: false, status: "closed", hasName: false };
    return {
      day: dayMatch[1],
      bookable: bookable,
      status: name ? "taken" : "open",
      hasName: !!name
    };
  }

  function applySlotText(existing, payload) {
    payload = payload || {};
    var parsed = parseSlotText(existing);
    if (!parsed || !parsed.bookable || !parsed.day) {
      return { ok: false, error: "That Evening Is Not On The Schedule." };
    }
    if (parsed.hasName) return { ok: false, error: "That Evening Is Already Taken." };
    function oneLine(value) {
      return String(value == null ? "" : value).replace(/[\r\n]+/g, " ").trim();
    }
    return {
      ok: true,
      text: [
        parsed.day,
        "Time: " + oneLine(payload.time),
        "Name: " + oneLine(payload.name),
        "Ward: " + oneLine(payload.ward),
        "Address: " + oneLine(payload.address)
      ].join("\n")
    };
  }

  function publicSlots(slots) {
    var out = [];
    var list = Array.isArray(slots) ? slots : [];
    for (var i = 0; i < list.length; i++) {
      var slot = list[i] || {};
      if (slot.status !== "open" && slot.status !== "taken") continue;
      if (!parseISO(slot.date)) continue;
      out.push({ date: slot.date, status: slot.status });
    }
    return out;
  }

  function readDraft(storage) {
    if (!storage) return null;
    try {
      var raw = storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.draft || data.sent === true) return null;
      return data.draft;
    } catch (e) {
      return null;
    }
  }

  function writeDraft(storage, draft) {
    storage.setItem(STORAGE_KEY, JSON.stringify({ sent: false, draft: draft }));
  }

  function clearDraft(storage) {
    storage.removeItem(STORAGE_KEY);
  }

  function el(doc, tag, attrs, text) {
    var node = doc.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === "className") node.className = attrs[key];
        else node.setAttribute(key, attrs[key]);
      });
    }
    if (text != null) node.textContent = text;
    return node;
  }

  function mount(root, opts) {
    opts = opts || {};
    var doc = root.ownerDocument;
    var schedule = expandSchedule(opts.availability);
    var today = opts.today || todayInDenver();
    var kind = scriptUrlKind(opts.scriptUrl);
    var connected = kind === "ready";
    var state = { date: "", time: "", name: "", ward: "", address: "" };
    var saved = readDraft(opts.storage);
    if (saved) {
      state.date = saved.date || "";
      state.time = saved.time || "";
      state.name = saved.name || "";
      state.ward = saved.ward || "";
      state.address = saved.address || "";
    }

    root.innerHTML = "";
    var banner = el(doc, "div", { className: "banner", role: "status" });
    banner.appendChild(el(doc, "b", null, connected ? "Ready To Send" : "Not Connected"));
    banner.appendChild(el(doc, "p", null, connected
      ? "Request This Evening writes to the stake schedule only after that schedule accepts it."
      : "Saving a draft keeps it on this phone only. It is not written to the stake schedule, and no message is sent."));
    root.appendChild(banner);
    if (kind === "blocked" || kind === "invalid") {
      root.appendChild(el(doc, "p", { className: "alert", role: "alert" }, "The configured address is not the lesson schedule. Nothing will be sent there."));
    }

    var note = el(doc, "p", { className: "note" });
    note.textContent = "Open evenings are weekdays still empty on the stake schedule as of " +
      formatFull(schedule.checkedOn || "2026-11-07") +
      ". Evenings that already have a name are hidden. Names and addresses already on the schedule are not shown.";
    root.appendChild(note);

    var choiceTitle = el(doc, "h2", null, "Choose An Evening");
    root.appendChild(choiceTitle);
    var choiceBox = el(doc, "div", { id: "evenings" });
    var groups = choiceGroups(schedule, today);
    if (!groups.length) {
      choiceBox.appendChild(el(doc, "p", { className: "note" }, "No Open Evenings On This Copy Of The Schedule."));
    }
    groups.forEach(function (group) {
      choiceBox.appendChild(el(doc, "h3", null, group.title));
      var grid = el(doc, "div", { className: "grid", role: "group", "aria-label": group.title });
      group.slots.forEach(function (slot) {
        var btn = el(doc, "button", { type: "button", className: "evening", "data-date": slot.date, "aria-pressed": state.date === slot.date ? "true" : "false" });
        var dt = parseISO(slot.date);
        btn.appendChild(el(doc, "b", null, WEEKDAYS[dt.getUTCDay()]));
        btn.appendChild(el(doc, "span", null, formatMonthDay(slot.date)));
        grid.appendChild(btn);
      });
      choiceBox.appendChild(grid);
    });
    root.appendChild(choiceBox);
    var dateError = el(doc, "p", { className: "field-error", id: "date-error", role: "alert" });
    dateError.hidden = true;
    root.appendChild(dateError);

    var form = el(doc, "form", { id: "lesson-form", novalidate: "novalidate" });
    form.appendChild(el(doc, "h2", null, "Your Details"));
    var picked = el(doc, "p", { className: "picked", id: "picked" });
    form.appendChild(picked);

    form.appendChild(el(doc, "fieldset", { className: "times" }));
    var timeSet = form.lastChild;
    timeSet.appendChild(el(doc, "legend", null, "Time"));
    timeSet.appendChild(el(doc, "p", { className: "hint" }, "7:30 PM is the time written on earlier evenings in the stake schedule."));
    TIMES.forEach(function (time) {
      var label = el(doc, "label", { className: "time" });
      var input = el(doc, "input", { type: "radio", name: "time", value: time.value });
      if (state.time === time.value) input.checked = true;
      label.appendChild(input);
      label.appendChild(el(doc, "span", null, time.label));
      timeSet.appendChild(label);
    });
    var timeError = el(doc, "p", { className: "field-error", id: "time-error", role: "alert" });
    timeError.hidden = true;
    timeSet.appendChild(timeError);

    function field(id, label, value, autocomplete) {
      var wrap = el(doc, "div", { className: "field" });
      wrap.appendChild(el(doc, "label", { for: id }, label));
      var input = el(doc, "input", { id: id, name: id, type: "text", autocomplete: autocomplete, maxlength: id === "name" ? "80" : id === "ward" ? "40" : "120" });
      input.value = value || "";
      wrap.appendChild(input);
      var err = el(doc, "p", { className: "field-error", id: id + "-error", role: "alert" });
      err.hidden = true;
      wrap.appendChild(err);
      form.appendChild(wrap);
      return input;
    }

    var nameInput = field("name", "Your Name", state.name, "name");
    var wardInput = field("ward", "Ward", state.ward, "organization");
    var addressInput = field("address", "Home Address", state.address, "street-address");

    var honey = el(doc, "div", { className: "hp" });
    var honeyLabel = el(doc, "label", { for: "website" }, "Website");
    honey.appendChild(honeyLabel);
    honey.appendChild(el(doc, "input", { id: "website", name: "website", type: "text", tabindex: "-1", autocomplete: "off" }));
    form.appendChild(honey);

    var submit = el(doc, "button", { type: "submit", className: "save", id: "save" }, connected ? "Request This Evening" : "Save Draft On This Phone");
    form.appendChild(submit);
    var formError = el(doc, "p", { className: "alert", id: "form-error", role: "alert" });
    formError.hidden = true;
    form.appendChild(formError);
    root.appendChild(form);

    var result = el(doc, "section", { id: "result", hidden: "hidden" });
    root.appendChild(result);

    function paintPicked() {
      picked.textContent = state.date ? "Evening: " + formatLong(state.date) : "Evening: none selected";
      var buttons = choiceBox.querySelectorAll("button.evening");
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].setAttribute("aria-pressed", buttons[i].getAttribute("data-date") === state.date ? "true" : "false");
      }
    }

    function showFieldErrors(errors) {
      errors = errors || {};
      dateError.hidden = !errors.date;
      dateError.textContent = errors.date || "";
      timeError.hidden = !errors.time;
      timeError.textContent = errors.time || "";
      ["name", "ward", "address"].forEach(function (id) {
        var node = doc.getElementById(id + "-error");
        var input = doc.getElementById(id);
        node.hidden = !errors[id];
        node.textContent = errors[id] || "";
        if (errors[id]) input.setAttribute("aria-invalid", "true");
        else input.removeAttribute("aria-invalid");
      });
      formError.hidden = !errors.form;
      formError.textContent = errors.form || "";
    }

    function readInput() {
      var selected = form.querySelector("input[name=time]:checked");
      return {
        date: state.date,
        time: selected ? selected.value : "",
        name: nameInput.value,
        ward: wardInput.value,
        address: addressInput.value,
        website: form.querySelector("#website").value
      };
    }

    function showDraft(draft, message) {
      result.hidden = false;
      result.className = "hold";
      result.innerHTML = "";
      result.appendChild(el(doc, "h2", null, "Draft Saved On This Phone"));
      result.appendChild(el(doc, "p", null, message));
      var list = el(doc, "dl");
      function row(term, value) {
        list.appendChild(el(doc, "dt", null, term));
        list.appendChild(el(doc, "dd", null, value));
      }
      row("Evening", formatLong(draft.date));
      row("Time", draft.time + " PM");
      row("Your Name", draft.name);
      row("Ward", draft.ward);
      row("Home Address", draft.address);
      result.appendChild(list);
      var del = el(doc, "button", { type: "button", className: "alt", id: "delete-draft" }, "Delete Draft");
      del.addEventListener("click", function () {
        clearDraft(opts.storage);
        result.hidden = true;
        result.innerHTML = "";
      });
      result.appendChild(del);
    }

    function showSaved(message) {
      result.hidden = false;
      result.className = "saved";
      result.innerHTML = "";
      result.appendChild(el(doc, "h2", null, "On The Stake Schedule"));
      result.appendChild(el(doc, "p", null, message));
    }

    function showSendError(message) {
      result.hidden = true;
      formError.hidden = false;
      formError.textContent = message;
    }

    paintPicked();
    if (saved && saved.date) showDraft(saved, "A draft was already on this phone. It is not on the stake schedule.");

    function clearSummary() {
      formError.hidden = true;
      formError.textContent = "";
    }
    choiceBox.addEventListener("click", function (event) {
      var btn = event.target.closest ? event.target.closest("button.evening") : null;
      if (!btn) return;
      state.date = btn.getAttribute("data-date");
      paintPicked();
      dateError.hidden = true;
      clearSummary();
    });
    form.addEventListener("change", function (event) {
      if (event.target && event.target.name === "time") {
        timeError.hidden = true;
        clearSummary();
      }
    });
    form.addEventListener("input", function (event) {
      var id = event.target && event.target.id;
      var node = id && doc.getElementById(id + "-error");
      if (!node) return;
      node.hidden = true;
      event.target.removeAttribute("aria-invalid");
      clearSummary();
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var plan = planSubmit(readInput(), { schedule: schedule, today: today, scriptUrl: opts.scriptUrl });
      if (plan.state === "invalid") {
        showFieldErrors(plan.errors);
        formError.hidden = false;
        formError.textContent = plan.error;
        if (formError.scrollIntoView) formError.scrollIntoView({ block: "nearest" });
        return;
      }
      showFieldErrors({});
      if (plan.state === "draft") {
        writeDraft(opts.storage, plan.draft);
        showDraft(plan.draft, plan.error);
        if (result.scrollIntoView) result.scrollIntoView({ block: "nearest" });
        return;
      }
      submit.disabled = true;
      var request = (opts.fetch || function () { return Promise.reject(new Error("no fetch")); })(plan.url, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(plan.body)
      });
      Promise.resolve(request).then(function (res) {
        return res && res.json ? res.json() : null;
      }).then(function (body) {
        var outcome = interpretResponse(body);
        if (outcome.state === "saved") {
          clearDraft(opts.storage);
          showSaved(outcome.message);
        } else showSendError(outcome.error);
      }).catch(function () {
        showSendError("The Stake Schedule Did Not Save This Request.");
      }).then(function () {
        submit.disabled = false;
      });
    });

    return { schedule: schedule, today: today, connected: connected };
  }

  return {
    TIMES: TIMES,
    STORAGE_KEY: STORAGE_KEY,
    parseISO: parseISO,
    addDays: addDays,
    weekday: weekday,
    formatLong: formatLong,
    formatFull: formatFull,
    formatMonthDay: formatMonthDay,
    todayInDenver: todayInDenver,
    expandSchedule: expandSchedule,
    choiceGroups: choiceGroups,
    validate: validate,
    planSubmit: planSubmit,
    interpretResponse: interpretResponse,
    parseSlotText: parseSlotText,
    applySlotText: applySlotText,
    publicSlots: publicSlots,
    scriptUrlKind: scriptUrlKind,
    readDraft: readDraft,
    writeDraft: writeDraft,
    clearDraft: clearDraft,
    mount: mount
  };
});
