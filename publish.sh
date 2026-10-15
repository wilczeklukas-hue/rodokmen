#!/bin/bash
# Usage: ./publish.sh "co se změnilo"
# validate + build -> commit/push web -> commit/push main repo -> wait until GitHub Pages serves the new build.
set -euo pipefail
cd "$(dirname "$0")"
MSG="${1:?Použití: ./publish.sh \"popis změny\"}"
URL="https://wilczeklukas-hue.github.io/rodokmen/"
./build.sh
BUILD_ID=$(cat .build-id)
git add -A
git commit -qm "$MSG" || echo "web: nic k commitu"
git push -q
(cd .. && git add -A && (git commit -qm "$MSG" || echo "hlavní repo: nic k commitu") && git push -q)
echo "Čekám na GitHub Pages…"
ok=0
for i in $(seq 1 40); do
  if curl -fsSL "$URL?nocache=$RANDOM$RANDOM" 2>/dev/null | grep -q "content=\"$BUILD_ID\""; then ok=1; break; fi
  sleep 15
done
if [ $ok = 1 ]; then echo "Pages servíruje nové sestavení ($BUILD_ID): $URL"; else echo "VAROVÁNÍ: Pages zatím nevrací nové sestavení ($BUILD_ID)"; exit 1; fi
# new images must return HTTP 200
node -e 'const T=require("./datatool");for(const p of T.load().people)for(const s of p.scans||[])console.log(s.f)' | sort -u | while read -r f; do
  code=0
  for i in 1 2 3 4 5 6 7 8; do code=$(curl -s -o /dev/null -w '%{http_code}' "$URL$f"); [ "$code" = 200 ] && break; sleep 15; done
  [ "$code" = 200 ] || { echo "CHYBA: $f vrací $code"; exit 1; }
done
echo "Hotovo."
