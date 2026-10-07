#!/usr/bin/env bash
# After Jekyll pretty permalinks, emit /path.html → /path/ meta-refresh redirects
# so bookmarks and in-page .html hrefs keep working.
set -euo pipefail
SITE="${1:-_site}"
count=0
while IFS= read -r -d '' index; do
  dir=$(dirname "$index")
  rel="${dir#"$SITE"}"
  rel="${rel#/}"
  # Root index: skip (no index.html → .html redirect needed at "/")
  if [[ -z "$rel" ]]; then
    continue
  fi
  html_path="$SITE/${rel}.html"
  # Do not clobber an existing file (e.g. explicit permalink: /foo.html)
  if [[ -e "$html_path" ]]; then
    continue
  fi
  mkdir -p "$(dirname "$html_path")"
  target="/${rel}/"
  cat > "$html_path" <<EOF
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${target}">
<link rel="canonical" href="${target}">
<title>Redirect</title>
</head>
<body>
<p><a href="${target}">Continued</a></p>
</body>
</html>
EOF
  count=$((count + 1))
done < <(find "$SITE" -type f -name index.html -print0)
echo "Wrote ${count} .html → pretty redirects under ${SITE}"
