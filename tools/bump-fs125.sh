#!/bin/sh
# fs125: cache-bump every asset touched by the 125%-look text scale (--fs 1.5094, rail 275px)
# (re-runnable after a rebase).
set -e
cd "$(dirname "$0")/.."
files=$(git ls-files '*.html' '*.js' | grep -v '^edit/test/')
for a in 'html\.css' 'styles\.css' 'ghostly\.css' 'edit\/edit\.css' 'edit\/edit\.js' 'edit\/editor\.js' 'article-siblings\.js' 'atlas-hotspots\.js' 'calendar-timeline\.js' 'journal-chapnav\.js' 'journal-order\.js' 'mention-links\.js' 'players\/player\.js' 'search\.js' 'skip-link\.js' 'codex\.css' 'drop-float\.js' 'journal-toc\.js' 'section-bar\.js'; do
  echo "$files" | xargs grep -lE "(^|[^A-Za-z0-9_-])$a\?v=[A-Za-z0-9_.-]+" 2>/dev/null | xargs -r sed -i -E "s#(^|[^A-Za-z0-9_-])($a)\?v=[A-Za-z0-9_.-]+#\1\2?v=fs125#g"
done
