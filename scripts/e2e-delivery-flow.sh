#!/usr/bin/env bash
# e2e-delivery-flow.sh — end-to-end contract sequence for the COD order + delivery fulfilment
# workflows, driven against a real local Postgres.
#
# The sequence (place COD order -> pay -> rider accept -> seller-QR pickup -> payment received ->
# customer OTP -> delivered -> order feedback) is executed by the gateway's HTTP handlers + real
# repos via httptest. It is the same contract the live client/server agree on, and it runs with no
# Gradle and no device.
#
# Why httptest + not a curl loop: the production router authenticates with Firebase/Supabase bearer
# tokens (no dev bypass), so an out-of-process script cannot mint an identity without prod secrets.
# The tests inject identity through the same `authtest` seam used across the gateway suite.
#
# Prereqs: the local docker stack (postgres:5432, valkey:6379) is up and migrated
# (see server/gateway/README.md). Override with TEST_DATABASE_URL / TEST_VALKEY_URL.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATEWAY="$ROOT/server/gateway"

export TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgres://postgres:faazio@localhost:5432/faazio?sslmode=disable}"
export TEST_VALKEY_URL="${TEST_VALKEY_URL:-redis://localhost:6379/0}"

echo "== Faazio E2E contract sequence =="
echo "DB      : ${TEST_DATABASE_URL}"
echo "Valkey  : ${TEST_VALKEY_URL}"
echo

cd "$GATEWAY"

echo "-- Workflow 1: place COD order + pay order --"
go test -count=1 -v ./internal/checkout -run \
  'TestPlaceOrderCODHappyPathTransaction|TestPlaceOrderIdempotencyReplay|TestPayOrderCODCreatesReceiptAndInvalidatesCache'

echo "-- Workflows 2-6: rider accept/reject, pickup QR, payment gate, OTP delivery --"
go test -count=1 -v ./internal/delivery -run 'TestDelivery'

echo "-- Workflow 7: order feedback --"
go test -count=1 -v ./internal/reviews -run 'TestOrderFeedback'

echo
echo "E2E contract sequence passed."