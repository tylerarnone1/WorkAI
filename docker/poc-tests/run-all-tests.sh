#!/bin/bash
# Run all PoC tests

set -e

echo "🚀 Running All PoC Tests"
echo "========================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if image exists, if not build it
if ! docker image inspect agent-runtime-node:latest > /dev/null 2>&1; then
    echo "📦 Building agent-runtime-node image..."
    cd ..
    docker build -f agent-runtime-node.Dockerfile -t agent-runtime-node:latest .
    cd poc-tests
    echo "✅ Image built successfully"
    echo ""
fi

# Create test workspace directory
mkdir -p test-workspace

# Run tests
echo "Running Test 1: Persistent Bash State"
echo "======================================"
bash persistent-bash-test.sh
echo ""
echo ""

echo "Running Test 2: Playwright Screenshot"
echo "======================================"
bash playwright-test.sh
echo ""
echo ""

echo "Running Test 3: Port Isolation"
echo "======================================"
bash port-isolation-test.sh
echo ""
echo ""

echo "========================"
echo "✅ All PoC Tests Passed!"
echo "========================"
echo ""
echo "Summary:"
echo "  ✅ File persistence works (volume mounts)"
echo "  ✅ Playwright screenshots work"
echo "  ✅ Port isolation works"
echo ""
echo "⚠️  Note: Working directory doesn't persist across docker exec."
echo "    Solution: Build PersistentBashTool with stateful shell session."
echo ""
echo "🚀 Ready to proceed with full implementation!"
