#!/bin/bash
# Test: Verify Playwright can take screenshots inside container

set -e

CONTAINER_NAME="agent-poc-playwright"
IMAGE_NAME="agent-runtime-node:latest"

echo "🧪 Testing Playwright Screenshot Capture"
echo "========================================"

# Start container
echo "Starting container..."
docker run -d --name $CONTAINER_NAME -v "$(pwd)/test-workspace:/workspace" -p 3000:3000 $IMAGE_NAME

# Wait for container to be ready
sleep 2

# Create a simple HTML page
echo ""
echo "Creating test HTML page..."
docker exec $CONTAINER_NAME bash -c "cat > /workspace/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Agent PoC Test</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 40px;
            background: rgba(255,255,255,0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
        }
        h1 { font-size: 48px; margin: 0; }
        p { font-size: 24px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class=\"container\">
        <h1>🤖 AI Agent PoC</h1>
        <p>If you can see this, Playwright is working!</p>
    </div>
</body>
</html>
EOF
"

# Start HTTP server
echo "Starting HTTP server on port 3000..."
docker exec -d $CONTAINER_NAME bash -c "cd /workspace && python3 -m http.server 3000"

# Wait for server to start
sleep 3

# Install playwright locally in workspace
echo ""
echo "Installing playwright package locally..."
docker exec $CONTAINER_NAME bash -c "cd /workspace && npm init -y && npm install playwright"

# Create Playwright screenshot script
echo ""
echo "Creating Playwright screenshot script..."
docker exec $CONTAINER_NAME bash -c "cat > /workspace/screenshot.js << 'EOF'
const { chromium } = require('playwright');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  console.log('Taking screenshot...');
  await page.screenshot({ path: '/workspace/screenshot.png', fullPage: true });

  console.log('✅ Screenshot saved to /workspace/screenshot.png');
  await browser.close();
})();
EOF
"

# Run Playwright script
echo ""
echo "Running Playwright screenshot capture..."
docker exec $CONTAINER_NAME bash -c "cd /workspace && node screenshot.js"

# Verify screenshot was created
echo ""
echo "Verifying screenshot file..."
docker exec $CONTAINER_NAME bash -c "ls -lh /workspace/screenshot.png && echo '✅ Screenshot file created successfully'"

# Check if screenshot is accessible from host
echo ""
echo "Checking if screenshot is accessible from host via volume mount..."
if [ -f "test-workspace/screenshot.png" ]; then
    echo "✅ Screenshot accessible from host!"
    echo "   File size: $(du -h test-workspace/screenshot.png | cut -f1)"
else
    echo "❌ Screenshot not accessible from host"
    exit 1
fi

echo ""
echo "========================================"
echo "🎉 Playwright screenshot test passed!"
echo ""
echo "✅ Browser automation works inside container"
echo "✅ Screenshots can be captured"
echo "✅ Files are accessible via volume mounts"

# Cleanup
echo ""
echo "Cleaning up..."
docker stop $CONTAINER_NAME
docker rm $CONTAINER_NAME

echo "✅ Cleanup complete"
echo ""
echo "📸 Screenshot saved to: test-workspace/screenshot.png (kept for manual inspection)"
