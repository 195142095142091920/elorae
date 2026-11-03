#!/bin/sh
# ic1: cache-bump the files the image captions changed (re-runnable after a rebase).
set -e
cd "$(dirname "$0")/.."
files=$(git ls-files '*.html' '*.js' | grep -v '^edit/test/')
for a in 'edit\/edit\.js' 'html\.css' 'journal-zoom\.js'; do
  echo "$files" | xargs grep -lE "/$a\?v=[A-Za-z0-9_.-]+" 2>/dev/null | xargs -r sed -i -E "s#/($a)\?v=[A-Za-z0-9_.-]+#/\1?v=ic1#g"
done
