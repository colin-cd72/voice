#!/bin/bash
# Deploy script for voice.co-l.in
# Usage: ./deploy.sh
#
# Requires an SSH alias `voice` in ~/.ssh/config pointing at the VPS, e.g.:
#   Host voice
#       HostName 82.25.86.219
#       User root
#       IdentityFile ~/.ssh/teachmegrandma
#
# CloudPanel: create a Node.js site for voice.co-l.in first.
# Site path on the VPS will typically be:
#   /home/voice/htdocs/voice.co-l.in

set -e

SERVER="voice"
REMOTE_PATH="/home/voice/htdocs/voice.co-l.in"
APP_PORT="${APP_PORT:-5180}"

echo "==> deploying to voice.co-l.in"

echo "==> git pull on server"
ssh "$SERVER" "cd $REMOTE_PATH && git pull origin main"

echo "==> install server deps"
ssh "$SERVER" "cd $REMOTE_PATH/server && npm install --omit=dev"

echo "==> install client deps + build"
ssh "$SERVER" "cd $REMOTE_PATH/client && npm install && npm run build"

echo "==> restart express"
ssh "$SERVER" "PID=\$(lsof -t -i:$APP_PORT 2>/dev/null || true); if [ -n \"\$PID\" ]; then kill \$PID; sleep 1; fi; cd $REMOTE_PATH/server && nohup node src/index.js > ../server.log 2>&1 &"
sleep 2

echo "==> verify"
ssh "$SERVER" "ss -tlnp | grep :$APP_PORT && echo 'server running on port $APP_PORT'"

echo "==> done. tail logs with:  ssh $SERVER 'tail -f $REMOTE_PATH/server.log'"
