/* Bay 6 Hub · Young Women Chat MVP
   DEMO mode: localStorage mock backend. Live modes: wire via config.js (Firebase / Supabase).
   Safety-first: invite-only, parent approval, youth opt-in, two-deep adults, no youth DMs. */
(function () {
  "use strict";

  var CFG = window.YW_CHAT_CONFIG || { mode: "demo", channels: [], safety: {}, demoStorageKey: "bay6-yw-chat-v3" };
  var SEED = window.YW_CHAT_DEMO_SEED || { users: [], messages: [], reports: [], invites: [], presence: {} };

  var state = {
    mode: CFG.mode || "demo",
    channelId: "main",
    currentUserId: null,
    panel: "chat", /* chat | members | join | mod */
    data: null,
    toast: null
  };

  /* ---------- storage / backend adapter ---------- */
  function isDemo() { return state.mode === "demo" || !liveConfigured(); }

  function liveConfigured() {
    if (CFG.mode === "firebase") {
      var f = CFG.firebase || {};
      return f.apiKey && f.apiKey.indexOf("YOUR_") !== 0;
    }
    if (CFG.mode === "supabase") {
      var s = CFG.supabase || {};
      return s.url && s.url.indexOf("YOUR_") === -1 && s.anonKey && s.anonKey.indexOf("YOUR_") !== 0;
    }
    return false;
  }

  function loadDemo() {
    var key = CFG.demoStorageKey || "bay6-yw-chat-v3";
    try {
      var raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    var fresh = {
      users: clone(SEED.users),
      messages: clone(SEED.messages),
      reports: clone(SEED.reports),
      invites: clone(SEED.invites),
      presence: clone(SEED.presence),
      sessionUserId: "u-presley"
    };
    saveDemo(fresh);
    return fresh;
  }

  function saveDemo(data) {
    try { localStorage.setItem(CFG.demoStorageKey || "bay6-yw-chat-v3", JSON.stringify(data)); }
    catch (e) { /* quota */ }
  }

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function persist() {
    if (isDemo()) saveDemo(state.data);
    /* Live backends: enqueue writes here once wired. */
  }

  function initData() {
    if (isDemo()) {
      state.data = loadDemo();
      state.mode = "demo";
      state.currentUserId = state.data.sessionUserId || "u-presley";
    } else {
      /* Live: placeholders only — fall back to demo until SDK wired. */
      toast("Live backend placeholders are set, but SDKs are not wired yet. Running DEMO.");
      state.mode = "demo";
      state.data = loadDemo();
      state.currentUserId = state.data.sessionUserId || "u-presley";
    }
  }

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function userById(id) {
    return (state.data.users || []).find(function (u) { return u.id === id; }) || null;
  }
  function currentUser() { return userById(state.currentUserId); }
  function isMod(u) { return u && (u.role === "moderator"); }
  function isAdult(u) { return u && u.kind === "adult"; }
  function channelById(id) {
    return (CFG.channels || []).find(function (c) { return c.id === id; }) || { id: id, name: id, blurb: "" };
  }
  function adultsPresent(channelId) {
    var ids = (state.data.presence && state.data.presence[channelId]) || [];
    return ids.map(userById).filter(function (u) { return u && isAdult(u) && u.status === "active" && !u.removed; });
  }
  function twoDeepOk(channelId) {
    var need = (CFG.safety && CFG.safety.minAdultsPresent) || 2;
    return adultsPresent(channelId).length >= need;
  }
  function canPost(u, channelId) {
    if (!u || u.status !== "active") return false;
    if (u.muted || u.status === "muted") return false;
    if (u.kind === "youth" && u.classId && channelId !== "main" && u.classId !== channelId) return false;
    if (!twoDeepOk(channelId) && u.kind === "youth") return false;
    return true;
  }
  function isLeadershipAdult(u) {
    return !!(u && (isMod(u) || u.role === "adviser" || u.role === "parent" || isAdult(u)));
  }
  /* Adults / presidency see every channel. Youth see Main + their own class messages. */
  function canViewChannel(u, channelId) {
    if (!u) return false;
    if (isLeadershipAdult(u)) return true;
    if (u.status === "active" || u.status === "muted") {
      if (channelId === "main") return true;
      return u.classId === channelId;
    }
    return false;
  }
  /* Every signed-in demo role can OPEN any channel; out-of-class youth get a friendly notice. */
  function canOpenChannel(u) {
    return !!u;
  }
  function classChannelNotice(channelId) {
    var ch = channelById(channelId);
    var label = (ch && ch.name) ? ch.name : "This";
    return "This Channel Is For The " + label + " Class";
  }
  function fmtTime(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch (e) { return ""; }
  }
  function fmtBubbleTime(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
    } catch (e) { return ""; }
  }
  function fmtDaySep(iso) {
    try {
      var d = new Date(iso);
      var now = new Date();
      var sameDay = d.toDateString() === now.toDateString();
      var yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
      if (sameDay) return "Today · " + d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
      if (d.toDateString() === yesterday.toDateString()) {
        return "Yesterday · " + d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
      }
      return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    } catch (e) { return ""; }
  }
  function sameDay(a, b) {
    try { return new Date(a).toDateString() === new Date(b).toDateString(); } catch (e) { return false; }
  }
  function minsApart(a, b) {
    try { return Math.abs(new Date(a) - new Date(b)) / 60000; } catch (e) { return 999; }
  }
  function initials(name) {
    var parts = String(name || "?").trim().split(/\s+/);
    var a = (parts[0] && parts[0][0]) || "?";
    var b = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (a + b).toUpperCase();
  }

  /* Soft, Church-appropriate neutrals — distinguishable by name tint + left accent, not loud bubbles. */
  var PERSON_PALETTE = [
    { bg: "#eef2f5", accent: "#5a6f7e", name: "#3d4f5c", bgDark: "#2c3338", nameDark: "#c5d0d8" }, /* slate */
    { bg: "#eef1f6", accent: "#5c6b85", name: "#3f4d63", bgDark: "#2b3038", nameDark: "#c4cbd6" }, /* gray-blue */
    { bg: "#eef3f2", accent: "#5a736c", name: "#3d524c", bgDark: "#2b3331", nameDark: "#c3d0cc" }, /* sage */
    { bg: "#f3f1ee", accent: "#7a6f5f", name: "#564c40", bgDark: "#322e2a", nameDark: "#d0c6ba" }, /* sand */
    { bg: "#eef3f6", accent: "#4f6d7a", name: "#385460", bgDark: "#2a3236", nameDark: "#bfd0d8" }, /* muted navy */
    { bg: "#f1f2f0", accent: "#6a7168", name: "#4a5248", bgDark: "#2e302e", nameDark: "#c8cdc6" }, /* warm gray */
    { bg: "#f0f2f5", accent: "#667788", name: "#455463", bgDark: "#2c3034", nameDark: "#c6ced6" }, /* cool gray */
    { bg: "#f2f0ee", accent: "#75685c", name: "#524840", bgDark: "#312e2b", nameDark: "#d0c7be" }, /* taupe */
    { bg: "#eef4f3", accent: "#5a7570", name: "#3e544f", bgDark: "#2b3332", nameDark: "#c2d1cd" }, /* soft teal-gray */
    { bg: "#f1f0ef", accent: "#6e6862", name: "#4c4742", bgDark: "#2f2d2b", nameDark: "#cbc6c1" }  /* stone */
  ];
  function personPalette(id) {
    var s = String(id || "unknown");
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return PERSON_PALETTE[(h >>> 0) % PERSON_PALETTE.length];
  }
  function personStyleAttr(id) {
    var p = personPalette(id);
    return "style=\"--person-bg:" + p.bg + ";--person-accent:" + p.accent + ";--person-name:" + p.name +
      ";--person-bg-dark:" + p.bgDark + ";--person-name-dark:" + p.nameDark + "\"";
  }

  var GROUP_MINUTES = 5;
  function uid(prefix) { return prefix + "-" + Math.random().toString(36).slice(2, 9); }
  function toast(msg) {
    state.toast = msg;
    var el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, 3200);
  }
  function titleCaseStatus(s) {
    var map = {
      active: "Active",
      invited: "Invited",
      pending_parent: "Awaiting Parent Approval",
      pending_youth: "Awaiting Youth Opt-In",
      muted: "Muted",
      removed: "Removed"
    };
    return map[s] || s;
  }

  /* ---------- actions ---------- */
  function switchUser(id) {
    if (!userById(id)) return;
    state.currentUserId = id;
    state.data.sessionUserId = id;
    persist();
    render();
  }

  function setChannel(id) {
    if (!canOpenChannel(currentUser())) {
      toast("Sign In To Open A Channel.");
      return;
    }
    state.channelId = id;
    state.panel = "chat";
    render();
  }

  function setPanel(p) {
    state.panel = p;
    render();
  }

  function sendMessage(text) {
    var u = currentUser();
    var ch = state.channelId;
    text = (text || "").trim();
    if (!text) return;
    if (!canPost(u, ch)) {
      toast("You Cannot Post Right Now (Check Status Or Two-Deep Adults).");
      return;
    }
    if (text.length > 1000) { toast("Message Is Too Long."); return; }
    state.data.messages.push({
      id: uid("m"),
      channelId: ch,
      authorId: u.id,
      text: text,
      createdAt: new Date().toISOString(),
      removed: false
    });
    persist();
    render();
    var list = $("msg-list");
    if (list) list.scrollTop = list.scrollHeight;
  }

  function reportMessage(messageId, reason) {
    var u = currentUser();
    if (!u) return;
    reason = (reason || "").trim() || "Flagged For Review";
    state.data.reports.push({
      id: uid("r"),
      messageId: messageId,
      reporterId: u.id,
      reason: reason,
      createdAt: new Date().toISOString(),
      status: "open"
    });
    persist();
    toast("Report Sent To Moderators. Thank You.");
    render();
  }

  function removeMessage(messageId) {
    var u = currentUser();
    if (!isMod(u)) { toast("Only Moderators Can Remove Messages."); return; }
    var m = state.data.messages.find(function (x) { return x.id === messageId; });
    if (!m) return;
    m.removed = true;
    m.removedBy = u.id;
    m.removedAt = new Date().toISOString();
    persist();
    toast("Message Removed.");
    render();
  }

  function setMemberStatus(userId, status) {
    var u = currentUser();
    if (!isMod(u) && !(u && u.role === "parent" && status === "pending_youth")) {
      /* parents approve their child only via approveChild */
      toast("Not Allowed.");
      return;
    }
    var target = userById(userId);
    if (!target) return;
    target.status = status;
    if (status === "muted") target.muted = true;
    if (status === "active") target.muted = false;
    if (status === "removed") target.removed = true;
    persist();
    toast("Member Updated: " + titleCaseStatus(status));
    render();
  }

  function approveChild(childId) {
    var u = currentUser();
    var child = userById(childId);
    if (!u || u.role !== "parent") { toast("Sign In As A Parent To Approve."); return; }
    if (!child || child.parentId !== u.id) { toast("That Youth Is Not Linked To You."); return; }
    if (child.status !== "pending_parent" && child.status !== "invited") {
      toast("No Parent Approval Needed Right Now.");
      return;
    }
    child.status = "pending_youth";
    persist();
    toast("Parent Approval Recorded. Youth Must Opt In Next.");
    render();
  }

  function youthOptIn() {
    var u = currentUser();
    if (!u || u.kind !== "youth") { toast("Switch To A Youth Account To Opt In."); return; }
    if (u.status !== "pending_youth") { toast("You Are Not Waiting To Opt In."); return; }
    u.status = "active";
    persist();
    toast("You Joined Young Women Chat. Welcome!");
    render();
  }

  function inviteFromWardList(userId) {
    var u = currentUser();
    if (!isMod(u)) { toast("Only Moderators Can Invite."); return; }
    var target = userById(userId);
    if (!target || target.kind !== "youth") return;
    if (target.status === "active") { toast("Already Active."); return; }
    target.status = target.parentId ? "pending_parent" : "pending_youth";
    state.data.invites.push({
      id: uid("inv"),
      userId: target.id,
      invitedBy: u.id,
      createdAt: new Date().toISOString()
    });
    persist();
    toast("Invite Sent (Parent Approval Required When Linked).");
    render();
  }

  function resolveReport(reportId, resolution) {
    var u = currentUser();
    if (!isMod(u)) return;
    var r = state.data.reports.find(function (x) { return x.id === reportId; });
    if (!r) return;
    r.status = resolution || "resolved";
    r.resolvedBy = u.id;
    r.resolvedAt = new Date().toISOString();
    persist();
    toast("Report Marked " + (resolution === "dismissed" ? "Dismissed" : "Resolved") + ".");
    render();
  }

  function resetDemo() {
    if (!isDemo()) return;
    try { localStorage.removeItem(CFG.demoStorageKey || "bay6-yw-chat-v3"); } catch (e) {}
    state.data = loadDemo();
    state.currentUserId = state.data.sessionUserId;
    toast("Demo Data Reset.");
    render();
  }

  function toggleAdultPresence(adultId) {
    var u = currentUser();
    if (!isMod(u) && u.id !== adultId) { toast("Moderators Manage Presence In Demo."); return; }
    var ch = state.channelId;
    if (!state.data.presence[ch]) state.data.presence[ch] = [];
    var list = state.data.presence[ch];
    var i = list.indexOf(adultId);
    if (i >= 0) list.splice(i, 1);
    else list.push(adultId);
    persist();
    render();
  }

  /* ---------- render ---------- */
  function render() {
    renderChrome();
    renderChannels();
    renderMain();
    renderComposer();
  }

  function renderChrome() {
    var u = currentUser();
    var demoBanner = $("demo-banner");
    if (demoBanner) {
      demoBanner.hidden = !isDemo();
    }
    var who = $("who-ami");
    if (who && u) {
      who.innerHTML = "<strong>" + esc(u.name) + "</strong> · " + esc(roleLabel(u)) +
        " · <span class=\"pill\">" + esc(titleCaseStatus(u.status)) + "</span>";
    }
    var sel = $("role-switch");
    if (sel) {
      var opts = state.data.users.filter(function (x) { return !x.removed; }).map(function (x) {
        return "<option value=\"" + esc(x.id) + "\"" + (x.id === state.currentUserId ? " selected" : "") + ">" +
          esc(x.name) + " (" + esc(roleLabel(x)) + ")</option>";
      }).join("");
      sel.innerHTML = opts;
    }
    document.querySelectorAll("[data-panel]").forEach(function (btn) {
      btn.classList.toggle("on", btn.getAttribute("data-panel") === state.panel);
    });
    var modTab = $("tab-mod");
    if (modTab) modTab.hidden = !isMod(u);
  }

  function roleLabel(u) {
    if (!u) return "";
    if (u.role === "moderator") return "Moderator";
    if (u.role === "adviser") return "Adviser";
    if (u.role === "parent") return "Parent / Guardian";
    if (u.role === "youth") return "Young Woman";
    return u.role;
  }

  function renderChannels() {
    var u = currentUser();
    var nav = $("channel-nav");
    if (!nav) return;
    nav.innerHTML = (CFG.channels || []).map(function (c) {
      var memberView = canViewChannel(u, c.id);
      var deep = twoDeepOk(c.id);
      var adults = adultsPresent(c.id).length;
      var cls = "chan" + (c.id === state.channelId ? " on" : "") + (!memberView ? " dim" : "");
      /* Never disable — tapping always opens the channel (friendly notice if out of class). */
      return "<button type=\"button\" class=\"" + cls + "\" data-channel=\"" + esc(c.id) + "\">" +
        "<b>" + esc(c.name) + "</b><small>" + esc(c.blurb) + "</small>" +
        "<span class=\"deep " + (deep ? "ok" : "warn") + "\">" + adults + " Adults</span></button>";
    }).join("");
  }

  function renderMain() {
    if (state.panel === "members") return renderMembers();
    if (state.panel === "join") return renderJoin();
    if (state.panel === "mod") return renderMod();
    return renderChat();
  }

  function renderChat() {
    var wrap = $("main-panel");
    if (!wrap) return;
    var u = currentUser();
    var ch = channelById(state.channelId);
    var deep = twoDeepOk(state.channelId);
    var adults = adultsPresent(state.channelId);

    var msgs = state.data.messages
      .filter(function (m) { return m.channelId === state.channelId; })
      .sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });

    var warn = deep ? "" :
      "<div class=\"callout warn\"><b>Two-Deep Adult Presence Needed</b><p>Youth posting is paused until at least two adults are present in this channel.</p></div>";

    var html = "<div class=\"panel-head\"><h2>" + esc(ch.name) + "</h2><p>" + esc(ch.blurb) +
      " · Supervised by " + adults.map(function (a) { return esc(a.name); }).join(", ") +
      (adults.length ? "" : "nobody yet") + "</p></div>" + warn +
      "<div class=\"msg-list\" id=\"msg-list\" role=\"log\" aria-live=\"polite\">";

    if (!canViewChannel(u, state.channelId)) {
      if (u && u.kind === "youth" && state.channelId !== "main") {
        html += "<div class=\"callout\"><b>" + esc(classChannelNotice(state.channelId)) +
          "</b><p>Only " + esc(ch.name) + " class members and adult leaders can read and post here. " +
          "Switch to Main, or pick your own class channel.</p></div>";
      } else {
        html += "<p class=\"empty\">You Do Not Have Access To This Channel Yet. Finish Join Steps First.</p>";
      }
    } else if (!msgs.length) {
      html += "<p class=\"empty\">No Messages Yet. Say Hello!</p>";
    } else {
      msgs.forEach(function (m, i) {
        var prev = i > 0 ? msgs[i - 1] : null;
        var next = i < msgs.length - 1 ? msgs[i + 1] : null;
        var author = userById(m.authorId) || { name: "Unknown", role: "", id: m.authorId };
        var mine = u && m.authorId === u.id;

        if (!prev || !sameDay(prev.createdAt, m.createdAt) || minsApart(prev.createdAt, m.createdAt) > 60) {
          html += "<div class=\"day-sep\" role=\"separator\"><span>" + esc(fmtDaySep(m.createdAt)) + "</span></div>";
        }

        if (m.removed) {
          html += "<article class=\"msg-row removed group-start group-end\"><div class=\"bubble\">" +
            "<p class=\"body dim\">Message Removed</p>" +
            "<time class=\"mtime\">" + esc(fmtBubbleTime(m.createdAt)) + "</time></div></article>";
          return;
        }

        var groupWithPrev = prev && !prev.removed && prev.authorId === m.authorId &&
          minsApart(prev.createdAt, m.createdAt) <= GROUP_MINUTES && sameDay(prev.createdAt, m.createdAt);
        var groupWithNext = next && !next.removed && next.authorId === m.authorId &&
          minsApart(m.createdAt, next.createdAt) <= GROUP_MINUTES && sameDay(m.createdAt, next.createdAt);
        var groupCls = groupWithPrev ? "group-cont" : "group-start";
        if (!groupWithNext) groupCls += " group-end";

        var colorAttr = mine ? "" : (" " + personStyleAttr(author.id || m.authorId));
        html += "<article class=\"msg-row msg-hit " + (mine ? "mine" : "theirs") + " " + groupCls +
          "\" data-mid=\"" + esc(m.id) + "\"" + colorAttr + " tabindex=\"0\" aria-label=\"Message from " + esc(author.name) + "\">";
        if (!groupWithPrev) {
          html += "<div class=\"sender\"><span class=\"avatar\" aria-hidden=\"true\">" + esc(initials(author.name)) +
            "</span><b>" + esc(author.name) + "</b><span class=\"role\">" + esc(roleLabel(author)) + "</span></div>";
        }
        html += "<div class=\"bubble\"><p class=\"body\">" + esc(m.text) + "</p>" +
          "<time class=\"mtime\">" + esc(fmtBubbleTime(m.createdAt)) + "</time></div>" +
          "<div class=\"msg-acts\">" +
          "<button type=\"button\" class=\"linkish\" data-report=\"" + esc(m.id) + "\">Report</button>" +
          (isMod(u) ? "<button type=\"button\" class=\"linkish danger\" data-remove=\"" + esc(m.id) + "\">Remove Message</button>" : "") +
          "</div></article>";
      });
    }
    html += "</div>";
    wrap.innerHTML = html;
    requestAnimationFrame(function () {
      var list = $("msg-list");
      var panel = $("main-panel");
      if (panel) panel.scrollTop = panel.scrollHeight;
      if (list) list.scrollTop = list.scrollHeight;
    });
  }

  function renderMembers() {
    var wrap = $("main-panel");
    if (!wrap) return;
    var u = currentUser();
    var rows = state.data.users.filter(function (x) { return x.kind === "youth" || x.role === "moderator" || x.role === "adviser"; });
    var html = "<div class=\"panel-head\"><h2>Members</h2><p>Invite-only ward list. No public discovery.</p></div><ul class=\"people\">";
    rows.forEach(function (p) {
      html += "<li><div class=\"who\"><b>" + esc(p.name) + "</b><span>" + esc(roleLabel(p)) +
        (p.classId ? " · " + esc(channelById(p.classId).name) : "") +
        "</span></div><span class=\"pill\">" + esc(titleCaseStatus(p.status)) + "</span>";
      if (isMod(u) && p.kind === "youth") {
        html += "<div class=\"row-acts\">";
        if (p.status === "invited" || p.status === "pending_parent" || p.status === "pending_youth") {
          html += "<button type=\"button\" class=\"btn mini\" data-status=\"" + esc(p.id) + ":active\">Approve Member</button>";
        }
        if (p.status === "active") {
          html += "<button type=\"button\" class=\"btn mini alt\" data-status=\"" + esc(p.id) + ":muted\">Mute</button>";
        }
        if (p.status === "muted") {
          html += "<button type=\"button\" class=\"btn mini\" data-status=\"" + esc(p.id) + ":active\">Unmute</button>";
        }
        if (p.status !== "removed") {
          html += "<button type=\"button\" class=\"btn mini danger\" data-status=\"" + esc(p.id) + ":removed\">Remove User</button>";
        }
        if (p.status === "removed" || !p.status || p.status === "invited") {
          /* invite again from ward list handled in Join */
        }
        html += "</div>";
      }
      html += "</li>";
    });
    html += "</ul>";
    wrap.innerHTML = html;
  }

  function renderJoin() {
    var wrap = $("main-panel");
    if (!wrap) return;
    var u = currentUser();
    var steps = [
      "<li class=\"done\"><b>1. Invite-Only Ward List</b><p>Only Young Women on the Bay 6 list can be invited. No public join link.</p></li>",
      "<li class=\"" + (u && (u.status !== "invited" || u.kind !== "youth") ? "done" : "now") + "\"><b>2. Parent Or Guardian Approval</b><p>A linked parent or guardian must approve before a youth can join.</p></li>",
      "<li class=\"" + (u && u.status === "active" ? "done" : (u && u.status === "pending_youth" ? "now" : "")) + "\"><b>3. Youth Opt-In</b><p>The Young Woman chooses to join after parent approval.</p></li>",
      "<li class=\"done\"><b>4. Two-Deep Adults</b><p>At least two adults present on every channel before youth can post.</p></li>"
    ].join("");

    var actions = "";
    if (u && u.role === "parent") {
      var kids = state.data.users.filter(function (x) { return x.parentId === u.id; });
      actions += "<div class=\"cardish\"><h3>Parent / Guardian Actions</h3>";
      if (!kids.length) actions += "<p class=\"note\">No linked youth in this demo account.</p>";
      kids.forEach(function (k) {
        actions += "<p><b>" + esc(k.name) + "</b> — " + esc(titleCaseStatus(k.status)) + "</p>";
        if (k.status === "pending_parent" || k.status === "invited") {
          actions += "<button type=\"button\" class=\"btn\" data-approve-child=\"" + esc(k.id) + "\">Approve " + esc(k.name) + "</button>";
        }
      });
      actions += "</div>";
    }
    if (u && u.kind === "youth" && u.status === "pending_youth") {
      actions += "<div class=\"cardish\"><h3>Your Opt-In</h3><p class=\"note\">Your parent approved. Tap below if you want to join Young Women Chat.</p>" +
        "<button type=\"button\" class=\"btn\" id=\"btn-opt-in\">I Want To Join</button></div>";
    }
    if (u && u.kind === "youth" && u.status === "pending_parent") {
      actions += "<div class=\"cardish\"><h3>Waiting On Parent</h3><p class=\"note\">Ask your parent or guardian to open this page (switch to Parent of Emma in Demo) and approve you.</p></div>";
    }
    if (isMod(u)) {
      var ward = state.data.users.filter(function (x) { return x.kind === "youth" && (x.status === "invited" || !x.status); });
      actions += "<div class=\"cardish\"><h3>Moderator: Invite From Ward List</h3><ul class=\"people\">";
      state.data.users.filter(function (x) { return x.kind === "youth"; }).forEach(function (y) {
        actions += "<li><div class=\"who\"><b>" + esc(y.name) + "</b><span>" + esc(titleCaseStatus(y.status)) + "</span></div>";
        if (y.status === "invited" || y.status === "removed") {
          actions += "<button type=\"button\" class=\"btn mini\" data-invite=\"" + esc(y.id) + "\">Send Invite</button>";
        }
        actions += "</li>";
      });
      actions += "</ul></div>";
    }

    wrap.innerHTML = "<div class=\"panel-head\"><h2>How To Join</h2><p>Kids’ safety comes first. GroupMe is replaced by this invite-only space.</p></div>" +
      "<ol class=\"steps\">" + steps + "</ol>" + actions +
      "<div class=\"cardish soft\"><h3>What We Never Do</h3><ul class=\"bullets\">" +
      "<li>No Ads</li><li>No Public Discovery</li><li>No Youth-To-Youth Direct Messages</li>" +
      "<li>No Secret Channels Outside Moderation</li></ul></div>";
  }

  function renderMod() {
    var wrap = $("main-panel");
    var u = currentUser();
    if (!wrap) return;
    if (!isMod(u)) {
      wrap.innerHTML = "<p class=\"empty\">Moderators Only.</p>";
      return;
    }
    var openReports = state.data.reports.filter(function (r) { return r.status === "open"; });
    var pending = state.data.users.filter(function (x) {
      return x.kind === "youth" && (x.status === "pending_parent" || x.status === "pending_youth" || x.status === "invited");
    });

    var html = "<div class=\"panel-head\"><h2>Moderator Tools</h2><p>YW Presidency can approve members, remove messages, mute or remove users, and review reports.</p></div>";

    html += "<div class=\"cardish\"><h3>Open Reports (" + openReports.length + ")</h3>";
    if (!openReports.length) html += "<p class=\"note\">No Open Reports.</p>";
    else {
      html += "<ul class=\"people\">";
      openReports.forEach(function (r) {
        var m = state.data.messages.find(function (x) { return x.id === r.messageId; });
        var reporter = userById(r.reporterId);
        html += "<li><div class=\"who\"><b>Report</b><span>By " + esc(reporter ? reporter.name : "?") +
          " · " + esc(fmtTime(r.createdAt)) + "</span><span class=\"snip\">" + esc(r.reason) + "</span>" +
          (m ? "<span class=\"snip\">Message: “" + esc(m.text.slice(0, 120)) + "”</span>" : "") +
          "</div><div class=\"row-acts\">" +
          (m && !m.removed ? "<button type=\"button\" class=\"btn mini danger\" data-remove=\"" + esc(m.id) + "\">Remove Message</button>" : "") +
          "<button type=\"button\" class=\"btn mini\" data-resolve=\"" + esc(r.id) + ":resolved\">Resolve</button>" +
          "<button type=\"button\" class=\"btn mini alt\" data-resolve=\"" + esc(r.id) + ":dismissed\">Dismiss</button>" +
          "</div></li>";
      });
      html += "</ul>";
    }
    html += "</div>";

    html += "<div class=\"cardish\"><h3>Pending Members (" + pending.length + ")</h3><ul class=\"people\">";
    pending.forEach(function (p) {
      html += "<li><div class=\"who\"><b>" + esc(p.name) + "</b><span>" + esc(titleCaseStatus(p.status)) + "</span></div>" +
        "<button type=\"button\" class=\"btn mini\" data-status=\"" + esc(p.id) + ":active\">Approve Member</button></li>";
    });
    if (!pending.length) html += "<li><span class=\"note\">None Waiting.</span></li>";
    html += "</ul></div>";

    html += "<div class=\"cardish\"><h3>Two-Deep Presence · " + esc(channelById(state.channelId).name) + "</h3>" +
      "<p class=\"note\">Toggle which adults are marked present on the current channel (demo only).</p><ul class=\"people\">";
    state.data.users.filter(function (x) { return isAdult(x) && x.status === "active"; }).forEach(function (a) {
      var on = ((state.data.presence[state.channelId] || []).indexOf(a.id) >= 0);
      html += "<li><div class=\"who\"><b>" + esc(a.name) + "</b><span>" + esc(roleLabel(a)) + "</span></div>" +
        "<button type=\"button\" class=\"btn mini " + (on ? "" : "alt") + "\" data-presence=\"" + esc(a.id) + "\">" +
        (on ? "Present" : "Mark Present") + "</button></li>";
    });
    html += "</ul></div>";

    html += "<div class=\"cardish soft\"><h3>Demo Tools</h3>" +
      "<button type=\"button\" class=\"btn alt\" id=\"btn-reset-demo\">Reset Demo Data</button></div>";

    wrap.innerHTML = html;
  }

  function renderComposer() {
    var box = $("composer");
    if (!box) return;
    var show = state.panel === "chat";
    box.hidden = !show;
    if (!show) return;
    var u = currentUser();
    var ok = canPost(u, state.channelId);
    var input = $("msg-input");
    var send = $("msg-send");
    if (input) {
      input.disabled = !ok;
      input.placeholder = ok ? "Write A Kind Message…" : "Posting Paused";
    }
    if (send) send.disabled = !ok;
  }

  /* ---------- events ---------- */
  function onClick(e) {
    var actBtn = e.target.closest("[data-report],[data-remove]");
    var row = e.target.closest(".msg-row.msg-hit");
    if (row && !actBtn) {
      var was = row.classList.contains("show-acts");
      document.querySelectorAll(".msg-row.show-acts").forEach(function (el) { el.classList.remove("show-acts"); });
      if (!was) row.classList.add("show-acts");
      return;
    }

    var t = e.target.closest("[data-channel],[data-panel],[data-report],[data-remove],[data-status],[data-approve-child],[data-invite],[data-resolve],[data-presence],#btn-opt-in,#btn-reset-demo,#msg-send");
    if (!t) return;

    if (t.id === "msg-send") {
      e.preventDefault();
      sendMessage(($("msg-input") && $("msg-input").value) || "");
      if ($("msg-input")) $("msg-input").value = "";
      return;
    }
    if (t.id === "btn-opt-in") { youthOptIn(); return; }
    if (t.id === "btn-reset-demo") {
      if (confirm("Reset All Demo Chat Data On This Device?")) resetDemo();
      return;
    }
    if (t.hasAttribute("data-channel")) { setChannel(t.getAttribute("data-channel")); return; }
    if (t.hasAttribute("data-panel")) { setPanel(t.getAttribute("data-panel")); return; }
    if (t.hasAttribute("data-report")) {
      var reason = prompt("Why Are You Reporting This Message?", "Needs Moderator Review");
      if (reason === null) return;
      reportMessage(t.getAttribute("data-report"), reason);
      return;
    }
    if (t.hasAttribute("data-remove")) {
      if (confirm("Remove This Message For Everyone?")) removeMessage(t.getAttribute("data-remove"));
      return;
    }
    if (t.hasAttribute("data-status")) {
      var parts = t.getAttribute("data-status").split(":");
      setMemberStatus(parts[0], parts[1]);
      return;
    }
    if (t.hasAttribute("data-approve-child")) { approveChild(t.getAttribute("data-approve-child")); return; }
    if (t.hasAttribute("data-invite")) { inviteFromWardList(t.getAttribute("data-invite")); return; }
    if (t.hasAttribute("data-resolve")) {
      var rp = t.getAttribute("data-resolve").split(":");
      resolveReport(rp[0], rp[1]);
      return;
    }
    if (t.hasAttribute("data-presence")) { toggleAdultPresence(t.getAttribute("data-presence")); return; }
  }

  function bind() {
    document.addEventListener("click", onClick);
    var form = $("composer-form");
    if (form) form.addEventListener("submit", function (e) {
      e.preventDefault();
      sendMessage(($("msg-input") && $("msg-input").value) || "");
      if ($("msg-input")) $("msg-input").value = "";
    });
    var sel = $("role-switch");
    if (sel) sel.addEventListener("change", function () { switchUser(sel.value); });
  }

  /* ---------- boot ---------- */
  function boot() {
    initData();
    bind();
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
