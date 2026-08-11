#!/usr/bin/env bash
set -euo pipefail

## =========================================================================
##  UFW Server Hardening — Cloudflare-Only Web Traffic
## -------------------------------------------------------------------------
##  PURPOSE
##    Lock down a production web server so that:
##      - web ports (80/443) accept traffic ONLY from Cloudflare's official
##        IP ranges (attacker cannot bypass your proxy and hit the origin)
##      - SSH is restricted to YOUR admin IPs on a custom port
##      - database / cache ports (Postgres, MySQL, Redis, etc.) are closed
##        to the public internet entirely
##
##  USAGE (as root, on the TARGET server — NOT on a dev laptop):
##    Edit the three variables below, then:
##        sudo chmod +x harden-ufw.sh && sudo ./harden-ufw.sh
##
##  IMPORTANT
##    This is DESTRUCTIVE to current firewall state. Run it only on a
##    dedicated production server you intend to isolate. You must have an
##    out-of-band access path in case a rule blocks your management IP.
## =========================================================================

# ---- EDIT THESE BEFORE RUNNING ------------------------------------------
ADMIN_SSH_IPS=("203.0.113.10" "203.0.113.11")   # your static admin/VPN IPs
SSH_PORT="22"                                     # change to a custom port
allow_default_80_443="yes"                        # "yes" = also allow plain HTTP any source (or set "no")
# -------------------------------------------------------------------------

## Cloudflare's OFFICIAL published ranges (https://www.cloudflare.com/ips)
CLOUDFLARE_V4=(
  173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22
  141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20
  197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13
  104.24.0.0/14 172.64.0.0/13 131.0.72.0/22
)
CLOUDFLARE_V6=(
  2400:cb00::/32 2606:4700::/32 2803:f800::/32 2405:b500::/32
  2405:8100::/32 2a06:98c0::/29 2c0f:f248::/32
)

echo ">>> Resetting UFW to a clean, deny-by-default state"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

echo ">>> Allowing SSH on port $SSH_PORT from admin IPs only"
for ip in "${ADMIN_SSH_IPS[@]}"; do
  ufw allow from "${ip}" to any port "${SSH_PORT}" proto tcp
done

echo ">>> Allowing HTTP/HTTPS from Cloudflare ranges only"
for cidr in "${CLOUDFLARE_V4[@]}"; do
  ufw allow from "${cidr}" to any port 80 proto tcp
  ufw allow from "${cidr}" to any port 443 proto tcp
done
for cidr in "${CLOUDFLARE_V6[@]}"; do
  ufw allow from "${cidr}" to any port 80 proto tcp
  ufw allow from "${cidr}" to any port 443 proto tcp
done

if [ "${allow_default_80_443}" = "yes" ]; then
  echo ">>> (optional) Also allowing generic HTTP from anywhere for Let's Encrypt HTTP-01"
  ufw allow 80/tcp
fi

echo ">>> Explicitly BLOCKING public database & cache ports (defense in depth)"
DB_PORTS=(3306 5432 5433 5434 6379 27017 11211 2379 2380 9092 2181 2888 3888 7001 7002)
for p in "${DB_PORTS[@]}"; do
  ufw deny "${p}/tcp"
done

echo ">>> Enabling UFW"
ufw --force enable
ufw status numbered

echo
echo "Hardening applied. Verify external port scan shows 443/80 (Cloudflare) + ssh only."
