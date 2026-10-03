#!/usr/bin/env bash

set -euo pipefail

base_url="${GATEWAY_URL:-https://gateway-demo.pnlflex.xyz}"
base_usdc="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
missing_token="0x0000000000000000000000000000000000000001"

request() {
  local label="$1"
  local path="$2"

  printf '\n%s\n' "--- ${label} ---"
  curl --silent --show-error --write-out '\nHTTP %{http_code}\n' "${base_url}${path}"
}

request "service manifest" "/"
request "health" "/health"
request "real Base token" "/v1/token/base/${base_usdc}"
request "same token, cache now visible" "/v1/token/base/${base_usdc}"
request "valid address without provider data" "/v1/token/base/${missing_token}"
request "invalid address rejected at the boundary" "/v1/token/base/not-an-address"
