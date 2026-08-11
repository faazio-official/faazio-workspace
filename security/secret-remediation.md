# =========================================================================
#  Secrets Remediation Guide — gitignore + git-history purge
# -------------------------------------------------------------------------
#  Produced from a live scan of the 6 codebases (2026-08-11).
#
#  THREE separate problems, three separate fixes:
#    A) Future protection  -> gitignore rules (prevent NEW leaks)
#    B) Current working tree -> move secrets out of tracked files into .env
#    C) Past history          -> rewrite git history to purge old leaks
#
#  CRITICAL: gitignore + file edits do NOT remove anything already pushed.
#  If a secret was EVER in a public/shared remote, it must be ROTATED and
#  the history rewritten (git-filter-repo). Rotation ALWAYS comes first.
# =========================================================================

## ------------------------------------------------------------------------
## A) .gitignore rules to append (per repo) - PREVENT future leaks
## ------------------------------------------------------------------------
cat >> .gitignore <<'EOF'

# ---- Secrets / credentials ----
.env
.env.*
!.env.example
*.env.local
*.pem
*.key
!*.example
id_rsa
id_ed25519
*.p12
*.pkcs12
secrets/
config-secrets/
# Kubernetes Secret values
k8s/**/*secret*.yaml
k8s1/**/*secret*.yaml
EOF

## ------------------------------------------------------------------------
## B) horserun - specific: secrets hardcoded in TRACKED files
##    Move them to .env and reference env vars in compose.
## ------------------------------------------------------------------------
# docker-compose.yml (6 hardcoded credentials)
#   POSTGRES_PASSWORD=123456 x4
#   INFERX_ADMIN_APIKEY=87831cdb-...   ->  ${INFERX_ADMIN_APIKEY}
#   KEYCLOAK_CLIENT_SECRET=M2Dse...    ->  ${KEYCLOAK_CLIENT_SECRET}
# docker-compose_blob.yml (same pattern)
# config/models.txt (plaintext IFERX_APIKEY + IFERX_SECRET) -> delete/redact

# Example fix for compose:
#   environment:
#     - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
#     - INFERX_ADMIN_APIKEY=${INFERX_ADMIN_APIKEY}
#     - KEYCLOAK_CLIENT_SECRET=${KEYCLOAK_CLIENT_SECRET}

## ------------------------------------------------------------------------
## C) git-history purge (MUST have rotated creds first!)
##    Installs git-filter-repo, rewrites ALL history to strip the leaked
##    secrets from every past commit, then force-pushes all branches/tags.
## ------------------------------------------------------------------------

# 1) Install git-filter-repo
#    Debian/Ubuntu:
#        sudo apt-get install git-filter-repo
#    or pip:
#        pip install git-filter-repo

# 2) Clone a FRESH mirror (never run on your working copy)
cd /tmp
git clone --mirror git@<your-remote>:org/repo.git purge-repo
cd purge-repo

# 3) Strip the file paths that ever contained secrets
git filter-repo \
  --path docker-compose.yml \
  --path docker-compose_blob.yml \
  --path config/models.txt \
  --path k8s/billing-secrets.yaml \
  --path k8s/gateway.yaml \
  --path k8s/inferx_debugone.yaml \
  --invert-paths

# 4) Force-push rewritten history (DANGEROUS - history changes for everyone)
git push --force --all
git push --force --tags

# 5) For secrets in .env that may have been in history cross-repo:
#    Repeat clone+filter-repo per affected repo:
#      uc-school, hicore-workspace, Schools24-Workspace (if any .env was ever
#      committed), upcraft-engine, faazio-workspace

## ------------------------------------------------------------------------
## D) ALWAYS rotate AFTER exposing (even after purge). Order matters:
##    1. Rotate credentials now (kills whatever attacker has)
##    2. Purge history
##    3. Add gitignore rules
## =========================================================================
