/* Browser client for ward sign-ups. Talks only to the private Google script.
   Does not keep the sign-up board on the phone. */
(function () {
  "use strict";
  var TOKEN_KEY = "fb6-yw-signups-link";
  var viewState = null;
  var members = null;
  var linkRows = null;
  var shownLink = "";

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
  function askHtml() {
    return "<div class=\"panel-head\"><h2>Sign-Ups</h2><p>Open The Private Link A Leader Gave You.</p></div>" +
      "<div class=\"callout\"><b>A Private Link Is The Access</b>" +
      "<p>Anyone holding the link can use what it allows. It does not prove who is holding it. Keep it private. A leader can turn it off. There is no account to create.</p></div>" +
      "<label class=\"field\">Paste A Private Link <input id=\"su-paste-link\" autocomplete=\"off\" spellcheck=\"false\"></label>" +
      "<button type=\"button\" class=\"btn mini\" data-su-action=\"use-link\">Use Private Link</button>";
  }
  function captureLink() {
    var hash = "";
    try { hash = location.hash || ""; } catch (e) {}
    var match = String(hash).match(/su=([A-Za-z0-9_-]{20,})/);
    if (!match) return;
    setToken(match[1]);
    try { history.replaceState(null, "", location.pathname + location.search + "#signups"); } catch (e2) {}
  }
  captureLink();
  function request(op, extra) {
    var payload = { op: op, linkToken: token() };
    if (extra) Object.keys(extra).forEach(function (key) { payload[key] = extra[key]; });
    return fetch(scriptUrl(), {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).then(function (res) { return res.json(); });
  }
  function loadReady() {
    return fetch(scriptUrl(), { method: "GET", redirect: "follow" }).then(function (res) { return res.json(); }).then(function (body) {
      if (!body || !body.ok || body.service !== "yw-signups" || body.auth !== "link") {
        var err = new Error("version");
        err.code = "version";
        throw err;
      }
    });
  }
  function adminHtml() {
    if (!members) return "";
    var html = "<section class=\"signup-week\"><h3>Ward List</h3><p class=\"signup-note\">Names And Roles Only. Private Links Are Not Listed Here.</p><ul class=\"people\">";
    members.forEach(function (m) {
      var held = m.status === "pending";
      html += "<li><div class=\"who\"><b>" + escapeHtml(m.name) + "</b><span>" + escapeHtml(m.role) +
        (m.classId ? " · " + escapeHtml(m.classId) : "") + " · " + escapeHtml(m.status || "active") +
        "</span></div>";
      if (m.role === "youth") {
        html += "<button type=\"button\" class=\"btn mini" + (held ? "" : " alt") + "\" data-su-member=\"" + escapeHtml(m.id) +
          "\" data-su-status=\"" + (held ? "active" : "pending") + "\">" + (held ? "Allow Sign-Ups" : "Hold Sign-Ups") + "</button>";
      }
      html += "<button type=\"button\" class=\"btn mini alt\" data-su-action=\"create-link\" data-member=\"" + escapeHtml(m.id) + "\">Make Private Link</button></li>";
    });
    html += "</ul>";
    (linkRows || []).forEach(function (link) {
      if (link.status !== "active") return;
      html += "<p><button type=\"button\" class=\"btn mini alt\" data-su-action=\"revoke-link\" data-link=\"" + escapeHtml(link.id) + "\">Turn Off Link</button></p>";
    });
    html += "<p class=\"signup-note\">Add a person by the name to show. A private link is the only access. Pending cannot claim a spot until you allow it. No account is created.</p>" +
      "<label class=\"field\">Name To Show <input id=\"su-member-name\" maxlength=\"80\"></label>" +
      "<label class=\"field\">Role <select id=\"su-member-role\"><option value=\"youth\">Young Woman</option><option value=\"adviser\">Adviser</option><option value=\"moderator\">Moderator</option><option value=\"parent\">Parent / Guardian</option></select></label>" +
      "<label class=\"field\">Class <select id=\"su-member-class\"><option value=\"\">None</option>" +
      "<option value=\"gatherers\">Gatherers of Light</option><option value=\"messengers\">Messengers of Hope</option><option value=\"builders\">Builders of Faith</option></select></label>" +
      "<label class=\"field\">Sign-Up Access <select id=\"su-member-status\"><option value=\"pending\">Pending Until A Leader Allows</option><option value=\"active\">Active</option></select></label>" +
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
    return loadReady().then(function () {
      if (!token()) {
        wrap.innerHTML = askHtml();
        return;
      }
      return request("view", { classFilter: opts.classFilter || "", reviewClassId: opts.reviewClassId || "" }).then(function (body) {
        if (!body || !body.ok) {
          if (body && body.error === "unauthorized") setToken("");
          var extra = body && body.error === "not-member"
            ? "<p class=\"signup-note\">The public class list does not grant Sign-Ups. A leader must give you a private link.</p>" : "";
          wrap.innerHTML = "<div class=\"panel-head\"><h2>Sign-Ups</h2><p>" + escapeHtml(body && body.message ? body.message : "Sign-Ups Could Not Be Loaded.") + "</p>" + extra + "</div>" +
            "<button type=\"button\" class=\"btn mini\" id=\"su-sign-out\">Use A Different Private Link</button>";
          return;
        }
        viewState = body.view;
        members = body.members || null;
        linkRows = body.links || null;
        if (body.privateLink) shownLink = body.privateLink;
        if (window.YWChatChrome) window.YWChatChrome.refresh();
        var once = shownLink ? "<div class=\"callout\"><b>Copy This Private Link Now</b><p>It will not be shown again. Anyone who has it can use that access. It does not prove who they are.</p><input class=\"field\" readonly value=\"" + escapeHtml(shownLink) + "\"></div>" : "";
        wrap.innerHTML = once + identityHtml() + window.YWSignups.renderHtml(body.view) + adminHtml() +
          "<p><button type=\"button\" class=\"btn mini alt\" id=\"su-sign-out\">Sign Out</button></p>";
      });
    }).catch(function (err) {
      var oldScript = err && err.code === "version";
      wrap.innerHTML = "<div class=\"panel-head\"><h2>Sign-Ups</h2><p>" +
        (oldScript ? "Sign-Ups Need The Private-Link Script Update Before This Page Can Open Them." : "Sign-Ups Could Not Reach The Ward Script.") +
        "</p></div>";
    });
  }
  function submit(action, opts) {
    opts = opts || {};
    if (action && action.op === "local-link") return Promise.resolve({ ok: true, message: "Private Link Saved On This Phone For This Visit." });
    if (action && (action.op === "add-member" || action.op === "update-member" || action.op === "create-link" || action.op === "revoke-link")) {
      var fields = {
        classFilter: opts.classFilter || "",
        reviewClassId: opts.reviewClassId || ""
      };
      ["name", "role", "classId", "status", "memberId", "linkId"].forEach(function (key) {
        if (action[key]) fields[key] = action[key];
      });
      return request(action.op, fields);
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
      classId: (document.getElementById("su-member-class") || {}).value || "",
      status: (document.getElementById("su-member-status") || {}).value || "pending"
    };
  }
  function readUseLink() {
    var raw = (document.getElementById("su-paste-link") || {}).value || "";
    var match = String(raw).match(/su=([A-Za-z0-9_-]{20,})/);
    var token = match ? match[1] : String(raw).replace(/\s/g, "");
    if (token.length < 20) return { invalid: true, message: "That Private Link Does Not Look Complete." };
    setToken(token);
    return { op: "local-link" };
  }
  function readMemberStatus(el) {
    return {
      op: "update-member",
      memberId: el.getAttribute("data-su-member"),
      status: el.getAttribute("data-su-status")
    };
  }
  document.addEventListener("click", function (e) {
    var out = e.target && e.target.closest && e.target.closest("#su-sign-out");
    if (!out) return;
    setToken("");
    viewState = null;
    members = null;
    if (window.YWChatChrome) window.YWChatChrome.refresh();
    var wrap = document.getElementById("main-panel");
    if (wrap) paint(wrap, paint.opts || {});
  });

  function identityHtml() {
    var who = signedInActor();
    if (!who) return "";
    return "<p class=\"signup-note\"><strong>" + escapeHtml(who.name) + "</strong> · " + escapeHtml(who.role) + ". Shared Sign-Ups. The Chat demo persona does not change this.</p>";
  }
  function signedInActor() {
    var actor = viewState && viewState.allowed && viewState.actor;
    if (!actor || !token()) return null;
    var role = actor.presidency ? "Moderator" : (actor.leader ? "Adviser" : (actor.classId ? "Young Woman" : "Parent / Guardian"));
    return { name: actor.name, role: role };
  }
  window.YWSignupClient = {
    configured: configured,
    notConnectedHtml: notConnectedHtml,
    paint: paint,
    submit: submit,
    readAddMember: readAddMember,
    readUseLink: readUseLink,
    readMemberStatus: readMemberStatus,
    signedInActor: signedInActor,
    token: token
  };
})();
