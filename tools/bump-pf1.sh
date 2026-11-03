#!/bin/sh
# pf1: cache-bump edit.js (which loads editor.js with its own ?v=) and the dashboard's editor.js
# for the copy/paste-keeps-formatting change (re-runnable after a rebase).
set -e
cd "$(dirname "$0")/.."
files=$(git ls-files '*.html' '*.js' | grep -v '^edit/test/')
for a in 'edit\/edit\.js' 'edit\/editor\.js'; do
  echo "$files" | xargs grep -lE "/$a\?v=[A-Za-z0-9_.-]+" 2>/dev/null | xargs -r sed -i -E "s#/($a)\?v=[A-Za-z0-9_.-]+#/\1?v=pf1#g"
done
