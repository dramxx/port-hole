@echo off
set PROJECT=%1
cd /d %PROJECT%
start "" opencode serve --hostname 127.0.0.1 --port 4096
timeout /t 2
start "" cmd /k "cd /d C:/dev/port-hole/server && npx tsx src/index.ts"
opencode attach http://127.0.0.1:4096