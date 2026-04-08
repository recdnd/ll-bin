#!/bin/bash
# ll-bin：在本專案根目錄提交並推送到 GitHub（排除 interview-prep）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "📁 ll-bin：$SCRIPT_DIR"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "ℹ️  這裡還不是 Git 儲存庫，正在初始化..."
  git init
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  DEFAULT_REMOTE="https://github.com/recdnd/ll-bin.git"
  REMOTE_URL="${2:-$DEFAULT_REMOTE}"
  echo "🔗 設定 origin: $REMOTE_URL"
  git remote add origin "$REMOTE_URL"
fi

BRANCH="$(git branch --show-current || true)"
if [ -z "${BRANCH:-}" ]; then
  BRANCH="main"
  git checkout -b "$BRANCH"
fi

REMOTE="${GIT_REMOTE:-origin}"
MSG="${1:-Update ll-bin}"
PORT="${PORT:-8000}"
while lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

echo "🔄 分支：$BRANCH → 遠端：$REMOTE"

git add -A . ":!interview-prep"

if git diff --cached --quiet; then
  echo "（暫無需提交的變更）"
else
  echo "💾 提交：$MSG"
  git commit -m "$MSG"
fi

echo "⬆️  推送 $REMOTE $BRANCH ..."
git push -u "$REMOTE" "$BRANCH"

echo ""
echo "✅ 已同步到 GitHub。"
echo "🌍 CNAME: ll.bin.ooo"
echo ""
echo "🌐 本機預覽 http://127.0.0.1:${PORT}/ （Ctrl+C 結束）"
if command -v open >/dev/null 2>&1; then
  open "http://127.0.0.1:${PORT}/" || true
fi
exec python3 -m http.server "$PORT"
