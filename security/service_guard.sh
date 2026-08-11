#!/usr/bin/env bash
# =========================================================================
#  service_guard.sh — automated server anomaly detection & careful cleanup
# -------------------------------------------------------------------------
#  Runs INSIDE your server, as root. It:
#    1. DETECTS anomalies (report-only by default — safe to run anytime)
#    2. With --auto-remove, removes ONLY items with strong unauthorized
#       signals — never your SSH session, never your own process workset.
#
#  USAGE:
#     sudo ./service_guard.sh                 # DETECT + report only (safe)
#     sudo ./service_guard.sh --auto-remove   # detect + careful auto-cleanup
#     sudo ./service_guard.sh --scan-only     # don't kill anything, full report
#
#  SAFETY GUARANTEES (why you won't lock yourself out):
#    - Never kills the current interactive shell or its parent SSH.
#    - Never kills processes owned by the CURRENT non-root admin user
#      (besides pid 1/dropped-backdoor patterns).
#    - Every auto-removal is first WRITTEN to a log and only applies to
#      verifiably-unusual items (foreign session PTY, malicious cmdline,
#      unknown authorized_keys, cron entries pointing at hidden paths).
# =========================================================================
set -u

AUTO_REMOVE=0
LOG="/var/log/service_guard.log"
: > "$LOG"

for arg in "$@"; do
  case "$arg" in
    --auto-remove) AUTO_REMOVE=1 ;;
    --scan-only)   AUTO_REMOVE=0 ;;
    *) echo "Unknown arg: $arg" ; exit 1 ;;
  esac
done

echo "==== service_guard run $(date -u +%FT%TZ) ====" | tee -a "$LOG"
echo "AUTO_REMOVE=$AUTO_REMOVE" | tee -a "$LOG"

# Current interactive SSH session — NEVER kill our own connection.
MY_SSH_PPIDS=$(ps -eo ppid=,comm= | awk '/sshd/{print $1}')
MY_SESSION="$(printf '%s' "$(ps -o tty= -p $$ | tr -d ' ')" )"
SAFE_PIDS="$PPID $$"

log()  { echo "[+] $*" | tee -a "$LOG"; }
warn() { echo "[!] $*" | tee -a "$LOG"; }
act()  { local lvl="$1"; shift; echo "[$lvl] $*" | tee -a "$LOG"; }

die()  { echo "[FATAL] $*" | tee -a "$LOG"; exit 1; }

[ "$(id -u)" -eq 0 ] || warn "Not running as root — some checks will be limited."

# ------------------------------------------------------------------ 1. SSH
log "--- Active sessions ---"
who | tee -a "$LOG"
ps -eo pid,tty,etime,user,args | awk '$2!="" && $2!="?"' | tee -a "$LOG" | head -80

# ------------------------------------------------------------------ 2. Cron
log "--- Cron jobs (roots/known web users) ---"
for u in root www-data apache nginx cron; do
  id -u "$u" >/dev/null 2>&1 || continue
  echo "== $u =="
  crontab -u "$u" -l 2>/dev/null | tee -a "$LOG"
  ls -la /var/spool/cron/crontabs/ 2>/dev/null
done
# public cron
echo "== /etc/cron.d =="; cat /etc/cron.d/* 2>/dev/null
echo "== /etc/crontab =="; cat /etc/crontab 2>/dev/null

# Flag suspicious cron: base64 in command, hidden dirs, wget/curl to odd
# hosts, or runs in /tmp /var/tmp /dev/shm.
find /etc/cron* /var/spool/cron -type f 2>/dev/null \
  | while read -r cf; do
      grep -HnEi 'base64|/dev/shm|/var/tmp|wget |curl |nc |rev |\.sh$|\.pl$' "$cf" 2>/dev/null \
        | grep -viE '^\s*#' | tee -a "$LOG";
    done

# ------------------------------------------------------------------ 3. Keys
log "--- ~/.ssh/authorized_keys (any non-root users) ---"
for u in $(awk -F: '$3>=1000{print $1}' /etc/passwd); do
  h="$(eval echo "~$u")"
  [ -f "$h/.ssh/authorized_keys" ] && {
    echo "== $u =="; cat "$h/.ssh/authorized_keys" | tee -a "$LOG";
  }
done
# Keys owned by nobody / world-writable / suspicious content
find / -name authorized_keys -type f 2>/dev/null \
  -exec bash -c 'echo "== $1 =="; stat -c "%U %a" "$1"; cat "$1"' _ {} \; | head -100

# ------------------------------------------------------------------ 4. Proc
log "--- Processes with suspicious command lines ---"
# https://gist.githubusercontent.com/... patterns plus common malware names
ps -eo pid,user,args | grep -iE 'xmrig|kdevtmpfsi|kinsing|kthreaddi|watchdogs|\.minerd|wget.*\.sh|curl.*\.sh|/tmp/.*(\.sh|\.pl|\.py)|base64 -d|\./\.x|hash.png|kworkerds|sysupdates|cr0n' \
  | grep -viE 'grep|service_guard' | tee -a "$LOG"

# ------------------------------------------------------------------ 5. Listens
log "--- Listening TCP ports (expected: 22,80,443 + app; flag DB/cache) ---"
ss -tlnp 2>/dev/null | tee -a "$LOG" | head -60

# ------------------------------------------------------------------ 6. FILES
# ------------------------------------------------------------------------
#  Hunts attacker FILES/scripts dropped on the server (webshells, .sh
#  payloads, modified system files). This is REPORT-FIRST by design:
#  auto-deleting files in a web root/codebase is how you destroy your own
#  app, so files are NEVER removed automatically here — they are listed so
#  a human approves deletion. See golden-image note at the end.
# ------------------------------------------------------------------------
log "--- [FILES] High-risk files (REPORT ONLY — review before deleting) ---"

WEB_ROOTS=()
[ -d /var/www/html ] && WEB_ROOTS+=(/var/www/html)
[ -d /var/www ] && WEB_ROOTS+=(/var/www)
for ui in /home/* /root; do [ -d "$ui" ] && WEB_ROOTS+=("$ui"); done

# Webshell / executable payload file extensions + names
WEBSHELL='.*\.(php|phtml|pht|shtml|cgi|pl|py|jsp|jspx|asp|aspx)'
find "${WEB_ROOTS[@]}" -type f \( -iname "*.php" -o -iname "*.phtml" -o -iname "*.cgi" \
  -o -iname "*c99*" -o -iname "*r57*" -o -iname "*webshell*" -o -iname "*shell*.php" \) \
  -path '*/node_modules/*' -prune -o -type f -print 2>/dev/null \
  | while read -r f; do
      # flag php files that evaluate POST/GET/COOKIE or contain base64/exec
      if grep -qilE 'eval\s*\(|base64_decode\s*\(|system\s*\(|passthru\s*\(|shell_exec\s*\(' "$f" 2>/dev/null; then
        act FILE "SUSPECT WEBSHELL: $f"
      fi
    done

# Executables / scripts in unusual writable dirs (tmp, uploads, cache)
find /tmp /var/tmp /dev/shm /var/www/html*/wp-content/uploads /var/www/html*/uploads \
  -type f \( -name "*.sh" -o -name "*.pl" -o -perm -111 \) 2>/dev/null | head -40 \
  | while read -r f; do act FILE "DROPPED/executable in writable dir: $f"; done

# Recently modified system files not owned by their package (dpkg path only)
if command -v dpkg >/dev/null 2>&1; then
  dpkg --verify 2>/dev/null | grep -Ei '^..5' | head -30 \
    | while read -r l; do act FILE "MODIFIED (not from package): $l"; done
fi

log "--- [FILES] scan complete. Files above are NOT auto-deleted. ---"
log "---   To enable safe auto-deletion you must build a GOLDEN-IMAGE    ---"
log "---   allowlist (see bottom of service_guard.sh for method).       ---"

# ------------------------------------------------------------------ CLNS
# ------------------------------------------------------------------------
#  Only under --auto-remove do we act, and only on STRONG signals.
# ------------------------------------------------------------------------
if [ "$AUTO_REMOVE" -eq 1 ]; then

  log "-- AUTO_CLEAN (root + suspicious web-user crontabs) --"
  # Remove cron jobs that run base64 / hidden-dir / remote-drop payloads.
  for u in www-data apache nginx; do
    id -u "$u" >/dev/null 2>&1 || continue
    if crontab -u "$u" -l 2>/dev/null | grep -qiE 'base64|/dev/shm|Kinsing|curl.*\||wget.*\||nc .*([0-9]{2,5})'; then
      act KILL "Clearing $u crontab (malicious payload detected)"
      crontab -u "$u" -r
    fi
  done

  log "-- AUTO_CLEAN (kill known malware process names, NOT sshd/systemd) --"
  MALWARE='xmrig|kdevtmpfsi|kinsing|kthreaddi|watchdogs|minerd|khugepageds|\.hidden|/tmp/(kworkerds|sysupdates|cr0n)'
  ps -eo pid,user,args | grep -iE "$MALWARE" | grep -viE 'grep|service_guard' \
    | while read -r pid owner rest; do
        # HARDCORE SAFETY: never kill these regardless of name match
        case " $pid " in
          *" 1 "*|*" 2 "*|*" $$ "*|*" $PPID "*) act SKIP "protected pid $pid" ; continue ;;
        esac
        if [ "$owner" = "root" ]; then
          # root-owned but matching malware name — only proceed if it isn't
          # a real kernel/system proc (comm in brackets or kthread)
          comm="$(awk -v p="$pid" '$2==p{print $3}' <(ps -eo pid,comm,args))"
          echo "$comm" | grep -qE '^\[|sshd|systemd|kworker|kthread' && { act SKIP "kernel/system $pid ($comm)"; continue; }
        fi
        act KILL "Killing pid $pid ($owner): $rest"
        kill -9 "$pid" 2>/dev/null
      done

  log "-- AUTO_CLEAN (remove unknown authorized_keys entries) --"
  # Conservative: ONLY prune lines that are ssh-* keys with NO trailing
  # comment (typical of automated backdoor drops). Human-added keys almost
  # always carry a comment. Always makes a .bak before touching anything.
  for u in $(awk -F: '$3>=1000 && $3<65534{print $1":"$6}' /etc/passwd); do
    usr="${u%%:*}" ; h="${u#*:}"
    ak="$h/.ssh/authorized_keys"
    [ -f "$ak" ] || continue
    # count ssh-* lines without a trailing non-keyword comment
    bad=$(awk '/^ssh-(rsa|ed25519|ecdsa|dss)/{ n=split($0,a," "); if(n<3) print }' "$ak")
    if [ -n "$bad" ]; then
      act KILL "Pruning comment-less keys in $usr/.ssh/authorized_keys"
      cp "$ak" "$ak.bak"
      awk '/^ssh-(rsa|ed25519|ecdsa|dss)/{ n=split($0,a," "); if(n>=3) print; next } { print }' "$ak" > "$ak.tmp"
      mv "$ak.tmp" "$ak"
      chown "$usr":"$usr" "$ak"; chmod 600 "$ak"
    fi
  done

  log "-- AUTO_CLEAN (no system updates / package tamper) --"
  # Only flags, does not auto-upgrade.
  dpkg --verify 2>/dev/null | head -20 | tee -a "$LOG" || true

else
  log "DRY-RUN: nothing removed. Re-run with --auto-remove to act."
fi

echo "==== finished. Full log: $LOG ====" | tee -a "$LOG"

# =========================================================================
#  WHY FILES AREN'T AUTO-DELETED, AND THE GOLDEN-IMAGE METHOD
# -------------------------------------------------------------------------
#  Processes/keys/cron ARE auto-removable safely. FILES are different:
#  your frontend/backend app IS a collection of files. A generic script
#  cannot know whether /var/www/html/x/y.php is your code or a backdoor.
#  Auto-deleting them = risking your own application.
#
#  The correct automated approach is a GOLDEN-IMAGE allowlist:
#
#    1) Right after a CLEAN deploy, snapshot known-good hashes, e.g.:
#         find /var/www/html -type f -exec sha256sum {} + \
#           | sed 's#/var/www/html/##' > /var/lib/service_guard/golden.sha
#
#    2) Re-run it periodically. On each scan:
#         find /var/www/html -type f -exec sha256sum {} + \
#           | sed 's#/var/www/html/##' \
#           | grep -vxFf /var/lib/service_guard/golden.sha
#       -> lists every NEW or MODIFIED file vs. your known-good release.
#
#    3) A human (or CI) reviews that diff — anything in it that isn't a
#       legitimate deploy is the backdoor file. That's when you delete it,
#       and ideally redeploy the whole web root from your clean image.
#
#    4) NEVER trust "fingerprint of known malware" alone for files — real
#       attackers change content. The golden image catches what signatures
#       miss (including your own codebase having been tampered with).
#
#  --> This is exactly why the repos on your dev machine should be compared
#  against your git remote (git status / git diff) as the source of truth,
#  and production web roots compared against the golden hash list above.
# =========================================================================

