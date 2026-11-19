#!/usr/bin/env bash
# Commit the generated Bay 6 calendar and push it onto the latest main.
# A scheduled run checks out main as of queue time, so another merge can land
# before git push. Rebase onto the new main and retry. If that rebase conflicts
# only in generated files, rebuild them on the new main instead of failing.
# Never print CHURCH_ICS_URL.
set -euo pipefail

MAX_PUSH_ATTEMPTS="${CALENDAR_PUSH_ATTEMPTS:-4}"

generated_path() {
  case "$1" in
    data/calendar.json|calendar/ward.ics|calendar/feeds|calendar/feeds/*) return 0 ;;
    *) return 1 ;;
  esac
}

ensure_on_main() {
  # actions/checkout can leave a detached HEAD at the scheduled SHA.
  if ! git symbolic-ref -q HEAD >/dev/null; then
    git checkout -B main
  fi
}

prepare_git() {
  export GIT_TERMINAL_PROMPT=0
  export GIT_EDITOR=:
  export GIT_SEQUENCE_EDITOR=:
  ensure_on_main
}

# Fast-forward a clean checkout so the build uses main as it is now, not as of
# when the schedule was queued. Fails closed if main was rewritten.
fast_forward_main() {
  prepare_git
  git fetch origin main
  git merge --ff-only origin/main
}

# 0 = committed, 1 = timestamp-only or no diff, 2 = git failure.
commit_if_changed() {
  git add -- data/calendar.json calendar/ward.ics calendar/feeds || return 2
  # Ignore a timestamp-only refresh ("generated" in calendar.json, DTSTAMP in the ICS)
  # so an unchanged feed does not commit every 8 hours.
  if git diff --cached --quiet -I '"generated"' -I '^DTSTAMP'; then
    return 1
  fi
  git commit -m "Sync Bay 6 Calendar" || return 2
  return 0
}

rebuild_calendar() {
  if [ -z "${CHURCH_ICS_URL:-}" ]; then
    echo "CHURCH_ICS_URL is not set; refusing to rebuild the calendar" >&2
    return 1
  fi
  python3 tools/build_calendar.py "$CHURCH_ICS_URL" > /dev/null || return 1
}

in_rebase() {
  local path
  path="$(git rev-parse --git-path rebase-merge)"
  [ -d "$path" ] && return 0
  path="$(git rev-parse --git-path rebase-apply)"
  [ -d "$path" ]
}

conflicts_are_generated() {
  local file any=0 bad=0
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    any=1
    if ! generated_path "$file"; then
      echo "Conflict in non-generated file: $file" >&2
      bad=1
    fi
  done < <(git diff --name-only --diff-filter=U)
  [ "$any" -eq 1 ] && [ "$bad" -eq 0 ]
}

# 0 = ready to push (or NOTHING_TO_PUSH=1), 1 = fatal conflict or rebuild failure.
on_rebase_conflict() {
  local rc
  NOTHING_TO_PUSH=0
  if ! conflicts_are_generated; then
    echo "Rebase conflict outside generated calendar files" >&2
    git diff --name-only --diff-filter=U >&2 || true
    git rebase --abort || return 1
    return 1
  fi
  echo "Rebase conflicted on generated calendar files; rebuilding them on the latest main" >&2
  git diff --name-only --diff-filter=U >&2 || true
  git rebase --abort || return 1
  git reset --hard origin/main || return 1
  rebuild_calendar || return 1
  commit_if_changed
  rc=$?
  if [ "$rc" -eq 1 ]; then
    echo "No changes after regenerating"
    NOTHING_TO_PUSH=1
    return 0
  fi
  return "$rc"
}

backoff_seconds() {
  local attempt="$1"
  local base="${CALENDAR_PUSH_BACKOFF:-2}"
  echo $((attempt * base))
}

publish() {
  local attempt rc
  prepare_git
  git config user.name "bay6-calendar-bot"
  git config user.email "actions@users.noreply.github.com"

  set +e
  commit_if_changed
  rc=$?
  set -e
  if [ "$rc" -eq 1 ]; then
    echo "No changes"
    exit 0
  fi
  if [ "$rc" -ne 0 ]; then
    exit "$rc"
  fi

  for attempt in $(seq 1 "$MAX_PUSH_ATTEMPTS"); do
    set +e
    git pull --rebase origin main
    rc=$?
    set -e
    if [ "$rc" -ne 0 ]; then
      if in_rebase; then
        set +e
        on_rebase_conflict
        rc=$?
        set -e
        if [ "$rc" -ne 0 ]; then
          exit "$rc"
        fi
        if [ "${NOTHING_TO_PUSH:-0}" -eq 1 ]; then
          exit 0
        fi
      else
        echo "git pull --rebase failed (attempt ${attempt}/${MAX_PUSH_ATTEMPTS})" >&2
        if [ "$attempt" -eq "$MAX_PUSH_ATTEMPTS" ]; then
          exit 1
        fi
        sleep "$(backoff_seconds "$attempt")"
        continue
      fi
    fi

    set +e
    git push origin HEAD:main
    rc=$?
    set -e
    if [ "$rc" -eq 0 ]; then
      echo "Pushed calendar sync"
      exit 0
    fi
    echo "Push rejected (attempt ${attempt}/${MAX_PUSH_ATTEMPTS}); will fetch, rebase, and retry" >&2
    if [ "$attempt" -eq "$MAX_PUSH_ATTEMPTS" ]; then
      exit 1
    fi
    sleep "$(backoff_seconds "$attempt")"
  done
  echo "Failed to push calendar sync after ${MAX_PUSH_ATTEMPTS} attempts" >&2
  exit 1
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  case "${1:-publish}" in
    fast-forward) fast_forward_main ;;
    publish) publish ;;
    *)
      echo "usage: commit_calendar.sh [fast-forward|publish]" >&2
      exit 2
      ;;
  esac
fi
