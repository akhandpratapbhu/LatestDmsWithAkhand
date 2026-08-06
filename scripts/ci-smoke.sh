#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000/api/v1}"
EMAIL="ci-$(date +%s)@configure.local"
PASSWORD="Password1"

echo "==> Health"
curl -sf "$BASE_URL/health" | grep -q '"status":"ok"'

echo "==> Register"
curl -sf -X POST "$BASE_URL/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"firstName\":\"CI\",\"lastName\":\"Bot\"}" \
  | grep -q '"success":true'

echo "==> Login"
LOGIN_JSON=$(curl -sf -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"deviceName\":\"CI\"}")

ACCESS=$(node -e 'const j=JSON.parse(process.argv[1]); if(!j.data?.tokens?.accessToken) process.exit(1); console.log(j.data.tokens.accessToken)' "$LOGIN_JSON")
REFRESH=$(node -e 'const j=JSON.parse(process.argv[1]); console.log(j.data.tokens.refreshToken)' "$LOGIN_JSON")

echo "==> Me"
curl -sf "$BASE_URL/auth/me" -H "Authorization: Bearer $ACCESS" | grep -q "$EMAIL"

echo "==> Refresh"
curl -sf -X POST "$BASE_URL/auth/refresh" \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}" \
  | grep -q '"accessToken"'

echo "==> Logout"
curl -sf -X POST "$BASE_URL/auth/logout" \
  -H "Authorization: Bearer $ACCESS" \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}" \
  | grep -q '"success":true'

echo "Smoke tests passed"
