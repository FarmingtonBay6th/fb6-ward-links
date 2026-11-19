#!/usr/bin/env bash
# Locks the calendar sync push: timestamp skip, rebase onto a main that moved,
# retry after a rejected push, and rebuild when generated files conflict.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/tools/commit_calendar.sh"
STUB="$ROOT/tools/test_commit_calendar_stub.py"
SECRET_URL="https://church.example/secret-feed-token"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

# shellcheck disable=SC1090
source "$SCRIPT"

generated_path data/calendar.json || fail "data/calendar.json should be generated"
generated_path calendar/ward.ics || fail "calendar/ward.ics should be generated"
generated_path calendar/feeds/all.ics || fail "a feed should be generated"
generated_path calendar/feeds/young-women.ics || fail "a nested feed should be generated"
if generated_path README.md; then fail "README is not generated"; fi
if generated_path calendar/index.html; then fail "calendar/index.html is not generated"; fi
if generated_path data/section-updates.json; then fail "section manifest is not generated"; fi
if generated_path tools/build_calendar.py; then fail "the builder is not generated"; fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

write_calendar() {
  local dir="$1" marker="$2" stamp="$3"
  mkdir -p "$dir/data" "$dir/calendar/feeds"
  printf '{\n "generated": "%s",\n "events": ["%s"]\n}\n' "$stamp" "$marker" > "$dir/data/calendar.json"
  printf 'DTSTAMP:%s\nSUMMARY:%s\n' "$stamp" "$marker" > "$dir/calendar/ward.ics"
  printf 'DTSTAMP:%s\nSUMMARY:%s\n' "$stamp" "$marker" > "$dir/calendar/feeds/all.ics"
}

quiet_git() {
  git "$@" >/dev/null
}

new_repo() {
  REPO="$tmp/$1"
  local origin="$REPO/origin.git"
  local writer="$REPO/writer"
  local runner="$REPO/runner"
  mkdir -p "$REPO"
  quiet_git init -b main --bare "$origin"
  quiet_git clone "file://$origin" "$writer"
  git -C "$writer" config user.name "writer"
  git -C "$writer" config user.email "writer@example.com"
  mkdir -p "$writer/tools"
  cp "$STUB" "$writer/tools/build_calendar.py"
  write_calendar "$writer" base BASE
  echo "seed" > "$writer/README.md"
  quiet_git -C "$writer" add .
  quiet_git -C "$writer" commit -m init
  quiet_git -C "$writer" push origin main
  quiet_git clone --depth 1 "file://$origin" "$runner"
  git -C "$runner" config user.name "runner"
  git -C "$runner" config user.email "runner@example.com"
  if [ "$(git -C "$runner" rev-parse --is-shallow-repository)" != "true" ]; then
    fail "runner clone should be shallow"
  fi
}

advance_main() {
  local message="$1"
  shift
  local writer="$REPO/writer"
  local path
  for path in "$@"; do
    mkdir -p "$(dirname "$writer/$path")"
    echo "$message" >> "$writer/$path"
    quiet_git -C "$writer" add -- "$path"
  done
  quiet_git -C "$writer" commit -m "$message"
  quiet_git -C "$writer" push origin main
}

run_cmd() {
  local mode="$1" marker="${2:-regenerated}"
  local out err
  out="$(mktemp)"
  err="$(mktemp)"
  set +e
  (
    cd "$REPO/runner"
    CHURCH_ICS_URL="$SECRET_URL" \
      STUB_CALENDAR_BODY="$marker" \
      CALENDAR_PUSH_BACKOFF=0 \
      bash "$SCRIPT" "$mode"
  ) >"$out" 2>"$err"
  CMD_CODE=$?
  set -e
  CMD_OUT="$(cat "$out")"
  CMD_ERR="$(cat "$err")"
  rm -f "$out" "$err"
  if printf '%s\n%s\n' "$CMD_OUT" "$CMD_ERR" | grep -F -q "$SECRET_URL"; then
    fail "CHURCH_ICS_URL leaked to the log"
  fi
}

assert_code() {
  if [ "$CMD_CODE" -ne "$1" ]; then
    printf 'expected exit %s, got %s\nstdout:\n%s\nstderr:\n%s\n' \
      "$1" "$CMD_CODE" "$CMD_OUT" "$CMD_ERR" >&2
    exit 1
  fi
}

assert_linear_tip() {
  local line
  line="$(git -C "$REPO/origin.git" rev-list --parents -n 1 main)"
  # shellcheck disable=SC2086
  set -- $line
  [ "$#" -eq 2 ] || fail "tip is not a single-parent commit: $line"
}

assert_origin_has() {
  local spec="$1" needle="$2" text
  text="$(git -C "$REPO/origin.git" show "main:$spec")"
  printf '%s\n' "$text" | grep -F -q "$needle" || fail "main:$spec missing [$needle]: $text"
}

tip_subject() {
  git -C "$REPO/origin.git" log -1 --format=%s main
}

echo "1. timestamp-only changes do not commit"
new_repo timestamp
write_calendar "$REPO/runner" base LATER
run_cmd publish
assert_code 0
printf '%s\n' "$CMD_OUT" | grep -F -q "No changes" || fail "expected No changes, got: $CMD_OUT"
[ "$(tip_subject)" = "init" ] || fail "origin moved on a timestamp-only run"
[ ! -f "$REPO/runner/rebuild-url.txt" ] || fail "timestamp-only run rebuilt the calendar"

echo "2. a real change pushes on the first try"
new_repo direct
write_calendar "$REPO/runner" fresh NEW
run_cmd publish
assert_code 0
printf '%s\n' "$CMD_OUT" | grep -F -q "Pushed calendar sync" || fail "missing push confirmation"
[ "$(tip_subject)" = "Sync Bay 6 Calendar" ] || fail "unexpected tip: $(tip_subject)"
[ "$(git -C "$REPO/origin.git" log -1 --format='%an %ae' main)" = "bay6-calendar-bot actions@users.noreply.github.com" ] || fail "unexpected author"
assert_origin_has data/calendar.json '["fresh"]'
assert_linear_tip
[ ! -f "$REPO/runner/rebuild-url.txt" ] || fail "clean push should not rebuild"
[ "$(git -C "$REPO/runner" rev-parse HEAD)" = "$(git -C "$REPO/origin.git" rev-parse main)" ] || fail "runner did not match origin"

echo "3. stale shallow checkout fast-forwards, then rebases over a commit that lands during the build"
new_repo stale
advance_main "queued merge" NOTES.md
git -C "$REPO/runner" checkout --detach >/dev/null 2>&1
run_cmd fast-forward
assert_code 0
[ "$(git -C "$REPO/runner" symbolic-ref HEAD)" = "refs/heads/main" ] || fail "fast-forward left a detached HEAD"
grep -F -q "queued merge" "$REPO/runner/NOTES.md" || fail "fast-forward missed the queued commit"
advance_main "during build" LATER.md
write_calendar "$REPO/runner" fresh NEW
run_cmd publish
assert_code 0
assert_origin_has NOTES.md "queued merge"
assert_origin_has LATER.md "during build"
assert_origin_has data/calendar.json '["fresh"]'
assert_linear_tip
[ "$(tip_subject)" = "Sync Bay 6 Calendar" ] || fail "rebase did not leave the sync commit on top"
[ ! -f "$REPO/runner/rebuild-url.txt" ] || fail "unrelated commits should not rebuild"

echo "4. a generated-file conflict rebuilds on the new main and keeps the other commit"
new_repo conflict
write_calendar "$REPO/writer" remote REMOTE
echo "from pr" >> "$REPO/writer/README.md"
quiet_git -C "$REPO/writer" add -- data/calendar.json calendar/ward.ics calendar/feeds README.md
quiet_git -C "$REPO/writer" commit -m "PR merge touches calendar"
quiet_git -C "$REPO/writer" push origin main
write_calendar "$REPO/runner" local LOCAL
run_cmd publish rebuilt-body
assert_code 0
printf '%s\n' "$CMD_ERR" | grep -F -q "rebuilding them on the latest main" || fail "did not rebuild: $CMD_ERR"
assert_origin_has data/calendar.json '["rebuilt-body"]'
assert_origin_has calendar/ward.ics "SUMMARY:rebuilt-body"
assert_origin_has calendar/feeds/all.ics "SUMMARY:rebuilt-body"
assert_origin_has README.md "from pr"
assert_linear_tip
[ "$(tip_subject)" = "Sync Bay 6 Calendar" ] || fail "unexpected tip after rebuild: $(tip_subject)"
[ "$(cat "$REPO/runner/rebuild-url.txt")" = "$SECRET_URL" ] || fail "rebuild was not given CHURCH_ICS_URL"
# The secret is on disk for the assertion above and must not be committed.
git -C "$REPO/origin.git" ls-tree -r --name-only main | grep -F -q "rebuild-url.txt" && fail "rebuild URL was committed"

echo "5. regenerating to a timestamp-only diff does not commit"
new_repo regenerate_noop
write_calendar "$REPO/writer" keep REMOTE
quiet_git -C "$REPO/writer" add -- data/calendar.json calendar/ward.ics calendar/feeds
quiet_git -C "$REPO/writer" commit -m "main already has this calendar"
quiet_git -C "$REPO/writer" push origin main
before="$(git -C "$REPO/origin.git" rev-parse main)"
write_calendar "$REPO/runner" changed LOCAL
run_cmd publish keep
assert_code 0
printf '%s\n' "$CMD_OUT" | grep -F -q "No changes after regenerating" || fail "expected skip after rebuild, got: $CMD_OUT"
[ "$(git -C "$REPO/origin.git" rev-parse main)" = "$before" ] || fail "timestamp-only rebuild pushed a commit"
[ "$(cat "$REPO/runner/rebuild-url.txt")" = "$SECRET_URL" ] || fail "noop rebuild did not see the URL"

echo "6. a rejected push is retried and then succeeds"
new_repo retry
count="$REPO/push-count"
cat > "$REPO/origin.git/hooks/pre-receive" << EOF
#!/bin/bash
f="$count"
n=0
if [ -f "\$f" ]; then n=\$(cat "\$f"); fi
n=\$((n + 1))
printf '%s\n' "\$n" > "\$f"
if [ "\$n" -le 2 ]; then
  echo "fetch first" >&2
  exit 1
fi
exit 0
EOF
chmod +x "$REPO/origin.git/hooks/pre-receive"
write_calendar "$REPO/runner" retried NEW
run_cmd publish
assert_code 0
[ "$(cat "$count")" -ge 3 ] || fail "expected at least 3 push attempts, got $(cat "$count")"
printf '%s\n' "$CMD_ERR" | grep -F -q "Push rejected" || fail "retry did not log the rejection: $CMD_ERR"
assert_origin_has data/calendar.json '["retried"]'
[ "$(tip_subject)" = "Sync Bay 6 Calendar" ] || fail "retry did not publish"

echo "7. a conflict outside the generated files aborts and does not push"
new_repo outside
printf 'from pr only\n' > "$REPO/writer/README.md"
quiet_git -C "$REPO/writer" add -- README.md
quiet_git -C "$REPO/writer" commit -m "PR merge"
quiet_git -C "$REPO/writer" push origin main
before="$(git -C "$REPO/origin.git" rev-parse main)"
printf 'from runner only\n' > "$REPO/runner/README.md"
quiet_git -C "$REPO/runner" add -- README.md
quiet_git -C "$REPO/runner" commit -m "local readme"
(
  cd "$REPO/runner"
  set +e
  git pull --rebase origin main >/dev/null 2>&1
  set -e
  if ! in_rebase; then
    fail "expected a rebase conflict on README"
  fi
  if conflicts_are_generated; then
    fail "README conflict was treated as generated"
  fi
  set +e
  on_rebase_conflict
  rc=$?
  set -e
  [ "$rc" -eq 1 ] || fail "outside conflict should fail, got $rc"
  if in_rebase; then
    fail "rebase was left in progress"
  fi
  if grep -F -q '<<<<<<<' README.md; then
    fail "conflict markers were left in README"
  fi
)
[ "$(git -C "$REPO/origin.git" rev-parse main)" = "$before" ] || fail "outside conflict pushed"
readme="$(git -C "$REPO/origin.git" show main:README.md)"
if printf '%s\n' "$readme" | grep -F -q "from runner"; then
  fail "runner README reached origin"
fi

echo "all calendar sync push tests passed"
