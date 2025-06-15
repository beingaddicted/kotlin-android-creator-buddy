
# Mobile Development Setup Guide

## Prerequisites

### For Android Development:
1. **Android Studio** - Download from https://developer.android.com/studio
2. **Java Development Kit (JDK)** - Version 11 or higher
3. **Android SDK** - Installed through Android Studio
4. **Node.js** - Version 16 or higher

### For Local Server:
1. **Node.js** - Version 16 or higher
2. **npm** - Comes with Node.js

## Step-by-Step Setup

### 1. Export to GitHub and Clone Locally

1. In Lovable editor, click the GitHub button (top right)
2. Connect to GitHub and create a repository
3. Clone the repository to your local machine:
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   cd YOUR_REPO_NAME
   ```

### 2. Install Dependencies

```bash
npm install
```

### 3. Add Android Platform

```bash
npx cap add android
```

### 4. Build and Sync

```bash
npm run build
npx cap sync android
```

### 5. Build APK

#### Option A: Using the build script (Linux/Mac)
```bash
chmod +x build-android.sh
./build-android.sh
```

#### Option B: Manual build
```bash
npx cap sync android
cd android
./gradlew assembleDebug
```

The APK will be created at: `android/app/build/outputs/apk/debug/app-debug.apk`

### 6. Install on Device

#### Via ADB (if device is connected):
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

#### Manual Installation:
1. Transfer the APK file to your Android device
2. Enable "Install from unknown sources" in device settings
3. Open the APK file on your device to install

### 7. Setup Local WebSocket Server

#### Option A: Using the setup script (Linux/Mac)
```bash
chmod +x setup-local-server.sh
./setup-local-server.sh
```

#### Option B: Manual setup
```bash
cd server
npm install
npm start
```

The server will run on port 3001. Note your local IP address for mobile connections.

### 8. Configure Mobile App for Local Server

If you want the mobile app to connect to your local server instead of the cloud:

1. Find your local IP address:
   - Linux/Mac: `hostname -I | awk '{print $1}'`
   - Windows: `ipconfig` (look for IPv4 Address)

2. Update the server connection in your mobile app to point to: `ws://YOUR_LOCAL_IP:3001`

## Troubleshooting

### Common Issues:

1. **Gradle Build Failed**: Make sure Android SDK is properly installed and ANDROID_HOME is set
2. **Device Not Detected**: Enable USB Debugging in Developer Options
3. **Network Connection Issues**: Ensure both devices are on the same WiFi network
4. **CORS Issues**: The server is configured to allow cross-origin requests

### Useful Commands:

```bash
# Check connected devices
adb devices

# View device logs
adb logcat

# Uninstall app
adb uninstall app.lovable.bcd1eb8b14f5447a94a2bc357ec4de2b

# Rebuild and reinstall
npx cap sync android && cd android && ./gradlew assembleDebug && adb install app/build/outputs/apk/debug/app-debug.apk
```

## Development Workflow

1. Make changes in Lovable or your local IDE
2. Build: `npm run build`
3. Sync: `npx cap sync android`
4. Test on device: `./build-android.sh` or manual build process
5. For server changes: restart the local server

## Security Note

The debug APK is for development only. For production, you'll need to:
1. Generate a signed APK
2. Configure proper security settings
3. Remove development permissions
