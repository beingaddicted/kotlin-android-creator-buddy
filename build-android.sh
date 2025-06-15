
#!/bin/bash

echo "🚀 Building LocationSync Android APK..."

# Check if Android Studio and SDK are installed
if ! command -v adb &> /dev/null; then
    echo "❌ Android SDK not found. Please install Android Studio and set up the SDK."
    exit 1
fi

# Build the web app
echo "📦 Building web application..."
npm run build

# Sync with Capacitor
echo "🔄 Syncing with Capacitor..."
npx cap sync android

# Copy Capacitor Android platform if it doesn't exist
if [ ! -d "android" ]; then
    echo "📱 Adding Android platform..."
    npx cap add android
fi

# Build the APK
echo "🔨 Building APK..."
cd android
./gradlew assembleDebug

if [ $? -eq 0 ]; then
    echo "✅ APK built successfully!"
    echo "📍 APK location: android/app/build/outputs/apk/debug/app-debug.apk"
    
    # Check if device is connected
    if adb devices | grep -q "device$"; then
        echo "📱 Android device detected. Installing APK..."
        adb install app/build/outputs/apk/debug/app-debug.apk
        echo "✅ APK installed on device!"
    else
        echo "⚠️  No Android device connected. APK ready for manual installation."
    fi
else
    echo "❌ APK build failed. Check the errors above."
fi

cd ..
