/* Monthly Family History Challenge dates. America/Denver decides the month. No time zone is shown. */
(function (global) {
  function denverToday(date) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Denver",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date || new Date());
  }
  function monthEnd(id) {
    var parts = String(id || "").split("-");
    var year = +parts[0];
    var month = +parts[1];
    var last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return parts[0] + "-" + (month < 10 ? "0" : "") + month + "-" + (last < 10 ? "0" : "") + last;
  }
  function monthName(id) {
    var parts = String(id || "").split("-");
    return new Date(Date.UTC(+parts[0], +parts[1] - 1, 1)).toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "long",
      year: "numeric"
    });
  }
  function pick(list, today) {
    var month = String(today || "").slice(0, 7);
    var items = (list || []).filter(function (item) { return item && /^\d{4}-\d{2}$/.test(item.id); });
    items.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    var current = null;
    var upcoming = [];
    items.forEach(function (item) {
      if (item.id === month) current = item;
      else if (item.id > month) upcoming.push(item);
    });
    var featured = current || upcoming[0] || null;
    if (featured && !current) upcoming = upcoming.slice(1);
    return { today: today, month: month, current: current, featured: featured, upcoming: upcoming };
  }
  global.Fb6Fh = { denverToday: denverToday, monthEnd: monthEnd, monthName: monthName, pick: pick };
})(typeof window !== "undefined" ? window : globalThis);
