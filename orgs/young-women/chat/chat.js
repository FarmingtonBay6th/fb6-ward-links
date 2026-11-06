/* Bay 6 Hub · Young Women Chat MVP
   DEMO mode: localStorage mock backend. Live modes: wire via config.js (Firebase / Supabase).
   Safety-first: invite-only, parent approval, youth opt-in, two-deep adults, no youth DMs.
   Features: continuous chat, per-person accents, notifications demo, photos (EXIF stripped),
   Sign-Ups (per-class Door Greeting and Lessons), private Leaders channel. */
(function () {
  "use strict";

  var CFG = window.YW_CHAT_CONFIG || { mode: "demo", channels: [], safety: {}, demoStorageKey: "bay6-yw-chat-v4" };
  var SEED = window.YW_CHAT_DEMO_SEED || { users: [], messages: [], reports: [], invites: [], presence: {}, settings: {} };

  var state = {
    mode: CFG.mode || "demo",
    channelId: "main",
    currentUserId: null,
    panel: "chat",
    data: null,
    toast: null,
    pendingImage: null
  };

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

  function ensureShape(data) {
    if (!data.notifPrefs) data.notifPrefs = {};
    if (!data.unread) data.unread = {};
    if (!data.settings) data.settings = clone(SEED.settings || {});
    /* Sign-ups are not stored in this chat record. */
    if (!data.presence) data.presence = {};
    if (!data.presence.leaders) data.presence.leaders = ["u-traci", "u-mignon"];
    return data;
  }

  function loadDemo() {
    var key = CFG.demoStorageKey || "bay6-yw-chat-v4";
    try {
      var raw = localStorage.getItem(key);
      if (raw) {
        var parsed = JSON.parse(raw);
        var already = parsed.signups && parsed.signups.schema === 2;
        parsed = ensureShape(parsed);
        if (!already) saveDemo(parsed);
        return parsed;
      }
    } catch (e) {}
    var fresh = ensureShape({
      users: clone(SEED.users),
      messages: clone(SEED.messages),
      reports: clone(SEED.reports),
      invites: clone(SEED.invites),
      presence: clone(SEED.presence),
      settings: clone(SEED.settings || {}),
      sessionUserId: "u-presley",
      notifPrefs: {},
      unread: {}
    });
    var hasLeaders = (fresh.messages || []).some(function (m) { return m.channelId === "leaders"; });
    if (!hasLeaders) {
      fresh.messages.push(
        { id: "m-lead1", channelId: "leaders", authorId: "u-traci", text: "Leaders only — activity night plan and stewardship notes. Youth cannot see this channel.", createdAt: "2026-11-05T14:00:00-07:00", removed: false },
        { id: "m-lead2", channelId: "leaders", authorId: "u-mignon", text: "Two-deep check looks good for Sunday. I’ll bring the lesson manuals.", createdAt: "2026-11-05T14:10:00-07:00", removed: false }
      );
    }
    saveDemo(fresh);
    return fresh;
  }

  function saveDemo(data) {
    try { localStorage.setItem(CFG.demoStorageKey || "bay6-yw-chat-v4", JSON.stringify(data)); }
    catch (e) {
      try {
        trimPhotos(data, 2);
        localStorage.setItem(CFG.demoStorageKey || "bay6-yw-chat-v4", JSON.stringify(data));
      } catch (e2) {}
    }
  }

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function persist() { if (isDemo()) saveDemo(state.data); }

  function initData() {
    state.mode = "demo";
    state.data = loadDemo();
    state.currentUserId = state.data.sessionUserId || "u-presley";
    if (!isDemo()) {
      toast("Live backend placeholders are set, but SDKs are not wired yet. Running DEMO.");
    }
  }

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
  function isLeaderStaff(u) {
    return !!(u && (u.role === "moderator" || u.role === "adviser" || u.role === "bishopric"));
  }
  function allChannels() {
    var base = (CFG.channels || []).slice();
    if (!base.some(function (c) { return c.id === "leaders"; })) {
      base.push({ id: "leaders", name: "Leaders", blurb: "Presidency & Advisers Only", leadersOnly: true });
    }
    return base;
  }
  function channelById(id) {
    return allChannels().find(function (c) { return c.id === id; }) || { id: id, name: id, blurb: "" };
  }
  function adultsPresent(channelId) {
    var ids = (state.data.presence && state.data.presence[channelId]) || [];
    return ids.map(userById).filter(function (u) { return u && isAdult(u) && u.status === "active" && !u.removed; });
  }
  function twoDeepOk(channelId) {
    if (channelId === "leaders") return adultsPresent(channelId).length >= 1 || isLeaderStaff(currentUser());
    var need = (CFG.safety && CFG.safety.minAdultsPresent) || 2;
    return adultsPresent(channelId).length >= need;
  }
  function canPost(u, channelId) {
    if (!u || u.status !== "active") return false;
    if (u.muted || u.status === "muted") return false;
    if (channelId === "leaders") return isLeaderStaff(u);
    if (u.kind === "youth" && u.classId && channelId !== "main" && u.classId !== channelId) return false;
    if (!twoDeepOk(channelId) && u.kind === "youth") return false;
    return true;
  }
  function isLeadershipAdult(u) {
    return !!(u && (isMod(u) || u.role === "adviser" || u.role === "parent" || u.role === "bishopric" || isAdult(u)));
  }
  function canViewChannel(u, channelId) {
    if (!u) return false;
    if (channelId === "leaders") return isLeaderStaff(u);
    if (isLeaderStaff(u) || u.role === "parent") return true;
    if (isLeadershipAdult(u) && u.role !== "parent") return true;
    if (u.status === "active" || u.status === "muted") {
      if (channelId === "main") return true;
      return u.classId === channelId;
    }
    return false;
  }
  function canListChannel(u, channelId) {
    if (channelId === "leaders") return isLeaderStaff(u);
    return !!u;
  }
  function canOpenChannel(u) { return !!u; }
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
      var same = d.toDateString() === now.toDateString();
      var yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
      if (same) return "Today · " + d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
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

  var PERSON_PALETTE = [
    { bg: "#eef2f5", accent: "#5a6f7e", name: "#3d4f5c", bgDark: "#2c3338", nameDark: "#c5d0d8" },
    { bg: "#eef1f6", accent: "#5c6b85", name: "#3f4d63", bgDark: "#2b3038", nameDark: "#c4cbd6" },
    { bg: "#eef3f2", accent: "#5a736c", name: "#3d524c", bgDark: "#2b3331", nameDark: "#c3d0cc" },
    { bg: "#f3f1ee", accent: "#7a6f5f", name: "#564c40", bgDark: "#322e2a", nameDark: "#d0c6ba" },
    { bg: "#eef3f6", accent: "#4f6d7a", name: "#385460", bgDark: "#2a3236", nameDark: "#bfd0d8" },
    { bg: "#f1f2f0", accent: "#6a7168", name: "#4a5248", bgDark: "#2e302e", nameDark: "#c8cdc6" },
    { bg: "#f0f2f5", accent: "#667788", name: "#455463", bgDark: "#2c3034", nameDark: "#c6ced6" },
    { bg: "#f2f0ee", accent: "#75685c", name: "#524840", bgDark: "#312e2b", nameDark: "#d0c7be" },
    { bg: "#eef4f3", accent: "#5a7570", name: "#3e544f", bgDark: "#2b3332", nameDark: "#c2d1cd" },
    { bg: "#f1f0ef", accent: "#6e6862", name: "#4c4742", bgDark: "#2f2d2b", nameDark: "#cbc6c1" }
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
  function bannerToast(title, tiny) {
    var el = $("banner-toast");
    if (!el) { toast(title); return; }
    el.innerHTML = esc(title) + (tiny ? "<span class=\"tiny\">" + esc(tiny) + "</span>" : "");
    el.hidden = false;
    clearTimeout(bannerToast._t);
    bannerToast._t = setTimeout(function () { el.hidden = true; }, 4200);
  }
  function titleCaseStatus(s) {
    var map = {
      active: "Active", invited: "Invited", pending_parent: "Awaiting Parent Approval",
      pending_youth: "Awaiting Youth Opt-In", muted: "Muted", removed: "Removed"
    };
    return map[s] || s;
  }

  function defaultNotifPrefs(u) {
    var channels = {};
    allChannels().forEach(function (c) {
      if (!canViewChannel(u, c.id)) return;
      channels[c.id] = c.id === "leaders" ? isLeaderStaff(u) : true;
    });
    return {
      channels: channels, alertLevel: "all", quietHoursEnabled: true,
      quietStart: "21:00", quietEnd: "07:00",
      deliveryPhone: true, deliveryText: false, deliveryEmail: false, notifyMeToo: false
    };
  }
  function notifPrefsFor(u) {
    if (!u) return defaultNotifPrefs({ role: "youth", kind: "youth", status: "active", classId: "gatherers", id: "x" });
    if (!state.data.notifPrefs[u.id]) {
      state.data.notifPrefs[u.id] = defaultNotifPrefs(u);
      persist();
    }
    return state.data.notifPrefs[u.id];
  }
  function followsChannel(u, channelId) {
    var p = notifPrefsFor(u);
    if (p.alertLevel === "off") return false;
    return !!(p.channels && p.channels[channelId]);
  }
  function isLeaderAuthor(authorId) {
    var a = userById(authorId);
    return !!(a && (a.role === "moderator" || a.role === "adviser" || a.role === "bishopric"));
  }
  function shouldAlert(u, msg) {
    if (!u || !msg || msg.authorId === u.id) return false;
    if (!followsChannel(u, msg.channelId)) return false;
    if (!canViewChannel(u, msg.channelId)) return false;
    var p = notifPrefsFor(u);
    if (p.alertLevel === "off" || p.alertLevel === "daily") return false;
    if (p.alertLevel === "leaders" && !isLeaderAuthor(msg.authorId)) return false;
    if (u.role === "parent" && !p.notifyMeToo) return false;
    return true;
  }
  function bumpUnread(channelId) {
    if (!state.data.unread) state.data.unread = {};
    state.data.unread[channelId] = (state.data.unread[channelId] || 0) + 1;
  }
  function clearUnread(channelId) {
    if (!state.data.unread) return;
    state.data.unread[channelId] = 0;
  }
  function notifyForMessage(msg) {
    var u = currentUser();
    if (!shouldAlert(u, msg)) return;
    if (state.panel === "chat" && state.channelId === msg.channelId) {
      clearUnread(msg.channelId);
      return;
    }
    bumpUnread(msg.channelId);
    bannerToast("New Message In " + channelById(msg.channelId).name, "Demo: Real Alerts Start When We Go Live");
    persist();
  }
  function simulateIncoming() {
    var u = currentUser();
    if (!u) return;
    var prefs = notifPrefsFor(u);
    var targets = allChannels().filter(function (c) {
      return canViewChannel(u, c.id) && prefs.channels[c.id];
    }).map(function (c) { return c.id; });
    if (!targets.length) targets = ["main"];
    var ch = targets.indexOf("gatherers") >= 0 ? "gatherers" : targets[0];
    var author = "u-traci";
    if (ch === "messengers") author = "u-denise";
    if (ch === "builders") author = "u-adviser-b";
    if (ch === "leaders") author = "u-mignon";
    if (author === u.id) author = "u-lori";
    state.data.messages.push({
      id: uid("m"), channelId: ch, authorId: author,
      text: "Demo ping — checking that alerts work for " + channelById(ch).name + ".",
      createdAt: new Date().toISOString(), removed: false
    });
    bumpUnread(ch);
    bannerToast("New Message In " + channelById(ch).name, "Demo: Real Alerts Start When We Go Live");
    persist();
    render();
  }

  function trimPhotos(data, keep) {
    var withImg = (data.messages || []).filter(function (m) { return m.imageDataUrl && !m.removed; })
      .sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
    var max = keep != null ? keep : (CFG.photoMaxStored || 8);
    while (withImg.length > max) {
      var drop = withImg.shift();
      drop.imageDataUrl = null;
      drop.imageRemovedForQuota = true;
    }
  }
  function stripExifAndResize(file) {
    return new Promise(function (resolve, reject) {
      var maxBytes = CFG.photoMaxBytes || (5 * 1024 * 1024);
      if (!file || !file.type || file.type.indexOf("image/") !== 0) { reject(new Error("Images Only")); return; }
      if (file.size > maxBytes) { reject(new Error("Photo Must Be Under 5 MB")); return; }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var maxSide = 1280;
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          var scale = Math.min(1, maxSide / Math.max(w, h));
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement("canvas");
          canvas.width = cw; canvas.height = ch;
          canvas.getContext("2d").drawImage(img, 0, 0, cw, ch);
          var dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          URL.revokeObjectURL(url);
          resolve(dataUrl);
        } catch (err) { URL.revokeObjectURL(url); reject(err); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("Could Not Read Photo")); };
      img.src = url;
    });
  }
  function openLightbox(src) {
    var box = $("lightbox"); var img = $("lightbox-img");
    if (!box || !img || !src) return;
    img.src = src; box.hidden = false;
  }
  function closeLightbox() {
    var box = $("lightbox"); var img = $("lightbox-img");
    if (img) img.src = "";
    if (box) box.hidden = true;
  }

  function switchUser(id) {
    if (!userById(id)) return;
    state.currentUserId = id;
    state.data.sessionUserId = id;
    if (state.channelId === "leaders" && !canViewChannel(currentUser(), "leaders")) state.channelId = "main";
    persist(); render();
  }
  function setChannel(id) {
    if (!canOpenChannel(currentUser())) { toast("Sign In To Open A Channel."); return; }
    if (id === "leaders" && !isLeaderStaff(currentUser())) {
      toast("Leaders Channel Is For Presidency And Advisers Only."); return;
    }
    state.channelId = id; state.panel = "chat";
    clearUnread(id); persist(); render();
  }
  function setPanel(p) { state.panel = p; render(); }

  function sendMessage(text, imageDataUrl) {
    var u = currentUser();
    var ch = state.channelId;
    text = (text || "").trim();
    if (!text && !imageDataUrl) return;
    if (!canPost(u, ch)) { toast("You Cannot Post Right Now (Check Status Or Two-Deep Adults)."); return; }
    if (text.length > 1000) { toast("Message Is Too Long."); return; }
    var msg = { id: uid("m"), channelId: ch, authorId: u.id, text: text, createdAt: new Date().toISOString(), removed: false };
    if (imageDataUrl) msg.imageDataUrl = imageDataUrl;
    state.data.messages.push(msg);
    trimPhotos(state.data);
    persist();
    state.pendingImage = null;
    render();
    var list = $("msg-list");
    if (list) list.scrollTop = list.scrollHeight;
  }
  function reportMessage(messageId, reason) {
    var u = currentUser(); if (!u) return;
    reason = (reason || "").trim() || "Flagged For Review";
    state.data.reports.push({ id: uid("r"), messageId: messageId, reporterId: u.id, reason: reason, createdAt: new Date().toISOString(), status: "open" });
    persist(); toast("Report Sent To Moderators. Thank You."); render();
  }
  function removeMessage(messageId) {
    var u = currentUser();
    if (!isMod(u)) { toast("Only Moderators Can Remove Messages."); return; }
    var m = state.data.messages.find(function (x) { return x.id === messageId; });
    if (!m) return;
    m.removed = true; m.removedBy = u.id; m.removedAt = new Date().toISOString();
    persist(); toast("Message Removed."); render();
  }
  function setMemberStatus(userId, status) {
    var u = currentUser();
    if (!isMod(u) && !(u && u.role === "parent" && status === "pending_youth")) { toast("Not Allowed."); return; }
    var target = userById(userId); if (!target) return;
    target.status = status;
    if (status === "muted") target.muted = true;
    if (status === "active") target.muted = false;
    if (status === "removed") target.removed = true;
    persist(); toast("Member Updated: " + titleCaseStatus(status)); render();
  }
  function approveChild(childId) {
    var u = currentUser(); var child = userById(childId);
    if (!u || u.role !== "parent") { toast("Sign In As A Parent To Approve."); return; }
    if (!child || child.parentId !== u.id) { toast("That Youth Is Not Linked To You."); return; }
    if (child.status !== "pending_parent" && child.status !== "invited") { toast("No Parent Approval Needed Right Now."); return; }
    child.status = "pending_youth"; persist(); toast("Parent Approval Recorded. Youth Must Opt In Next."); render();
  }
  function youthOptIn() {
    var u = currentUser();
    if (!u || u.kind !== "youth") { toast("Switch To A Youth Account To Opt In."); return; }
    if (u.status !== "pending_youth") { toast("You Are Not Waiting To Opt In."); return; }
    u.status = "active"; persist(); toast("You Joined Young Women Chat. Welcome!"); render();
  }
  function inviteFromWardList(userId) {
    var u = currentUser();
    if (!isMod(u)) { toast("Only Moderators Can Invite."); return; }
    var target = userById(userId);
    if (!target || target.kind !== "youth") return;
    if (target.status === "active") { toast("Already Active."); return; }
    target.status = target.parentId ? "pending_parent" : "pending_youth";
    state.data.invites.push({ id: uid("inv"), userId: target.id, invitedBy: u.id, createdAt: new Date().toISOString() });
    persist(); toast("Invite Sent (Parent Approval Required When Linked)."); render();
  }
  function resolveReport(reportId, resolution) {
    var u = currentUser(); if (!isMod(u)) return;
    var r = state.data.reports.find(function (x) { return x.id === reportId; });
    if (!r) return;
    r.status = resolution || "resolved"; r.resolvedBy = u.id; r.resolvedAt = new Date().toISOString();
    persist(); toast("Report Marked " + (resolution === "dismissed" ? "Dismissed" : "Resolved") + "."); render();
  }
  function resetDemo() {
    if (!isDemo()) return;
    try { localStorage.removeItem(CFG.demoStorageKey || "bay6-yw-chat-v4"); } catch (e) {}
    state.data = loadDemo(); state.currentUserId = state.data.sessionUserId;
    toast("Demo Data Reset."); render();
  }
  function toggleAdultPresence(adultId) {
    var u = currentUser();
    if (!isMod(u) && u.id !== adultId) { toast("Moderators Manage Presence In Demo."); return; }
    var ch = state.channelId;
    if (!state.data.presence[ch]) state.data.presence[ch] = [];
    var list = state.data.presence[ch];
    var i = list.indexOf(adultId);
    if (i >= 0) list.splice(i, 1); else list.push(adultId);
    persist(); render();
  }
  function signupOpts() {
    return { classFilter: state.signupFilter || "", reviewClassId: state.reviewClassId || "" };
  }
  function commitSignup(action) {
    if (!window.YWSignupClient || !window.YWSignupClient.configured()) { toast("Sign-Ups Are Not Connected."); return; }
    if (!action) { toast("Sign-Ups Are Not Ready."); return; }
    if (action.invalid) { toast(action.message || "Check That Row And Try Again."); return; }
    window.YWSignupClient.submit(action, signupOpts()).then(function (result) {
      toast((result && result.message) || (result && result.ok ? "Saved." : "Could Not Save."));
      var wrap = $("main-panel");
      if (wrap && state.panel === "signups") window.YWSignupClient.paint(wrap, signupOpts());
    }).catch(function () { toast("Sign-Ups Could Not Reach The Ward Script."); });
  }

  function render() { renderChrome(); renderChannels(); renderMain(); renderComposer(); }

  function renderChrome() {
    var u = currentUser();
    var demoBanner = $("demo-banner");
    if (demoBanner) demoBanner.hidden = !isDemo();
    var who = $("who-ami");
    if (who && u) {
      who.innerHTML = "<strong>" + esc(u.name) + "</strong> · " + esc(roleLabel(u)) +
        " · <span class=\"pill\">" + esc(titleCaseStatus(u.status)) + "</span>";
    }
    var sel = $("role-switch");
    if (sel) {
      sel.innerHTML = state.data.users.filter(function (x) { return !x.removed; }).map(function (x) {
        return "<option value=\"" + esc(x.id) + "\"" + (x.id === state.currentUserId ? " selected" : "") + ">" +
          esc(x.name) + " (" + esc(roleLabel(x)) + ")</option>";
      }).join("");
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
    if (u.role === "bishopric") return "Bishopric Adviser";
    if (u.role === "parent") return "Parent / Guardian";
    if (u.role === "youth") return "Young Woman";
    return u.role;
  }

  function renderChannels() {
    var u = currentUser();
    var nav = $("channel-nav");
    if (!nav) return;
    nav.innerHTML = allChannels().filter(function (c) { return canListChannel(u, c.id); }).map(function (c) {
      var memberView = canViewChannel(u, c.id);
      var deep = twoDeepOk(c.id);
      var adults = adultsPresent(c.id).length;
      var unread = (state.data.unread && state.data.unread[c.id]) || 0;
      var cls = "chan" + (c.id === state.channelId ? " on" : "") + (!memberView ? " dim" : "");
      var badge = unread > 0 ? "<span class=\"badge\" aria-label=\"" + unread + " unread\">" + (unread > 9 ? "9+" : unread) + "</span>" : "";
      var deepLabel = c.id === "leaders" ? (adults + " Leaders") : (adults + " Adults");
      return "<button type=\"button\" class=\"" + cls + "\" data-channel=\"" + esc(c.id) + "\">" + badge +
        "<b>" + esc(c.name) + "</b><small>" + esc(c.blurb) + "</small>" +
        "<span class=\"deep " + (deep ? "ok" : "warn") + "\">" + deepLabel + "</span></button>";
    }).join("");
  }

  function renderMain() {
    if (state.panel === "members") return renderMembers();
    if (state.panel === "join") return renderJoin();
    if (state.panel === "mod") return renderMod();
    if (state.panel === "notif") return renderNotif();
    if (state.panel === "signups") return renderSignups();
    return renderChat();
  }

  function renderChat() {
    var wrap = $("main-panel"); if (!wrap) return;
    var u = currentUser();
    var ch = channelById(state.channelId);
    var deep = twoDeepOk(state.channelId);
    var adults = adultsPresent(state.channelId);
    var msgs = state.data.messages.filter(function (m) { return m.channelId === state.channelId; })
      .sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
    var warn = "";
    if (state.channelId !== "leaders" && !deep) {
      warn = "<div class=\"callout warn\"><b>Two-Deep Adult Presence Needed</b><p>Youth posting is paused until at least two adults are present in this channel.</p></div>";
    }
    if (state.channelId === "leaders") {
      warn = "<div class=\"callout\"><b>Leaders Channel</b><p>Private to YW presidency and advisers. Fully hidden from youth.</p></div>";
    }
    var html = "<div class=\"panel-head\"><h2>" + esc(ch.name) + "</h2><p>" + esc(ch.blurb) +
      " · Supervised by " + adults.map(function (a) { return esc(a.name); }).join(", ") +
      (adults.length ? "" : "nobody yet") + "</p></div>" + warn +
      "<div class=\"msg-list\" id=\"msg-list\" role=\"log\" aria-live=\"polite\">";
    if (!canViewChannel(u, state.channelId)) {
      if (state.channelId === "leaders") html += "<p class=\"empty\">Leaders Channel Is For Presidency And Advisers Only.</p>";
      else if (u && u.kind === "youth" && state.channelId !== "main") {
        html += "<div class=\"callout\"><b>" + esc(classChannelNotice(state.channelId)) +
          "</b><p>Only " + esc(ch.name) + " class members and adult leaders can read and post here.</p></div>";
      } else html += "<p class=\"empty\">You Do Not Have Access To This Channel Yet. Finish Join Steps First.</p>";
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
            "<p class=\"body dim\">Message Removed</p><time class=\"mtime\">" + esc(fmtBubbleTime(m.createdAt)) + "</time></div></article>";
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
        html += "<div class=\"bubble\">";
        if (m.imageDataUrl) {
          html += "<img class=\"photo-thumb\" src=\"" + String(m.imageDataUrl).replace(/"/g, "") + "\" alt=\"Shared Photo\" data-full=\"" + esc(m.id) + "\">";
        }
        if (m.text) html += "<p class=\"body\">" + esc(m.text) + "</p>";
        else if (m.imageDataUrl) html += "<p class=\"body dim\">Photo</p>";
        html += "<time class=\"mtime\">" + esc(fmtBubbleTime(m.createdAt)) + "</time></div>" +
          "<div class=\"msg-acts\">" +
          "<button type=\"button\" class=\"linkish\" data-report=\"" + esc(m.id) + "\">Report</button>" +
          (isMod(u) ? "<button type=\"button\" class=\"linkish danger\" data-remove=\"" + esc(m.id) + "\">Remove Message</button>" : "") +
          "</div></article>";
      });
    }
    html += "</div>";
    wrap.innerHTML = html;
    requestAnimationFrame(function () {
      var list = $("msg-list"); var panel = $("main-panel");
      if (panel) panel.scrollTop = panel.scrollHeight;
      if (list) list.scrollTop = list.scrollHeight;
    });
  }

  function renderNotif() {
    var wrap = $("main-panel"); if (!wrap) return;
    var u = currentUser(); var p = notifPrefsFor(u);
    var html = "<div class=\"panel-head\"><h2>Notification Settings</h2><p>Choose How You Want To Hear About New Posts.</p></div>";
    html += "<div class=\"demo-note\">Demo: Real Alerts Start When We Go Live</div>";
    html += "<div class=\"settings-block\"><h3>Channels</h3><p class=\"hint\">Only Channels You Can See.</p>";
    allChannels().forEach(function (c) {
      if (!canViewChannel(u, c.id)) return;
      var on = !!(p.channels && p.channels[c.id]);
      html += "<div class=\"settings-row\"><label class=\"main\" for=\"ch-" + esc(c.id) + "\">" + esc(c.name) +
        "<span class=\"sub\">" + esc(c.blurb) + "</span></label>" +
        "<label class=\"toggle\"><input type=\"checkbox\" id=\"ch-" + esc(c.id) + "\" data-notif-ch=\"" + esc(c.id) + "\"" +
        (on ? " checked" : "") + "><span></span></label></div>";
    });
    html += "</div>";
    html += "<div class=\"settings-block\"><h3>Alert Level</h3><div class=\"radio-list\">";
    [["all","All New Posts"],["leaders","Leader Posts Only"],["daily","Daily Summary"],["off","Off"]].forEach(function (pair) {
      var on = p.alertLevel === pair[0];
      html += "<label class=\"" + (on ? "on" : "") + "\"><input type=\"radio\" name=\"alert-level\" data-alert-level=\"" + pair[0] + "\"" +
        (on ? " checked" : "") + "> <span><b>" + pair[1] + "</b></span></label>";
    });
    html += "</div></div>";
    html += "<div class=\"settings-block\"><h3>Quiet Hours</h3>" +
      "<div class=\"settings-row\"><label class=\"main\" for=\"quiet-on\">Quiet Hours<span class=\"sub\">Default 9:00 PM To 7:00 AM</span></label>" +
      "<label class=\"toggle\"><input type=\"checkbox\" id=\"quiet-on\" data-quiet-toggle" + (p.quietHoursEnabled ? " checked" : "") + "><span></span></label></div>" +
      "<div class=\"quiet-times\">" +
      "<label>From <input type=\"time\" data-quiet-start value=\"" + esc(p.quietStart || "21:00") + "\"></label>" +
      "<label>To <input type=\"time\" data-quiet-end value=\"" + esc(p.quietEnd || "07:00") + "\"></label></div></div>";
    html += "<div class=\"settings-block\"><h3>Delivery</h3>";
    html += "<div class=\"settings-row\"><label class=\"main\" for=\"del-phone\">Phone Notifications<span class=\"sub\">On iPhone, Add To Home Screen First, Then Tap Allow</span></label>" +
      "<label class=\"toggle\"><input type=\"checkbox\" id=\"del-phone\" data-del=\"deliveryPhone\"" + (p.deliveryPhone ? " checked" : "") + "><span></span></label></div>";
    html += "<div class=\"settings-row\"><label class=\"main\" for=\"del-text\">Text Message Backup</label>" +
      "<label class=\"toggle\"><input type=\"checkbox\" id=\"del-text\" data-del=\"deliveryText\"" + (p.deliveryText ? " checked" : "") + "><span></span></label></div>";
    html += "<div class=\"settings-row\"><label class=\"main\" for=\"del-email\">Email Backup</label>" +
      "<label class=\"toggle\"><input type=\"checkbox\" id=\"del-email\" data-del=\"deliveryEmail\"" + (p.deliveryEmail ? " checked" : "") + "><span></span></label></div></div>";
    if (u && u.role === "parent") {
      html += "<div class=\"settings-block\"><h3>Parent Options</h3>" +
        "<div class=\"settings-row\"><label class=\"main\" for=\"notify-too\">Notify Me Too<span class=\"sub\">Alerts For Your Daughter’s Channels</span></label>" +
        "<label class=\"toggle\"><input type=\"checkbox\" id=\"notify-too\" data-notify-too" + (p.notifyMeToo ? " checked" : "") + "><span></span></label></div></div>";
    }
    html += "<div class=\"settings-block\"><h3>Try It</h3><p class=\"hint\">Simulate A New Post From Another Demo User.</p>" +
      "<button type=\"button\" class=\"btn\" id=\"btn-try-alert\">Try Demo Alert</button></div>";
    wrap.innerHTML = html;
  }

  function saveNotifFromDom() {
    var u = currentUser(); if (!u) return;
    var p = notifPrefsFor(u);
    document.querySelectorAll("[data-notif-ch]").forEach(function (el) {
      p.channels[el.getAttribute("data-notif-ch")] = !!el.checked;
    });
    var level = document.querySelector("[data-alert-level]:checked");
    if (level) p.alertLevel = level.getAttribute("data-alert-level");
    var q = document.querySelector("[data-quiet-toggle]");
    if (q) p.quietHoursEnabled = !!q.checked;
    var qs = document.querySelector("[data-quiet-start]");
    var qe = document.querySelector("[data-quiet-end]");
    if (qs && qs.value) p.quietStart = qs.value;
    if (qe && qe.value) p.quietEnd = qe.value;
    document.querySelectorAll("[data-del]").forEach(function (el) {
      p[el.getAttribute("data-del")] = !!el.checked;
    });
    var nt = document.querySelector("[data-notify-too]");
    if (nt) p.notifyMeToo = !!nt.checked;
    state.data.notifPrefs[u.id] = p;
    persist();
  }

  function renderSignups() {
    var wrap = $("main-panel"); if (!wrap || !window.YWSignupClient) return;
    window.YWSignupClient.paint(wrap, signupOpts());
  }

  function renderMembers() {
    var wrap = $("main-panel"); if (!wrap) return;
    var u = currentUser();
    var rows = state.data.users.filter(function (x) {
      return x.kind === "youth" || x.role === "moderator" || x.role === "adviser" || x.role === "bishopric";
    });
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
        if (p.status === "active") html += "<button type=\"button\" class=\"btn mini alt\" data-status=\"" + esc(p.id) + ":muted\">Mute</button>";
        if (p.status === "muted") html += "<button type=\"button\" class=\"btn mini\" data-status=\"" + esc(p.id) + ":active\">Unmute</button>";
        if (p.status !== "removed") html += "<button type=\"button\" class=\"btn mini danger\" data-status=\"" + esc(p.id) + ":removed\">Remove User</button>";
        html += "</div>";
      }
      html += "</li>";
    });
    html += "</ul>";
    wrap.innerHTML = html;
  }

  function renderJoin() {
    var wrap = $("main-panel"); if (!wrap) return;
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
    var wrap = $("main-panel"); var u = currentUser();
    if (!wrap) return;
    if (!isMod(u)) { wrap.innerHTML = "<p class=\"empty\">Moderators Only.</p>"; return; }
    var openReports = state.data.reports.filter(function (r) { return r.status === "open"; });
    var pending = state.data.users.filter(function (x) {
      return x.kind === "youth" && (x.status === "pending_parent" || x.status === "pending_youth" || x.status === "invited");
    });
    var photos = state.data.messages.filter(function (m) { return m.imageDataUrl && !m.removed; })
      .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    var html = "<div class=\"panel-head\"><h2>Moderator Tools</h2><p>YW Presidency can approve members, remove messages, mute or remove users, and review reports.</p></div>";
    html += "<div class=\"cardish\"><h3>All Photos (" + photos.length + ")</h3>" +
      "<p class=\"note\">Leaders can see every photo in every channel. Photos post immediately; EXIF / location is stripped on upload.</p>";
    if (!photos.length) html += "<p class=\"note\">No Photos Yet.</p>";
    else {
      html += "<div class=\"photo-grid\">";
      photos.forEach(function (m) {
        var author = userById(m.authorId); var ch = channelById(m.channelId);
        html += "<div class=\"photo-card\"><img src=\"" + String(m.imageDataUrl).replace(/"/g, "") + "\" alt=\"Photo\" data-full=\"" + esc(m.id) + "\">" +
          "<div class=\"meta\"><b>" + esc(author ? author.name : "?") + "</b>" + esc(ch.name) + " · " + esc(fmtTime(m.createdAt)) + "</div>" +
          "<div class=\"acts\"><button type=\"button\" class=\"btn mini danger\" data-remove=\"" + esc(m.id) + "\">Remove</button></div></div>";
      });
      html += "</div>";
    }
    html += "</div>";
    html += "<div class=\"cardish\"><h3>Open Reports (" + openReports.length + ")</h3>";
    if (!openReports.length) html += "<p class=\"note\">No Open Reports.</p>";
    else {
      html += "<ul class=\"people\">";
      openReports.forEach(function (r) {
        var m = state.data.messages.find(function (x) { return x.id === r.messageId; });
        var reporter = userById(r.reporterId);
        html += "<li><div class=\"who\"><b>Report</b><span>By " + esc(reporter ? reporter.name : "?") +
          " · " + esc(fmtTime(r.createdAt)) + "</span><span class=\"snip\">" + esc(r.reason) + "</span>" +
          (m ? "<span class=\"snip\">Message: “" + esc((m.text || "Photo").slice(0, 120)) + "”</span>" : "") +
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
    var box = $("composer"); if (!box) return;
    var show = state.panel === "chat";
    box.hidden = !show; if (!show) return;
    var u = currentUser();
    var ok = canPost(u, state.channelId);
    var input = $("msg-input"); var send = $("msg-send"); var photoBtn = $("btn-photo");
    if (input) { input.disabled = !ok; input.placeholder = ok ? "Write A Kind Message…" : "Posting Paused"; }
    if (send) send.disabled = !ok;
    if (photoBtn) photoBtn.disabled = !ok;
  }

  function onClick(e) {
    var full = e.target.closest("[data-full]");
    if (full && full.tagName === "IMG") {
      var mid = full.getAttribute("data-full");
      var msg = state.data.messages.find(function (m) { return m.id === mid; });
      if (msg && msg.imageDataUrl) openLightbox(msg.imageDataUrl);
      return;
    }
    var actBtn = e.target.closest("[data-report],[data-remove]");
    var row = e.target.closest(".msg-row.msg-hit");
    if (row && !actBtn && !e.target.closest(".photo-thumb")) {
      var was = row.classList.contains("show-acts");
      document.querySelectorAll(".msg-row.show-acts").forEach(function (el) { el.classList.remove("show-acts"); });
      if (!was) row.classList.add("show-acts");
      return;
    }
    var t = e.target.closest("[data-channel],[data-panel],[data-report],[data-remove],[data-status],[data-approve-child],[data-invite],[data-resolve],[data-presence],[data-su-action],[data-su-filter],#btn-opt-in,#btn-reset-demo,#msg-send,#btn-notif-settings,#btn-try-alert,#btn-photo,#lightbox-close,#lightbox");
    if (!t) return;
    if (t.id === "lightbox" || t.id === "lightbox-close") { closeLightbox(); return; }
    if (t.id === "btn-notif-settings") { setPanel(state.panel === "notif" ? "chat" : "notif"); return; }
    if (t.id === "btn-try-alert") { simulateIncoming(); return; }
    if (t.id === "btn-photo") { var fi = $("photo-input"); if (fi) fi.click(); return; }
    if (t.id === "msg-send") {
      e.preventDefault();
      sendMessage(($("msg-input") && $("msg-input").value) || "", state.pendingImage);
      if ($("msg-input")) $("msg-input").value = "";
      return;
    }
    if (t.id === "btn-opt-in") { youthOptIn(); return; }
    if (t.id === "btn-reset-demo") { if (confirm("Reset All Demo Chat Data On This Device?")) resetDemo(); return; }
    if (t.hasAttribute("data-channel")) { setChannel(t.getAttribute("data-channel")); return; }
    if (t.hasAttribute("data-panel")) { setPanel(t.getAttribute("data-panel")); return; }
    if (t.hasAttribute("data-report")) {
      var reason = prompt("Why Are You Reporting This Message?", "Needs Moderator Review");
      if (reason === null) return;
      reportMessage(t.getAttribute("data-report"), reason); return;
    }
    if (t.hasAttribute("data-remove")) {
      if (confirm("Remove This Message For Everyone?")) removeMessage(t.getAttribute("data-remove")); return;
    }
    if (t.hasAttribute("data-status")) {
      var parts = t.getAttribute("data-status").split(":");
      setMemberStatus(parts[0], parts[1]); return;
    }
    if (t.hasAttribute("data-approve-child")) { approveChild(t.getAttribute("data-approve-child")); return; }
    if (t.hasAttribute("data-invite")) { inviteFromWardList(t.getAttribute("data-invite")); return; }
    if (t.hasAttribute("data-resolve")) {
      var rp = t.getAttribute("data-resolve").split(":");
      resolveReport(rp[0], rp[1]); return;
    }
    if (t.hasAttribute("data-presence")) { toggleAdultPresence(t.getAttribute("data-presence")); return; }
    if (t.hasAttribute("data-su-filter")) { state.signupFilter = t.getAttribute("data-su-filter") || ""; render(); return; }
    if (t.hasAttribute("data-su-action") && window.YWSignups) {
      var action = window.YWSignups.actionFromControl(t, document);
      if (action && action.type === "add-member" && window.YWSignupClient) action = window.YWSignupClient.readAddMember();
      commitSignup(action); return;
    }
  }

  function onChange(e) {
    var t = e.target;
    if (t && (t.hasAttribute("data-notif-ch") || t.hasAttribute("data-alert-level") || t.hasAttribute("data-quiet-toggle") ||
      t.hasAttribute("data-quiet-start") || t.hasAttribute("data-quiet-end") || t.hasAttribute("data-del") || t.hasAttribute("data-notify-too"))) {
      saveNotifFromDom();
      if (t.hasAttribute("data-alert-level")) render();
      return;
    }
    if (t && t.id === "su-review-class") { state.reviewClassId = t.value || ""; render(); return; }
    if (t && (t.hasAttribute("data-su-assign") || t.hasAttribute("data-su-topic")) && window.YWSignups) {
      commitSignup(window.YWSignups.actionFromControl(t, document)); return;
    }
    if (t && t.id === "photo-input" && t.files && t.files[0]) {
      var file = t.files[0]; t.value = "";
      stripExifAndResize(file).then(function (dataUrl) {
        state.pendingImage = dataUrl;
        var caption = ($("msg-input") && $("msg-input").value) || "";
        sendMessage(caption, dataUrl);
        if ($("msg-input")) $("msg-input").value = "";
        toast("Photo Shared.");
      }).catch(function (err) {
        toast(err && err.message ? err.message : "Could Not Add Photo.");
      });
    }
  }

  function bind() {
    document.addEventListener("click", onClick);
    document.addEventListener("change", onChange);
    var form = $("composer-form");
    if (form) form.addEventListener("submit", function (e) {
      e.preventDefault();
      sendMessage(($("msg-input") && $("msg-input").value) || "", state.pendingImage);
      if ($("msg-input")) $("msg-input").value = "";
    });
    var sel = $("role-switch");
    if (sel) sel.addEventListener("change", function () { switchUser(sel.value); });
  }

  function boot() {
    initData(); bind();
    var h = (location.hash || "").replace(/^#/, "");
    if (h === "signups" || h === "members" || h === "join") state.panel = h;
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
