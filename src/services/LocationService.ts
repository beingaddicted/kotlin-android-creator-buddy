import { Geolocation } from '@capacitor/geolocation';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { webRTCService } from './WebRTCService';

export interface LocationData {
  id: string;
  userId: string;
  organizationId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
}

class LocationService {
  private watchId: string | null = null;
  private isTracking = false;
  private locationData: LocationData[] = [];
  private currentUserId: string | null = null;
  private currentOrgId: string | null = null;

  constructor() {
    // Listen for location requests from WebRTC server
    window.addEventListener('webrtc-location-requested', () => {
      this.sendCurrentLocationToServer();
    });
  }

  async requestPermissions() {
    const permissions = await Geolocation.requestPermissions();
    
    const notificationPermissions = await LocalNotifications.requestPermissions();
    
    return permissions.location === 'granted' && notificationPermissions.display === 'granted';
  }

  async startTracking(userId: string, organizationId: string) {
    if (!await this.requestPermissions()) {
      throw new Error('Location permissions not granted');
    }

    this.isTracking = true;
    this.currentUserId = userId;
    this.currentOrgId = organizationId;
    console.log('Starting location tracking for user:', userId);

    // Listen for app state changes
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        console.log('App going to background, maintaining location tracking');
        this.scheduleLocationUpdate(userId, organizationId);
      }
    });

    // Start continuous location watching
    this.watchId = await Geolocation.watchPosition(
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
      (position, err) => {
        if (err) {
          console.error('Location error:', err);
          return;
        }

        if (position) {
          const locationData: LocationData = {
            id: Date.now().toString(),
            userId,
            organizationId,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: Date.now(),
            accuracy: position.coords.accuracy,
          };

          this.saveLocationLocally(locationData);
          console.log('Location updated:', locationData);
        }
      }
    );
  }

  private async sendCurrentLocationToServer() {
    if (!this.isTracking || !this.currentUserId || !this.currentOrgId) return;

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 5000,
      });

      const locationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp: Date.now(),
        accuracy: position.coords.accuracy,
        userId: this.currentUserId
      };

      // Send location update via WebRTC to server
      webRTCService.sendLocationUpdate(locationData);
      
      console.log('Current location sent to server:', locationData);
    } catch (error) {
      console.error('Failed to get current location for server:', error);
    }
  }

  async stopTracking() {
    this.isTracking = false;
    
    if (this.watchId) {
      await Geolocation.clearWatch({ id: this.watchId });
      this.watchId = null;
    }

    // Disconnect WebRTC
    webRTCService.disconnect();

    // Remove app state listeners
    App.removeAllListeners();

    console.log('Location tracking stopped');
  }

  private async scheduleLocationUpdate(userId: string, organizationId: string) {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 5000,
      });

      const locationData: LocationData = {
        id: Date.now().toString(),
        userId,
        organizationId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp: Date.now(),
        accuracy: position.coords.accuracy,
      };

      this.saveLocationLocally(locationData);
      
      // Send background location update via WebRTC
      webRTCService.sendLocationUpdate({
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        timestamp: locationData.timestamp,
        accuracy: locationData.accuracy
      });
    } catch (error) {
      console.error('Background location update failed:', error);
    }
  }

  private saveLocationLocally(locationData: LocationData) {
    this.locationData.push(locationData);
    
    // Keep only last 100 locations to avoid memory issues
    if (this.locationData.length > 100) {
      this.locationData = this.locationData.slice(-100);
    }

    // Save to localStorage for persistence
    localStorage.setItem('locationHistory', JSON.stringify(this.locationData));
  }

  getStoredLocations(): LocationData[] {
    const stored = localStorage.getItem('locationHistory');
    return stored ? JSON.parse(stored) : [];
  }

  getCurrentLocation(): Promise<LocationData | null> {
    return new Promise(async (resolve) => {
      try {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        });

        resolve({
          id: Date.now().toString(),
          userId: 'current',
          organizationId: 'current',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Date.now(),
          accuracy: position.coords.accuracy,
        });
      } catch (error) {
        console.error('Failed to get current location:', error);
        resolve(null);
      }
    });
  }

  async notifyLocationServiceStopped() {
    await LocalNotifications.schedule({
      notifications: [
        {
          title: 'LocationSync',
          body: 'Location tracking stopped. Please open the app to continue sharing your location.',
          id: 1,
          schedule: { at: new Date(Date.now() + 1000) },
        },
      ],
    });
  }

  isCurrentlyTracking(): boolean {
    return this.isTracking;
  }
}

export const locationService = new LocationService();
