#!/bin/bash
# AI Nav API 本地服务启动脚本
# 用法: bash start-api-server.sh

API_KEY="sk-e7f07dba4b66481496f1a85bc2d3da9d"
PORT=8765

# Start Deno server in background
echo "Starting Deno API server on port $PORT ..."
export PATH="$HOME/.deno/bin:$PATH"
DEEPSEEK_API_KEY="$API_KEY" deno run --allow-net --allow-env \
  /Users/lasky_my/ai-nav/worker/local-server.js \
  > /tmp/deno-api-server.log 2>&1 &
DENO_PID=$!
echo "Deno server PID: $DENO_PID"

# Wait for server to be ready
sleep 2

# Start localtunnel
echo "Starting localtunnel ..."
npx localtunnel --port $PORT > /tmp/localtunnel-url.txt 2>&1 &
LT_PID=$!
echo "Tunnel PID: $LT_PID"

# Wait and show URL
sleep 6
URL=$(grep -o 'https://[^ ]*\.loca\.lt' /tmp/localtunnel-url.txt | head -1)
echo ""
echo "============================================"
echo "  API URL: $URL"
echo "============================================"
echo ""
echo "Run the following to stop:"
echo "  kill $DENO_PID $LT_PID"
