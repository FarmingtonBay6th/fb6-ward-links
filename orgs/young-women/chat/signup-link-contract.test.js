/* Premise for the missing "Copy This Private Link Now" box.
   The page shows that box only when the create-link JSON that res.json()
   returned has a truthy privateLink. The following view refresh does not
   include privateLink and must not erase one already kept.
   SignupApi stores only a hash and does not put privateLink on the body.
   Code.js adds privateLink after the handler returns. A handler test cannot
   see that field, and this file does not call the live web app.
   Run: node --test orgs/young-women/chat/signup-link-contract.test.js */
"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("fs");
var path = require("path");

var ROOT = __dirname;
var SCRIPT = "https://script.google.com/macros/s/TEST/exec";
var FIXTURE_LINK = "https://farmingtonbay6th.github.io/fb6-ward-links/orgs/young-women/chat/#su=fixture-secret-not-a-real-token";

function read(name) {
  return fs.readFileSync(path.join(ROOT, name), "utf8");
}

function leaderBody(links) {
  return {
    ok: true,
    message: "Private Link Created. Copy It Now. It Is Not Shown Again.",
    view: { allowed: true, actor: { name: "Ward Leader", presidency: true, leader: true }, version: 3 },
    members: [
      { id: "m-owner", name: "Ward Leader", role: "moderator", status: "active", classId: null },
      { id: "m-traci", name: "Traci Harward", role: "moderator", status: "active", classId: null }
    ],
    links: links
  };
}

function health() {
  return { ok: true, service: "yw-signups", auth: "link" };
}

function board() {
  return { ok: true, rotationSet: false, today: "2026-11-07", entries: [] };
}

function loadClient(fetchImpl) {
  var session = { "fb6-yw-signups-link": "owner-session-token-0123456789" };
  var wrap = {
    innerHTML: "",
    insertAdjacentHTML: function (_pos, html) { this.innerHTML = html + this.innerHTML; }
  };
  var document = {
    getElementById: function (id) {
      if (id === "su-new-link" && wrap.innerHTML.indexOf('id="su-new-link"') !== -1) {
        return { focus: function () {}, select: function () {}, scrollIntoView: function () {} };
      }
      return null;
    },
    addEventListener: function () {}
  };
  var window = {
    YW_CHAT_CONFIG: { signups: { scriptUrl: SCRIPT } },
    YWSignups: { renderHtml: function () { return ""; } },
    YWChatChrome: { refresh: function () {} }
  };
  var sessionStorage = {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(session, key) ? session[key] : null; },
    setItem: function (key, value) { session[key] = String(value); },
    removeItem: function (key) { delete session[key]; }
  };
  var factory = new Function(
    "window", "document", "sessionStorage", "fetch", "location", "history",
    read("signup-client.js") + "\nreturn window.YWSignupClient;"
  );
  var client = factory(window, document, sessionStorage, fetchImpl, { hash: "", pathname: "/chat/", search: "" }, { replaceState: function () {} });
  return { client: client, wrap: wrap };
}

function queuedFetch(items) {
  var index = 0;
  return function () {
    if (index >= items.length) return Promise.reject(new Error("unexpected fetch"));
    var item = items[index++];
    return Promise.resolve({
      json: function () {
        if (item.parseError) return Promise.reject(new Error("bad json"));
        return Promise.resolve(JSON.parse(JSON.stringify(item.body)));
      }
    });
  };
}

function revokeButtons(html) {
  var found = [];
  var re = /<button\b([^>]*)>([^<]*)<\/button>/g;
  var match;
  while ((match = re.exec(html))) {
    if (match[1].indexOf('data-su-action="revoke-link"') === -1) continue;
    var id = (match[1].match(/data-link="([^"]*)"/) || [])[1] || "";
    found.push({ id: id, text: match[2] });
  }
  return found;
}

function inputValue(html) {
  var tag = html.match(/<input\b[^>]*id="su-new-link"[^>]*>/);
  if (!tag) return "";
  var value = tag[0].match(/\bvalue="([^"]*)"/);
  return value ? value[1] : "";
}

function paintAfterCreate(createBody, viewBody) {
  var loaded = loadClient(queuedFetch([
    { body: createBody },
    { body: health() },
    { body: board() },
    { body: viewBody }
  ]));
  return loaded.client.submit({ op: "create-link", memberId: "m-traci" }, {}).then(function () {
    return loaded.client.paint(loaded.wrap, {});
  }).then(function () {
    return loaded.wrap.innerHTML;
  });
}

test("the handler response has no secret; Code.js is the only assignment", function () {
  var api = read("apps-script/SignupApi.js");
  var code = read("apps-script/Code.js");
  assert.deepEqual(api.match(/privateLink =/g), ["privateLink ="]);
  assert.ok(api.indexOf("if (result.privateLink) bodyOut.privateLink = result.privateLink") >= 0);
  assert.ok(code.indexOf('result.body.privateLink = "https://farmingtonbay6th.github.io/fb6-ward-links/orgs/young-women/chat/#su=" + plain') > code.indexOf("handleSignupRequest"));
  assert.ok(code.indexOf('body.op === "create-link"') < code.indexOf("result.body.privateLink"));
  var chat = read("chat.js");
  var submitAt = chat.indexOf("YWSignupClient.submit(action, signupOpts())");
  var paintAt = chat.indexOf("YWSignupClient.paint(wrap, signupOpts())");
  assert.ok(submitAt > 0 && paintAt > submitAt);
});

test("a create-link object with privateLink still shows the box after the view refresh", function () {
  var created = leaderBody([
    { id: "lk-owner-100", memberId: "m-owner", status: "active" },
    { id: "lk-traci-new", memberId: "m-traci", status: "active" }
  ]);
  created.privateLink = FIXTURE_LINK;
  var viewed = leaderBody(created.links);
  assert.equal(viewed.privateLink, undefined);
  return paintAfterCreate(created, viewed).then(function (html) {
    assert.ok(html.indexOf("Copy This Private Link Now") >= 0);
    assert.equal(inputValue(html), FIXTURE_LINK);
    var buttons = revokeButtons(html);
    assert.deepEqual(buttons.map(function (button) { return button.text; }), [
      "Turn Off Ward Leader Link",
      "Turn Off Traci Harward Link"
    ]);
    assert.deepEqual(buttons.map(function (button) { return button.id; }), ["lk-owner-100", "lk-traci-new"]);
    buttons.forEach(function (button) { assert.equal(button.text.indexOf(button.id), -1); });
  });
});

test("a create-link object without privateLink lists the new link and does not show the box", function () {
  var links = [
    { id: "lk-owner-100", memberId: "m-owner", status: "active" },
    { id: "lk-traci-new", memberId: "m-traci", status: "active" }
  ];
  return paintAfterCreate(leaderBody(links), leaderBody(links)).then(function (html) {
    assert.equal(html.indexOf("Copy This Private Link Now"), -1);
    assert.equal(inputValue(html), "");
    var buttons = revokeButtons(html);
    assert.equal(buttons[1].text, "Turn Off Traci Harward Link");
    assert.equal(buttons[1].id, "lk-traci-new");
  });
});

test("a create-link body that is not an object does not show the box, and a later reload still has no secret", function () {
  var links = [
    { id: "lk-owner-100", memberId: "m-owner", status: "active" },
    { id: "lk-traci-new", memberId: "m-traci", status: "active" }
  ];
  var loaded = loadClient(queuedFetch([
    { body: JSON.stringify({ ok: true, privateLink: FIXTURE_LINK }) },
    { body: health() },
    { body: board() },
    { body: leaderBody(links) }
  ]));
  return loaded.client.submit({ op: "create-link", memberId: "m-traci" }, {}).then(function () {
    return loaded.client.paint(loaded.wrap, {});
  }).then(function () {
    assert.equal(loaded.wrap.innerHTML.indexOf("Copy This Private Link Now"), -1);
    assert.ok(loaded.wrap.innerHTML.indexOf("lk-traci-new") >= 0);
  });
});

test("a create-link response that will not parse does not paint, so the new row appears only on a later load", function () {
  var links = [
    { id: "lk-owner-100", memberId: "m-owner", status: "active" },
    { id: "lk-traci-new", memberId: "m-traci", status: "active" }
  ];
  var loaded = loadClient(queuedFetch([
    { parseError: true },
    { body: health() },
    { body: board() },
    { body: leaderBody(links) }
  ]));
  return loaded.client.submit({ op: "create-link", memberId: "m-traci" }, {}).then(function () {
    assert.fail("unparsed create-link should reject");
  }, function () {
    assert.equal(loaded.wrap.innerHTML, "");
    return loaded.client.paint(loaded.wrap, {});
  }).then(function () {
    assert.equal(loaded.wrap.innerHTML.indexOf("Copy This Private Link Now"), -1);
    assert.equal(revokeButtons(loaded.wrap.innerHTML)[1].id, "lk-traci-new");
  });
});
