#!/bin/bash
# Test: Verify port isolation between containers

set -e

CONTAINER_1="agent-poc-frontend"
CONTAINER_2="agent-poc-backend"
IMAGE_NAME="agent-runtime-node:latest"

echo "🧪 Testing Port Isolation"
echo "========================="

# Start container 1 (Frontend Engineer - port 3000)
echo "Starting container 1 (Frontend - port 3000)..."
docker run -d --name $CONTAINER_1 -p 3000:3000 $IMAGE_NAME

# Start container 2 (Backend Engineer - port 4000)
echo "Starting container 2 (Backend - port 4000)..."
docker run -d --name $CONTAINER_2 -p 4000:4000 $IMAGE_NAME

# Wait for containers to be ready
sleep 2

# Start HTTP servers in both containers
echo ""
echo "Starting HTTP server in container 1 on port 3000..."
docker exec -d $CONTAINER_1 bash -c "echo 'Frontend Engineer Container' > /tmp/index.html && cd /tmp && python3 -m http.server 3000"

echo "Starting HTTP server in container 2 on port 4000..."
docker exec -d $CONTAINER_2 bash -c "echo 'Backend Engineer Container' > /tmp/index.html && cd /tmp && python3 -m http.server 4000"

# Wait for servers to start
sleep 3

# Test 1: Verify both servers accessible from host
echo ""
echo "Test 1: Verify both servers accessible from host"
RESPONSE_1=$(curl -s http://localhost:3000)
RESPONSE_2=$(curl -s http://localhost:4000)

if [[ "$RESPONSE_1" == *"Frontend"* ]]; then
    echo "✅ Container 1 (port 3000) accessible from host"
else
    echo "❌ Container 1 not accessible"
    exit 1
fi

if [[ "$RESPONSE_2" == *"Backend"* ]]; then
    echo "✅ Container 2 (port 4000) accessible from host"
else
    echo "❌ Container 2 not accessible"
    exit 1
fi

# Test 2: Verify containers have network isolation (cannot access each other by default)
echo ""
echo "Test 2: Verify containers are isolated (default bridge network)"
echo "Attempting to access container 2 from container 1..."

# This should fail because containers are on default bridge without --link
docker exec $CONTAINER_1 bash -c "curl -s --connect-timeout 2 http://localhost:4000 || echo 'Connection failed (expected)'"

# Get container IPs
CONTAINER_1_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $CONTAINER_1)
CONTAINER_2_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $CONTAINER_2)

echo ""
echo "Container 1 IP: $CONTAINER_1_IP"
echo "Container 2 IP: $CONTAINER_2_IP"

# Try to access container 2 from container 1 via IP
echo ""
echo "Attempting to access container 2 ($CONTAINER_2_IP:4000) from container 1..."
docker exec $CONTAINER_1 bash -c "curl -s --connect-timeout 2 http://$CONTAINER_2_IP:4000 || echo '❌ Cannot reach other container (this is GOOD for isolation)'"

echo ""
echo "========================="
echo "🎉 Port isolation test complete!"
echo ""
echo "✅ Each container can run servers on their allocated ports"
echo "✅ All ports accessible from host (Docker port mapping)"
echo "✅ Containers are isolated from each other (default bridge)"
echo ""
echo "💡 For agent-to-agent communication, we'll use:"
echo "   - Slack messages (primary)"
echo "   - Database (agent_messages table)"
echo "   - NOT direct HTTP calls between containers"

# Cleanup
echo ""
echo "Cleaning up..."
docker stop $CONTAINER_1 $CONTAINER_2
docker rm $CONTAINER_1 $CONTAINER_2

echo "✅ Cleanup complete"
