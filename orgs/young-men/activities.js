/* Young Men activity calendar. Data: ../../data/ym-activities.json, plus Young Men
   rows already on the Bay 6 Calendar (data/calendar.json), the same way Young Women
   class tabs pick up ywClass events. Combined nights stay one event. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.Fb6YmCal = api;
  if (typeof document !== "undefined") {
    var go = function () { api.mount(); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go);
    else go();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var ALL = ["deacons-quorum", "teachers-quorum", "priests-quorum"];
  var LABEL = { "deacons-quorum": "Deacons", "teachers-quorum": "Teachers", "priests-quorum": "Priests" };
  var FILTERS = [["all", "All"], ["deacons-quorum", "Deacons"], ["teachers-quorum", "Teachers"], ["priests-quorum", "Priests"]];
  var STOP = { combined: 1, young: 1, men: 1, women: 1, deacons: 1, deacon: 1, teachers: 1, teacher: 1, priests: 1, priest: 1, the: 1, and: 1, for: 1, all: 1, with: 1, our: 1, this: 1, week: 1, night: 1, project: 1, ym: 1, yw: 1 };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function todayISO(now) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(now || new Date());
  }
  function weekStart(iso) {
    var p = String(iso).split("-");
    var day = new Date(Date.UTC(+p[0], p[1] - 1, +p[2]));
    day.setUTCDate(day.getUTCDate() - day.getUTCDay());
    return day.toISOString().slice(0, 10);
  }
  function nice(iso, withWeekday) {
    var p = String(iso).split("-");
    var day = new Date(Date.UTC(+p[0], p[1] - 1, +p[2]));
    return day.toLocaleDateString("en-US", { timeZone: "UTC", weekday: withWeekday ? "long" : "short", month: "short", day: "numeric" });
  }
  function filterEvents(events, quorum, today, includePast) {
    var list = (events || []).filter(function (event) {
      if (!event || !event.date || !event.title) return false;
      var last = event.endDate || event.date;
      if (!includePast && last < today) return false;
      if (quorum && quorum !== "all" && (event.quorums || []).indexOf(quorum) < 0) return false;
      return true;
    });
    list.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return String(a.start || "").localeCompare(String(b.start || "")) || String(a.title).localeCompare(String(b.title));
    });
    return list;
  }
  function highlightLabel(event, today) {
    if (!event) return "";
    var day = event.date;
    var p = day.split("-");
    var date = new Date(Date.UTC(+p[0], p[1] - 1, +p[2]));
    var nowp = String(today).split("-");
    var now = new Date(Date.UTC(+nowp[0], nowp[1] - 1, +nowp[2]));
    if (date.getUTCDay() === 3 && weekStart(day) === weekStart(today) && date >= now) return "This Wednesday";
    if (date.getUTCDay() === 3 && date > now) return "Next Wednesday";
    return "Up Next";
  }
  function tokens(title) {
    return String(title || "").toLowerCase().replace(/flowrider/g, "flo rider").match(/[a-z0-9]+/g) || [];
  }
  function words(title) {
    return tokens(title).map(function (word) {
      if (word.length > 3 && word.charAt(word.length - 1) === "s" && word.slice(-2) !== "ss") word = word.slice(0, -1);
      return word;
    }).filter(function (word) { return !STOP[word] && word.length > 2; });
  }
  function similarTitle(a, b) {
    var left = {};
    var right = {};
    words(a).forEach(function (word) { left[word] = 1; });
    words(b).forEach(function (word) { right[word] = 1; });
    var lkeys = Object.keys(left);
    var rkeys = Object.keys(right);
    if (!lkeys.length || !rkeys.length) return false;
    function subset(small, big) {
      if (small.length < 2) return false;
      return small.every(function (word) { return big[word]; });
    }
    if (lkeys.length === rkeys.length && lkeys.every(function (word) { return right[word]; })) return true;
    return subset(lkeys, right) || subset(rkeys, left);
  }
  function inferQuorums(title) {
    var text = String(title || "");
    var found = [];
    if (/\bdeacons?\b/i.test(text)) found.push("deacons-quorum");
    if (/\bteachers?\b/i.test(text)) found.push("teachers-quorum");
    if (/\bpriests?\b/i.test(text)) found.push("priests-quorum");
    var ymyw = /ym\s*\/\s*yw|yw\s*\/\s*ym|young men and young women/i.test(text);
    var combined = ymyw || /\bcombined\b|\ball ym\b/i.test(text);
    if (combined || /\byoung men\b/i.test(text)) return { quorums: ALL.slice(), kind: ymyw ? "ymyw" : (combined ? "ym" : "") };
    return { quorums: found, kind: "" };
  }
  function churchStatus(title) {
    if (/thanksgiving|christmas|new year|fall break/i.test(title) && /no activity|happy|off/i.test(title)) return "holiday";
    if (/no activity/i.test(title)) return "none";
    return "activity";
  }
  function fromChurch(event) {
    var inferred = inferQuorums(event.title);
    var quorums = event.ymQuorum === "all" ? ALL.slice() : (event.ymQuorum ? [event.ymQuorum] : inferred.quorums);
    if (!quorums.length) quorums = ALL.slice();
    var startDay = String(event.start || "").slice(0, 10);
    var endDay = String(event.end || "").slice(0, 10);
    return {
      id: "church-" + event.id,
      date: startDay,
      endDate: event.allDay && endDay && endDay !== startDay ? endDay : "",
      title: event.title,
      location: event.location || "",
      map: "",
      quorums: quorums,
      combined: inferred.kind || (quorums.length > 1 ? "ym" : ""),
      category: "",
      status: churchStatus(event.title),
      details: "",
      allDay: !!event.allDay,
      time: "",
      timeAssumed: false,
      start: event.start,
      end: event.end,
      source: "church"
    };
  }
  function mergeChurch(sheet, church) {
    var out = (sheet || []).slice();
    (church || []).forEach(function (event) {
      if (!event || event.calendar && event.calendar !== "Young Men") return;
      var row = event.date ? event : fromChurch(event);
      var dup = out.some(function (have) {
        if (have.date !== row.date) return false;
        var share = (have.quorums || []).some(function (quorum) { return (row.quorums || []).indexOf(quorum) >= 0; });
        return share && similarTitle(have.title, row.title);
      });
      if (!dup) out.push(row);
    });
    return out;
  }

  var loaded;
  function load() {
    if (loaded) return loaded;
    if (typeof fetch !== "function") return Promise.resolve([]);
    loaded = Promise.all([
      fetch("../../data/ym-activities.json", { cache: "no-cache" }).then(function (r) { return r.json(); }),
      fetch("../../data/calendar.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).catch(function () { return { events: [] }; })
    ]).then(function (pair) {
      var church = ((pair[1] && pair[1].events) || []).filter(function (event) { return event.calendar === "Young Men"; });
      return mergeChurch((pair[0] && pair[0].events) || [], church);
    });
    return loaded;
  }

  function googleLink(event) {
    var dates;
    if (event.allDay) {
      var end = event.end ? String(event.end).slice(0, 10).replace(/-/g, "") : event.date.replace(/-/g, "");
      dates = event.date.replace(/-/g, "") + "/" + end;
    } else {
      var stamp = function (iso) { return new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, ""); };
      dates = stamp(event.start) + "/" + stamp(event.end);
    }
    var params = new URLSearchParams({
      action: "TEMPLATE",
      text: event.title,
      dates: dates,
      details: [event.details || "", "Farmington Bay 6th Ward Young Men"].filter(Boolean).join("\n"),
      location: event.location && event.location !== "To Be Determined" ? event.location : ""
    });
    return "https://calendar.google.com/calendar/render?" + params.toString();
  }
  function downloadIcs(event) {
    var stamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, "");
    var when;
    if (event.allDay) {
      when = ["DTSTART;VALUE=DATE:" + event.date.replace(/-/g, ""), "DTEND;VALUE=DATE:" + String(event.end || event.date).slice(0, 10).replace(/-/g, "")];
    } else {
      var z = function (iso) { return new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, ""); };
      when = ["DTSTART:" + z(event.start), "DTEND:" + z(event.end)];
    }
    var x = function (s) { return String(s || "").replace(/[\\,;]/g, function (c) { return "\\" + c; }); };
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Bay 6 Hub//Young Men Activities//EN", "BEGIN:VEVENT",
      "UID:" + event.id + "@bay6hub", "DTSTAMP:" + stamp].concat(when).concat(["SUMMARY:" + x(event.title)]);
    if (event.location && event.location !== "To Be Determined") lines.push("LOCATION:" + x(event.location));
    lines.push("END:VEVENT", "END:VCALENDAR");
    var blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = event.title.replace(/[^\w ]/g, "").trim() + ".ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function badges(event) {
    var html = "";
    if (event.combined === "ymyw") html += '<span class="ymtag combined">Combined With Young Women</span>';
    else if (event.combined) html += '<span class="ymtag combined">Combined</span>';
    if (event.status === "holiday") html += '<span class="ymtag holiday">Holiday</span>';
    if (event.status === "none" || event.status === "holiday") html += '<span class="ymtag none">No Activity</span>';
    if (event.status === "tbd") html += '<span class="ymtag tbd">TBD</span>';
    if ((event.quorums || []).length === 3) html += '<span class="ymtag quorum">All Quorums</span>';
    else (event.quorums || []).forEach(function (quorum) { if (LABEL[quorum]) html += '<span class="ymtag quorum">' + LABEL[quorum] + "</span>"; });
    if (event.category && event.status === "activity") html += '<span class="ymtag cat">' + esc(event.category) + "</span>";
    return html;
  }
  function whenLine(event) {
    var day = nice(event.date, true);
    if (event.endDate) day += " – " + nice(event.endDate, true);
    if (event.allDay) return day + " · All Day";
    if (event.time) return day + " · " + event.time;
    return day;
  }
  function card(event, spotlight) {
    var where = event.location && event.location !== "To Be Determined" ? event.location : (event.status === "activity" || event.status === "tbd" ? "Location To Be Determined" : "");
    var map = event.map && where && where.indexOf("Member Home") < 0
      ? '<a class="btn alt" href="https://maps.google.com/?q=' + encodeURIComponent(event.map) + '" rel="noopener">Map</a>' : "";
    return '<article class="ev ymrow' + (spotlight ? " ymnext" : "") + " ym-" + esc(event.status) + '">' +
      '<div class="ymdate" aria-hidden="true"><small>' + esc(nice(event.date, false).split(",")[0] || "") + '</small><b>' + esc(String(+event.date.slice(8))) + '</b></div>' +
      '<div class="evtx"><b>' + esc(event.title) + "</b>" +
      '<p class="when">' + esc(whenLine(event)) + "</p>" +
      (where ? '<p class="where">' + esc(where) + "</p>" : "") +
      (event.details ? '<p class="ymdetail">' + esc(event.details) + "</p>" : "") +
      '<p class="ymtags">' + badges(event) + "</p>" +
      '<div class="acts"><button type="button" class="btn ymadd" data-id="' + esc(event.id) + '">Add To Calendar</button> ' +
      '<a class="btn alt" href="' + esc(googleLink(event)) + '" rel="noopener">Google Calendar</a> ' + map +
      "</div></div></article>";
  }
  function groups(events, spotlightIds) {
    var html = "";
    var week = "";
    events.forEach(function (event) {
      var start = weekStart(event.date);
      var label = "Week Of " + nice(start, false).split(", ").slice(1).join(", ");
      if (label !== week) { html += '<h3 class="ymweek">' + esc(label) + "</h3>"; week = label; }
      html += card(event, spotlightIds[event.id]);
    });
    return html;
  }

  function paint(el, events, quorum, options) {
    options = options || {};
    var today = options.today || todayISO();
    var upcoming = filterEvents(events, quorum, today, false);
    var past = filterEvents(events, quorum, today, true).filter(function (event) { return (event.endDate || event.date) < today; });
    var label = quorum === "all" ? "Young Men" : (LABEL[quorum] || "This Quorum");
    var spotlight = upcoming.length ? upcoming.filter(function (event) { return event.date === upcoming[0].date; }) : [];
    var ids = {};
    spotlight.forEach(function (event) { ids[event.id] = true; });
    var rest = upcoming.filter(function (event) { return !ids[event.id]; });
    var sub = "";
    if (options.subscribe && typeof location !== "undefined") {
      var https = new URL("activities.ics", location.href).href;
      var webcal = https.replace(/^https?:/, "webcal:");
      sub = '<div class="ymsub"><a class="btn" href="activities.ics">Download Calendar</a> ' +
        '<a class="btn alt" href="' + esc(webcal) + '">Apple Calendar</a> ' +
        '<a class="btn alt" href="' + esc("https://calendar.google.com/calendar/r?cid=" + encodeURIComponent(webcal)) + '" rel="noopener">Google Calendar</a></div>' +
        '<p class="note">One calendar for every quorum. A home is listed as “Member Home” — leaders share the address.</p>';
    }
    var filters = "";
    if (options.filter) {
      filters = '<div class="ymfilters" role="group" aria-label="Quorum">' + FILTERS.map(function (item) {
        var on = item[0] === quorum;
        return '<button type="button" data-quorum="' + item[0] + '" aria-pressed="' + (on ? "true" : "false") + '">' + item[1] + "</button>";
      }).join("") + "</div>";
    }
    var head = spotlight.length
      ? '<p class="ymkicker">' + esc(highlightLabel(spotlight[0], today)) + "</p>" + spotlight.map(function (event) { return card(event, true); }).join("")
      : '<p class="empty">Nothing Coming Up For ' + esc(label) + ".</p>";
    el.innerHTML = (options.intro ? '<p class="note">Mutual is Wednesday at 7:00 PM unless a time is listed. Pick a quorum to see only that quorum.</p>' : "") +
      filters + sub + head + (rest.length ? groups(rest, {}) : "") +
      (past.length ? '<details class="ympast"><summary>Past Activities</summary>' + groups(past, {}) + "</details>" : "");
    el._events = events;
    el._ymQuorum = quorum;
  }

  function bind(el, options) {
    if (el._ymBound) return;
    el._ymBound = true;
    el.addEventListener("click", function (e) {
      var filter = e.target.closest && e.target.closest("button[data-quorum]");
      if (filter) {
        paint(el, el._events || [], filter.getAttribute("data-quorum"), options);
        return;
      }
      var add = e.target.closest && e.target.closest("button.ymadd");
      if (!add) return;
      var id = add.getAttribute("data-id");
      var event = (el._events || []).filter(function (item) { return item.id === id; })[0];
      if (event) downloadIcs(event);
    });
  }

  var cssDone = false;
  function css() {
    if (cssDone || typeof document === "undefined") return;
    cssDone = true;
    var style = document.createElement("style");
    style.textContent = "" +
      ".ymfilters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:8px 0 12px;scroll-margin-top:210px}" +
      ".ymfilters button{min-height:44px;border-radius:12px;border:1px solid var(--line,#e8dfd3);background:#fff;color:var(--accent,#005175);font:700 13px/1.1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;cursor:pointer}" +
      ".ymfilters button[aria-pressed=true]{background:#005175;color:#fff;border-color:#005175}" +
      ".ymsub{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}.ymsub .btn{margin:0}" +
      ".ymkicker{margin:12px 0 4px;font:700 13px/1.2 -apple-system,sans-serif;color:#8a6d22}" +
      ".ymweek{margin:16px 0 0;font-size:15px;font-weight:700;color:var(--soft,#6d625a)}" +
      ".ymrow{align-items:flex-start}.ymrow.ymnext{border:2px solid #c9a24a;border-radius:14px;padding:10px;margin-top:4px;background:#fffdf8}" +
      ".ymdate{flex:0 0 52px;height:56px;border-radius:12px;background:#e3eef4;color:#005175;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1}" +
      ".ymdate small{font-size:11px;font-weight:700;text-transform:uppercase}.ymdate b{font-size:22px;margin-top:3px}" +
      ".ymtags{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}.ymtag{font:700 11px/1 -apple-system,sans-serif;letter-spacing:.04em;border-radius:999px;padding:4px 8px}" +
      ".ymtag.combined{background:#005175;color:#fff}.ymtag.quorum{background:#e3eef4;color:#005175}.ymtag.cat{background:#f6ecd2;color:#8a6d22}" +
      ".ymtag.none,.ymtag.holiday{background:#efeae4;color:#6d625a}.ymtag.tbd{background:#fff;color:#8a6d22;border:1px dashed #c9a24a}" +
      ".ym-none,.ym-holiday{opacity:.92}.ym-tbd{border-style:dashed}" +
      ".ymdetail{margin:2px 0 0;color:var(--soft,#6d625a);font-size:13.5px}" +
      ".ympast{margin-top:12px}.ympast summary{cursor:pointer;font-weight:700;color:var(--accent,#005175);min-height:44px;display:flex;align-items:center}" +
      ".ymadd{border:0;cursor:pointer;font-family:inherit}" +
      "@media (prefers-color-scheme: dark){.ymfilters button{background:#27211d;color:#e2c47a}.ymfilters button[aria-pressed=true]{background:#005175;color:#fff}.ymrow.ymnext{background:#2a2414}.ymdate{background:#33291f;color:#8cc8e6}.ymtag.quorum{background:#33291f;color:#8cc8e6}}";
    document.head.appendChild(style);
  }

  function renderInto(el, quorum) {
    if (!el) return;
    css();
    var options = { filter: false, subscribe: false, intro: false, today: todayISO() };
    bind(el, options);
    el.innerHTML = '<p class="note">Loading the activity calendar…</p>';
    load().then(function (events) { paint(el, events, quorum || "all", options); }).catch(function () {
      el.innerHTML = '<p class="empty">The activity calendar could not be loaded. Refresh and try again.</p>';
    });
  }
  function mount() {
    var el = document.getElementById("ym-cal");
    if (!el) return;
    css();
    var options = { filter: true, subscribe: true, intro: true, today: todayISO() };
    bind(el, options);
    load().then(function (events) { paint(el, events, "all", options); }).catch(function () {
      el.innerHTML = '<p class="empty">The activity calendar could not be loaded. Refresh and try again.</p>';
    });
  }

  return {
    ALL: ALL,
    todayISO: todayISO,
    weekStart: weekStart,
    filterEvents: filterEvents,
    highlightLabel: highlightLabel,
    inferQuorums: inferQuorums,
    similarTitle: similarTitle,
    mergeChurch: mergeChurch,
    fromChurch: fromChurch,
    renderInto: renderInto,
    mount: mount
  };
});
