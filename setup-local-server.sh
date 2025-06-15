
#!/bin/bash

echo "🖥️ Setting up local WebSocket server..."

# Navigate to server directory
cd server

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing server dependencies..."
    npm install
fi

# Get local IP address
LOCAL_IP=$(hostname -I | awk '{print $1}')
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP="localhost"
fi

echo "🌐 Local IP detected: $LOCAL_IP"
echo "🚀 Starting WebSocket server on port 3001..."
echo "📱 Mobile devices can connect to: ws://$LOCAL_IP:3001"

# Start the server
npm start
