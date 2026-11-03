#!/bin/sh
# vt1: cache-bump the files the visibility toggle changed (re-runnable after a rebase).
set -e
cd "$(dirname "$0")/.."
files=$(git ls-files '*.html' '*.js' | grep -v '^edit/test/')
for a in 'edit/edit\.js' 'login\.js' 'html\.css' 'peek\.js' 'search\.js' 'mention-links\.js' 'index-scroll\.js' 'rail-sections\.js' 'vis-gate\.js'; do
  echo "$files" | xargs grep -lE "/$a\?v=[A-Za-z0-9_.-]+" 2>/dev/null | xargs -r sed -i -E "s#/($a)\?v=[A-Za-z0-9_.-]+#/\1?v=vt1#g"
done
