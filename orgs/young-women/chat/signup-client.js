/* Browser client for ward sign-ups. Talks only to the private Google script.
   Does not keep the sign-up board on the phone. */
(function () {
  "use strict";
  var TOKEN_KEY = "fb6-yw-signups-token";
  var clientId = "";
  var viewState = null;
  var members = null;

  function cfg() {
    return (window.YW_CHAT_CONFIG && window.YW_CHAT_CONFIG.signups) || {};
  }
  function scriptUrl() {
    var url = cfg().scriptUrl || "";
    return url.indexOf("https://script.google.com/macros/s/") === 0 ? url : "";
  }
  function configured() { return !!scriptUrl(); }
  function token() {
    try { return sessionStorage.getItem(TOKEN_KEY) || ""; }
    catch (e) { return ""; }
  }
  function setToken(value) {
    try {
      if (value) sessionStorage.setItem(TOKEN_KEY, value);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }
  function notConnectedHtml() {
    return "<div class=\"panel-head\"><h2>Sign-Ups</h2>" +
      "<p>Sign-Ups Are Not Connected.</p></div>" +
      "<div class=\"callout\"><b>A Ward Leader Still Needs To Deploy The Private Google Script</b>" +
      "<p>Nothing is saved on this phone. Chat messages are separate and are not used as the sign-up list.</p></div>";
  }
  function signInHtml() {
    return "<div class=\"panel-head\"><h2>Sign-Ups</h2><p>Sign In With The Google Account A Leader Added To The Ward List.</p></div>" +
      "<div id=\"su-google-signin\"></div>" +
      "<p class=\"signup-note\">Names stay in the private ward list. This phone does not keep the sign-up board.</p>";
  }
  function loadGis() {
    return new Promise(function (resolve, reject) {
      if (window.google && window.google.accounts && window.google.accounts.id) { resolve(); return; }
      var existing = document.getElementById("gsi-client");
      if (existing) { existing.addEventListener("load", function () { resolve(); }); existing.addEventListener("error", reject); return; }
      var s = document.createElement("script");
      s.id = "gsi-client";
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("Google Sign-In Did Not Load.")); };
      document.head.appendChild(s);
    });
  }
  function renderButton() {
    var el = document.getElementById("su-google-signin");
    if (!el || !clientId || !window.google || !window.google.accounts) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: function (resp) {
        if (resp && resp.credential) {
          setToken(resp.credential);
          var wrap = document.getElementById("main-panel");
          if (wrap) paint(wrap, paint.opts || {});
        }
      }
    });
    window.google.accounts.id.renderButton(el, { theme: "outline", size: "large", text: "signin_with", shape: "rectangular", width: 280 });
  }
  function request(op, extra) {
    var payload = { op: op, idToken: token() };
    if (extra) Object.keys(extra).forEach(function (key) { payload[key] = extra[key]; });
    return fetch(scriptUrl(), {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).then(function (res) { return res.json(); });
  }
  function loadClientId() {
    if (clientId) return Promise.resolve(clientId);
    return fetch(scriptUrl(), { method: "GET", redirect: "follow" }).then(function (res) { return res.json(); }).then(function (body) {
      clientId = (body && body.clientId) || "";
      return clientId;
    });
  }
  function adminHtml() {
    if (!members) return "";
    var html = "<section class=\"signup-week\"><h3>Ward List</h3><p class=\"signup-note\">Google Account Emails Stay With The Presidency. They Are Not Shown To The Young Women.</p><ul class=\"people\">";
    members.forEach(function (m) {
      html += "<li><div class=\"who\"><b>" + escapeHtml(m.name) + "</b><span>" + escapeHtml(m.role) + (m.classId ? " · " + escapeHtml(m.classId) : "") + " · " + escapeHtml(m.email) + "</span></div></li>";
    });
    html += "</ul><label class=\"field\">Name To Show <input id=\"su-member-name\" maxlength=\"80\"></label>" +
      "<label class=\"field\">Google Account Email <input id=\"su-member-email\" type=\"email\" autocomplete=\"off\"></label>" +
      "<label class=\"field\">Role <select id=\"su-member-role\"><option value=\"youth\">Young Woman</option><option value=\"adviser\">Adviser</option><option value=\"moderator\">Moderator</option><option value=\"parent\">Parent / Guardian</option></select></label>" +
      "<label class=\"field\">Class <select id=\"su-member-class\"><option value=\"\">None</option>" +
      "<option value=\"gatherers\">Gatherers of Light</option><option value=\"messengers\">Messengers of Hope</option><option value=\"builders\">Builders of Faith</option></select></label>" +
      "<button type=\"button\" class=\"btn mini\" data-su-action=\"add-member\">Add To Ward List</button></section>";
    return html;
  }
  function escapeHtml(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function paint(wrap, opts) {
    paint.opts = opts || {};
    if (!configured()) { wrap.innerHTML = notConnectedHtml(); return Promise.resolve(); }
    return loadClientId().then(function () {
      if (!clientId) {
        wrap.innerHTML = "<div class=\"panel-head\"><h2>Sign-Ups</h2><p>The Google Script Is Deployed, And It Still Needs Its Web Client ID.</p></div>";
        return;
      }
      if (!token()) {
        wrap.innerHTML = signInHtml();
        return loadGis().then(renderButton);
      }
      return request("view", { classFilter: opts.classFilter || "", reviewClassId: opts.reviewClassId || "" }).then(function (body) {
        if (!body || !body.ok) {
          if (body && body.error === "unauthorized") setToken("");
          wrap.innerHTML = "<div class=\"panel-head\"><h2>Sign-Ups</h2><p>" + escapeHtml(body && body.message ? body.message : "Sign-Ups Could Not Be Loaded.") + "</p></div>" +
            (body && body.error === "unauthorized" ? "<button type=\"button\" class=\"btn mini\" id=\"su-sign-out\">Sign In Again</button>" : "");
          return;
        }
        viewState = body.view;
        members = body.members || null;
        wrap.innerHTML = window.YWSignups.renderHtml(body.view) + adminHtml() +
          "<p><button type=\"button\" class=\"btn mini alt\" id=\"su-sign-out\">Sign Out</button></p>";
      });
    }).catch(function () {
      wrap.innerHTML = "<div class=\"panel-head\"><h2>Sign-Ups</h2><p>Sign-Ups Could Not Reach The Ward Script.</p></div>";
    });
  }
  function submit(action, opts) {
    opts = opts || {};
    if (action && action.op === "add-member") {
      return request("add-member", {
        name: action.name, email: action.email, role: action.role, classId: action.classId,
        classFilter: opts.classFilter || "", reviewClassId: opts.reviewClassId || ""
      });
    }
    return request("mutate", {
      action: action,
      version: viewState && viewState.version,
      classFilter: opts.classFilter || "",
      reviewClassId: opts.reviewClassId || ""
    });
  }
  function readAddMember() {
    return {
      op: "add-member",
      name: (document.getElementById("su-member-name") || {}).value || "",
      email: (document.getElementById("su-member-email") || {}).value || "",
      role: (document.getElementById("su-member-role") || {}).value || "",
      classId: (document.getElementById("su-member-class") || {}).value || ""
    };
  }
  document.addEventListener("click", function (e) {
    var out = e.target && e.target.closest && e.target.closest("#su-sign-out");
    if (!out) return;
    setToken("");
    viewState = null;
    members = null;
    var wrap = document.getElementById("main-panel");
    if (wrap) paint(wrap, paint.opts || {});
  });

  window.YWSignupClient = {
    configured: configured,
    notConnectedHtml: notConnectedHtml,
    paint: paint,
    submit: submit,
    readAddMember: readAddMember,
    token: token
  };
})();
