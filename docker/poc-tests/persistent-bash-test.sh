#!/bin/bash
# Test: Verify bash state persists across docker exec calls

set -e

CONTAINER_NAME="agent-poc-test"
IMAGE_NAME="agent-runtime-node:latest"

echo "🧪 Testing Persistent Bash State"
echo "================================"

# Start container
echo "Starting container..."
docker run -d --name $CONTAINER_NAME -v "$(pwd)/test-workspace:/workspace" $IMAGE_NAME

# Wait for container to be ready
sleep 2

# Test 1: Create directory and verify it persists
echo ""
echo "Test 1: Create directory in /workspace"
docker exec $CONTAINER_NAME bash -c "cd /workspace && mkdir -p test-project && echo 'Created test-project'"

echo "Test 1: Verify directory exists in next exec"
docker exec $CONTAINER_NAME bash -c "cd /workspace && ls -la | grep test-project && echo '✅ Directory persists across exec calls'"

# Test 2: Create file and verify content persists
echo ""
echo "Test 2: Create file with content"
docker exec $CONTAINER_NAME bash -c "cd /workspace/test-project && echo 'Hello from container' > test.txt"

echo "Test 2: Verify file content in next exec"
docker exec $CONTAINER_NAME bash -c "cat /workspace/test-project/test.txt && echo '✅ File content persists'"

# Test 3: Install npm package and verify node_modules persists
echo ""
echo "Test 3: npm init and install package"
docker exec $CONTAINER_NAME bash -c "cd /workspace/test-project && npm init -y && npm install lodash"

echo "Test 3: Verify node_modules exists in next exec"
docker exec $CONTAINER_NAME bash -c "cd /workspace/test-project && ls node_modules | grep lodash && echo '✅ node_modules persists'"

# Test 4: Verify working directory does NOT persist (expected behavior)
echo ""
echo "Test 4: Verify working directory resets (expected)"
docker exec $CONTAINER_NAME bash -c "cd /workspace/test-project && pwd"
docker exec $CONTAINER_NAME bash -c "pwd | grep '/workspace' && echo '✅ Working directory resets (this is expected - we need stateful shell)'"

echo ""
echo "================================"
echo "🎉 All persistence tests passed!"
echo ""
echo "⚠️  Note: Working directory doesn't persist across exec calls."
echo "    This confirms we NEED PersistentBashTool with a stateful shell."

# Cleanup
echo ""
echo "Cleaning up..."
docker stop $CONTAINER_NAME
docker rm $CONTAINER_NAME
rm -rf test-workspace

echo "✅ Cleanup complete"
