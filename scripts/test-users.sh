#!/usr/bin/env bash
# Throwaway test users for end-to-end tests against the live project.
#
#   scripts/test-users.sh create   # 2 users (test-rag-a/b@chatbotkur.test), one draft bot each
#   scripts/test-users.sh cleanup  # deletes every test-rag-* user; bots, documents,
#                                  # conversations and messages go with them (ON DELETE CASCADE)
#
# Writes keys, password, user ids, JWTs and bot ids to scripts/.test-users.env
# (gitignored) for curl/node tests to source. Never use real accounts.
set -euo pipefail

REF=ddsaqzfjcisakwfambmv
U="https://$REF.supabase.co"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$ROOT/scripts/.test-users.env"

load_keys() {
  local keys
  keys=$(supabase projects api-keys --project-ref "$REF" -o json 2>/dev/null)
  ANON=$(node -e 'const k=JSON.parse(process.argv[1]);console.log(k.find(x=>x.name==="anon").api_key)' "$keys")
  SR=$(node -e 'const k=JSON.parse(process.argv[1]);console.log(k.find(x=>x.name==="service_role").api_key)' "$keys")
}

json_field() { node -e 'const v=JSON.parse(require("fs").readFileSync(0));const r=Array.isArray(v)?v[0]:v;console.log(r[process.argv[1]])' "$1"; }

create() {
  load_keys
  local pw="TestRag-$(openssl rand -hex 8)"
  printf 'ANON=%s\nSR=%s\nPW=%s\n' "$ANON" "$SR" "$pw" > "$STATE"
  for who in a b; do
    local email="test-rag-$who@chatbotkur.test" W uid tok bot
    W=$(echo "$who" | tr a-z A-Z)
    uid=$(curl -s -X POST "$U/auth/v1/admin/users" -H "apikey: $SR" -H "Authorization: Bearer $SR" -H "Content-Type: application/json" \
      -d "{\"email\":\"$email\",\"password\":\"$pw\",\"email_confirm\":true}" | json_field id)
    tok=$(curl -s -X POST "$U/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" \
      -d "{\"email\":\"$email\",\"password\":\"$pw\"}" | json_field access_token)
    bot=$(curl -s -X POST "$U/rest/v1/bots" -H "apikey: $ANON" -H "Authorization: Bearer $tok" -H "Content-Type: application/json" -H "Prefer: return=representation" \
      -d "{\"user_id\":\"$uid\",\"name\":\"RAG Test Bot $who\",\"business_type\":\"cafe_restaurant\"}" | json_field id)
    printf 'UID_%s=%s\nTOK_%s=%s\nBOT_%s=%s\n' "$W" "$uid" "$W" "$tok" "$W" "$bot" >> "$STATE"
    echo "$email: user=${uid:0:8} bot=${bot:0:8}"
  done
  echo "state: $STATE"
}

cleanup() {
  load_keys
  local ids
  ids=$(curl -s "$U/auth/v1/admin/users?per_page=1000" -H "apikey: $SR" -H "Authorization: Bearer $SR" |
    node -e 'const r=JSON.parse(require("fs").readFileSync(0));for(const u of r.users)if(/^test-rag-.*@chatbotkur\.test$/.test(u.email))console.log(u.id)')
  for id in $ids; do
    curl -s -o /dev/null -w "deleted ${id:0:8}: HTTP %{http_code}\n" -X DELETE "$U/auth/v1/admin/users/$id" -H "apikey: $SR" -H "Authorization: Bearer $SR"
  done
  rm -f "$STATE"
  (cd "$ROOT" && supabase db query --linked "select json_build_object('test_users',(select count(*) from auth.users where email like 'test-rag-%'),'orphan_bots',(select count(*) from bots b where not exists(select 1 from auth.users u where u.id=b.user_id)))::text as verify" 2>&1 | grep '"verify"')
}

case "${1:-}" in
  create) create ;;
  cleanup) cleanup ;;
  *) echo "usage: $0 create|cleanup" >&2; exit 1 ;;
esac
