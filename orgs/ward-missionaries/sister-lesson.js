/* Public sister-lesson list. Talks only to the ward web app.
   Renders date, time, and Sign Up or Reserved. A reserved night shows the
   family's name under Reserved. Never a phone number or an address.
   Does not keep sign-ups on this phone. */
(function () {
  "use strict";

  var picked = "";
  var loading = false;
  var submitting = false;

  function scriptUrl() {
    var cfg = window.SISTER_LESSON_CONFIG || {};
    var url = String(cfg.scriptUrl || "");
    return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url) ? url : "";
  }
  function el(id) { return document.getElementById(id); }
  function show(id, on) { var node = el(id); if (node) node.hidden = !on; }
  function safeMessage(body, fallback) {
    var msg = body && typeof body.message === "string" ? body.message : "";
    if (!msg || msg.length > 160 || /[<>]/.test(msg) || /https?:/i.test(msg)) return fallback;
    return msg;
  }
  function setListMessage(message) {
    var node = el("sister-list-msg");
    if (!node) return;
    node.hidden = !message;
    node.textContent = message || "";
  }
  function setFormError(message) {
    var node = el("sister-form-error");
    if (!node) return;
    node.hidden = !message;
    node.textContent = message || "";
  }
  function post(body) {
    return fetch(scriptUrl(), {
      method: "POST",
      redirect: "follow",
      cache: "no-store",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body)
    }).then(function (res) { return res.json(); });
  }
  function nightsFrom(body) {
    if (!body || !body.ok || !Array.isArray(body.nights) || !window.SisterLesson) return null;
    return window.SisterLesson.publicNights(body.nights, new Date());
  }
  function renderNights(nights) {
    var box = el("sister-nights");
    if (!box) return;
    box.textContent = "";
    if (!nights || !nights.length) {
      var empty = document.createElement("p");
      empty.className = "note";
      empty.textContent = "No Open Nights Are Left On This List.";
      box.appendChild(empty);
      return;
    }
    var ul = document.createElement("ul");
    ul.className = "sl-nights";
    nights.forEach(function (night) {
      var label = window.SisterLesson.formatDate(night.date);
      var li = document.createElement("li");
      li.className = "night";
      var when = document.createElement("div");
      when.className = "sl-when";
      var title = document.createElement("b");
      title.textContent = label;
      var time = document.createElement("span");
      time.textContent = window.SisterLesson.TIME;
      when.appendChild(title);
      when.appendChild(time);
      var btn = document.createElement("button");
      btn.type = "button";
      var who = night.status === "reserved" ? window.SisterLesson.cleanName(night.name) : "";
      if (night.status === "reserved") {
        btn.className = "btn off";
        btn.disabled = true;
        btn.textContent = "Reserved";
        btn.setAttribute("aria-label", who ? "Reserved, " + who + ", " + label : "Reserved, " + label);
      } else {
        btn.className = "btn";
        btn.textContent = "Sign Up";
        btn.setAttribute("data-date", night.date);
        btn.setAttribute("aria-label", "Sign Up For " + label);
      }
      var action = document.createElement("div");
      action.className = "sl-action";
      action.appendChild(btn);
      if (who) {
        var whoEl = document.createElement("span");
        whoEl.className = "sl-who";
        whoEl.textContent = who;
        action.appendChild(whoEl);
      }
      li.appendChild(when);
      li.appendChild(action);
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }
  function showLoadError() {
    var box = el("sister-nights");
    if (!box) return;
    box.textContent = "";
    var p = document.createElement("p");
    p.className = "note";
    p.textContent = "Open Nights Could Not Be Loaded.";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn";
    btn.textContent = "Try Again";
    btn.addEventListener("click", start);
    box.appendChild(p);
    box.appendChild(btn);
  }
  function showList(message) {
    show("sister-form", false);
    show("sister-list", true);
    setListMessage(message || "");
  }
  function showForm(date) {
    picked = date;
    var title = el("sister-picked-date");
    if (title) title.textContent = window.SisterLesson.formatDate(date);
    setFormError("");
    show("sister-list", false);
    show("sister-form", true);
    var name = el("sister-name");
    if (name) name.focus();
    var form = el("sister-form");
    if (form && form.scrollIntoView) form.scrollIntoView({ block: "nearest" });
  }
  function start() {
    if (!window.SisterLesson) {
      setListMessage("Open Nights Could Not Be Loaded.");
      return;
    }
    if (!scriptUrl()) {
      renderNights(window.SisterLesson.publicNights(window.SisterLesson.buildNights(), new Date()));
      return;
    }
    if (loading) return;
    loading = true;
    setListMessage("");
    var box = el("sister-nights");
    if (box) box.textContent = "Loading Open Nights…";
    post({ op: "list" }).then(function (body) {
      var nights = nightsFrom(body);
      if (!nights) throw new Error("load");
      renderNights(nights);
    }).catch(function () {
      showLoadError();
    }).then(function () { loading = false; });
  }
  function submitForm() {
    if (submitting) return;
    var name = (el("sister-name") || {}).value || "";
    var phone = (el("sister-phone") || {}).value || "";
    if (!window.SisterLesson.cleanName(name)) {
      setFormError(window.SisterLesson.cleanName(name) ? "" : (/\d/.test(name) ? "Leave Your Address Off This Page." : "Enter Your Name."));
      return;
    }
    if (!window.SisterLesson.cleanPhone(phone)) {
      setFormError("Enter A Phone Number So The Sisters Can Confirm.");
      return;
    }
    if (!scriptUrl()) {
      setFormError("Sign-Up Is Not Connected Yet. Nothing Was Saved.");
      return;
    }
    submitting = true;
    var button = el("sister-submit");
    if (button) {
      button.disabled = true;
      button.textContent = "Signing Up…";
    }
    setFormError("");
    post({ op: "claim", date: picked, name: name, phone: phone }).then(function (body) {
      var nights = body && Array.isArray(body.nights) ? window.SisterLesson.publicNights(body.nights, new Date()) : null;
      if (nights) renderNights(nights);
      if (body && body.ok) {
        if (el("sister-name")) el("sister-name").value = "";
        if (el("sister-phone")) el("sister-phone").value = "";
        picked = "";
        showList("You're Signed Up. The Sisters Will Confirm The Details With You.");
        return;
      }
      if (body && body.error === "reserved") {
        showList(safeMessage(body, "That Night Is Reserved."));
        return;
      }
      setFormError(safeMessage(body, "Sign-Up Could Not Be Saved."));
    }).catch(function () {
      setFormError("Sign-Up Could Not Be Saved.");
    }).then(function () {
      submitting = false;
      if (button) {
        button.disabled = false;
        button.textContent = "Sign Up For This Night";
      }
    });
  }

  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest ? e.target.closest("#sister-lesson button") : null;
    if (!btn) return;
    if (btn.id === "sister-back") {
      showList("");
      return;
    }
    var date = btn.getAttribute("data-date");
    if (date) showForm(date);
  });
  var form = el("sister-form");
  if (form) form.addEventListener("submit", function (e) {
    e.preventDefault();
    submitForm();
  });
  start();
})();
