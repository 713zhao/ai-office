#!/bin/zsh
cd "${0:A:h}"
if curl --silent --fail http://127.0.0.1:5173/ >/dev/null; then
  open http://127.0.0.1:5173/
  exit 0
fi
npm run dev -- --strictPort &
office_pid=$!
sleep 2
open http://127.0.0.1:5173/
wait $office_pid
