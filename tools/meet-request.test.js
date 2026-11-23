// Meet with the Bishop request. Run: node --test tools/meet-request.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const M = require(path.join(ROOT, "meet/request.js"));
const page = fs.readFileSync(path.join(ROOT, "meet/index.html"), "utf8");
const home = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sunday = fs.readFileSync(path.join(ROOT, "this-sunday/index.html"), "utf8");
const sundayBuilder = fs.readFileSync(path.join(ROOT, "tools/build_this_sunday.py"), "utf8");
const plan = fs.readFileSync(path.join(ROOT, "orgs/temple-and-family-history/2027-plan/index.html"), "utf8");

const ADAM = "+18019921414";
const SPENCER = "+18012052600";

function sample(over) {
  return Object.assign({
    reasonId: "temple",
    name: "Jane Doe",
    times: ["sun-am"],
    note: ""
  }, over);
}

test("appointment list keeps the requested types, lengths, and older options", () => {
  const got = Object.fromEntries(M.REASONS.map((r) => [r.id, r.minutes]));
  assert.deepEqual(got, {
    temple: 15,
    "first-recommend": 15,
    tithing: 10,
    youth: 15,
    endorsement: 15,
    "set-apart": 5,
    melchizedek: 30,
    patriarchal: 30,
    endowment: 45,
    sealing: 45,
    mission: 45,
    general: 30
  });
  assert.equal(M.REASONS.find((r) => r.id === "temple").tuesday, false);
  assert.equal(M.REASONS.find((r) => r.id === "youth").tuesday, false);
  assert.equal(M.REASONS.find((r) => r.id === "tithing").tuesday, true);
});

test("the form collects appointment, name, times, and an optional note, and nothing else", () => {
  assert.deepEqual(M.FIELDS, ["appointment", "name", "times", "note"]);
  assert.equal(page.includes('id="name"'), true);
  assert.equal(page.includes('id="note"'), true);
  assert.equal(page.includes('type="tel"'), false);
  assert.equal(page.includes('type="email"'), false);
  assert.equal(page.includes('id="phone"'), false);
  assert.equal(page.includes('id="for"'), false);
  assert.equal(/what to bring/i.test(page), false);
  assert.equal(/worthiness|confession/i.test(page + JSON.stringify(M.REASONS)), false);
  assert.match(page, /Please don't share personal details here\./);
  assert.match(page, /anything personal stays between you and the Bishop/);
  assert.match(page, /ward executive secretaries/);
  assert.match(page, /Optional, for scheduling only\. Please don't include personal details; those stay between you and the Bishop\./);
  assert.match(page, /Youth ages 15 and up can send it from their own phone/);
  assert.equal(/\b(MST|MDT|UTC|GMT|time zone|timezone|Mountain Time)\b/i.test(page), false);
});

test("a phone number passed by mistake never enters the message", () => {
  const text = M.buildMessage(sample({ phone: "801-555-0199", email: "jane@example.com", why: "a private matter" }));
  assert.equal(text.includes("555"), false);
  assert.equal(text.includes("example.com"), false);
  assert.equal(text.includes("private matter"), false);
  assert.match(text, /Jane Doe/);
  assert.match(text, /temple recommend appointment with a member of the bishopric/);
  assert.match(text, /Time needed: 15 minutes/);
  assert.match(text, /Preferred time: Sunday morning/);
  assert.equal(text.includes("Scheduling note"), false);
});

test("set apart asks for 5 minutes in the text", () => {
  const text = M.buildMessage(sample({
    reasonId: "set-apart",
    times: ["sun-am", "tue"],
    note: "After church"
  }));
  assert.match(text, /I'd like to schedule a setting apart with the bishopric\./);
  assert.match(text, /Time needed: 5 minutes/);
  assert.match(text, /Preferred time: Sunday morning, Tuesday evening/);
  assert.match(text, /Scheduling note: After church/);
  assert.equal(/\b10\b/.test(text), false);
});

test("tithing still uses the existing sentence and the same two recipients", () => {
  const prepared = M.prepare(sample({
    reasonId: "tithing",
    times: ["sun-pm", "tue"],
    note: "After the second hour"
  }), { userAgent: "Android", dry: true });
  assert.equal(prepared.ok, true);
  assert.equal(prepared.dry, true);
  assert.match(prepared.text, /I'd still like a tithing declaration appointment with the Bishop \(10 min\)\. Name: Jane Doe/);
  assert.match(prepared.text, /Time needed: 10 minutes/);
  assert.match(prepared.text, /Preferred time: Sunday afternoon, Tuesday evening/);
  assert.match(prepared.text, /Scheduling note: After the second hour/);
  assert.equal(prepared.href.startsWith("sms:" + ADAM + "," + SPENCER + "?body="), true);
  assert.deepEqual(prepared.numbers, [ADAM, SPENCER]);
});

test("iOS opens the same group text with the addresses parameter", () => {
  const href = M.smsHref("Hello", { userAgent: "iPhone", ontouchend: false });
  assert.equal(href.startsWith("sms:/open?addresses=" + ADAM + "," + SPENCER + "&body="), true);
  assert.equal(decodeURIComponent(href.split("body=")[1]), "Hello");
});

test("Tuesday evening is withheld when a counselor usually meets, and Other needs a scheduling note", () => {
  const temple = M.timeChoices(M.reasonById("temple"));
  assert.equal(temple.find((t) => t.id === "tue").disabled, true);
  assert.match(temple.find((t) => t.id === "tue").note, /Counselors don't meet on Tuesdays/);
  assert.equal(M.timeChoices(M.reasonById("mission")).find((t) => t.id === "tue").disabled, false);
  const missing = M.validate(sample({ times: ["other"], note: "" }));
  assert.equal(missing.ok, false);
  assert.equal(missing.errors.some((e) => e.field === "note"), true);
  const ok = M.validate(sample({ times: ["other"], note: "Thursday after school" }));
  assert.equal(ok.ok, true);
  const badTuesday = M.validate(sample({ times: ["tue"] }));
  assert.equal(badTuesday.ok, false);
});

test("the page submits through the sms link and can dry-run without opening it", () => {
  assert.match(page, /window\.Fb6Meet/);
  assert.match(page, /M\.prepare\(input/);
  assert.match(page, /if \(!dry && prepared\.href\.indexOf\("sms:"\) === 0\)/);
  assert.match(page, /location\.href = prepared\.href/);
  assert.match(page, /dry=1/);
  assert.match(page, /Nothing was sent/);
  assert.match(page, /id="tithing"/);
  assert.match(page, /hash === "#tithing"/);
});

test("follow-up copy names the Ward Executive Secretary, Adam Bingham", () => {
  const named = /The Ward Executive Secretary, Adam Bingham, will coordinate with you/;
  const namedTime = /The Ward Executive Secretary, Adam Bingham, will coordinate a time with you/;
  assert.match(page, /The Ward Executive Secretary, Adam Bingham, will coordinate a time with you\./);
  assert.match(page, /The Ward Executive Secretary, Adam Bingham, will coordinate a time</);
  assert.match(page, /After you send this, the Ward Executive Secretary, Adam Bingham, will coordinate a time with you\./);
  assert.match(page, /so the Ward Executive Secretary, Adam Bingham, can coordinate with you/);
  assert.match(home, named);
  assert.match(sunday, named);
  assert.match(sundayBuilder, named);
  const surfaces = page + "\n" + home + "\n" + sunday + "\n" + sundayBuilder;
  assert.equal(/someone will text you|we'll text you|you'll get a text|adam or spencer will text|executive secretaries will text you/i.test(surfaces), false);
  assert.equal(/when can we reach you/i.test(page), false);
  assert.match(page, namedTime);
});

test("home, This Sunday, and the old plan link still reach the form", () => {
  assert.match(home, /href="meet\/"/);
  assert.match(home, /href="meet\/#tithing"/);
  assert.match(sunday, /id="bishop-meet"/);
  assert.match(sunday, /href="\.\.\/meet\/"/);
  assert.match(sundayBuilder, /href="\.\.\/meet\/"/);
  assert.match(plan, /href="\.\.\/\.\.\/\.\.\/meet\/"/);
});
