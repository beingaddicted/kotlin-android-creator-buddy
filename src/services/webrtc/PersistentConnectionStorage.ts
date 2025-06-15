export interface StoredConnectionData {
  peerId: string;
  peerName: string;
  organizationId: string;
  lastConnected: number;
  connectionAttempts: number;
  lastOfferData?: any;
  userPreferences?: {
    autoReconnect: boolean;
    reconnectDelay: number;
  };
}

export class PersistentConnectionStorage {
  private storageKey = 'webrtc_connections';
  private maxStoredConnections = 20;

  storeConnection(data: Omit<StoredConnectionData, 'lastConnected' | 'connectionAttempts'>): void {
    try {
      const stored = this.getStoredConnections();
      const existingIndex = stored.findIndex(conn => conn.peerId === data.peerId);
      
      const connectionData: StoredConnectionData = {
        ...data,
        lastConnected: Date.now(),
        connectionAttempts: existingIndex >= 0 ? stored[existingIndex].connectionAttempts : 0,
        userPreferences: {
          autoReconnect: true,
          reconnectDelay: 2000,
          ...data.userPreferences
        }
      };

      if (existingIndex >= 0) {
        stored[existingIndex] = connectionData;
      } else {
        stored.push(connectionData);
      }

      // Keep only recent connections
      stored.sort((a, b) => b.lastConnected - a.lastConnected);
      if (stored.length > this.maxStoredConnections) {
        stored.splice(this.maxStoredConnections);
      }

      localStorage.setItem(this.storageKey, JSON.stringify(stored));
      console.log('Stored connection data for peer:', data.peerId);
    } catch (error) {
      console.error('Failed to store connection data:', error);
    }
  }

  getStoredConnections(): StoredConnectionData[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to retrieve stored connections:', error);
      return [];
    }
  }

  getConnectionData(peerId: string): StoredConnectionData | null {
    const connections = this.getStoredConnections();
    return connections.find(conn => conn.peerId === peerId) || null;
  }

  updateConnectionAttempt(peerId: string, success: boolean): void {
    try {
      const stored = this.getStoredConnections();
      const connection = stored.find(conn => conn.peerId === peerId);
      
      if (connection) {
        if (success) {
          connection.connectionAttempts = 0;
          connection.lastConnected = Date.now();
        } else {
          connection.connectionAttempts++;
        }
        
        localStorage.setItem(this.storageKey, JSON.stringify(stored));
      }
    } catch (error) {
      console.error('Failed to update connection attempt:', error);
    }
  }

  removeConnection(peerId: string): void {
    try {
      const stored = this.getStoredConnections();
      const filtered = stored.filter(conn => conn.peerId !== peerId);
      localStorage.setItem(this.storageKey, JSON.stringify(filtered));
      console.log('Removed stored connection for peer:', peerId);
    } catch (error) {
      console.error('Failed to remove connection data:', error);
    }
  }

  updateUserPreferences(peerId: string, preferences: Partial<StoredConnectionData['userPreferences']>): void {
    try {
      const stored = this.getStoredConnections();
      const connection = stored.find(conn => conn.peerId === peerId);
      
      if (connection) {
        connection.userPreferences = {
          ...connection.userPreferences,
          ...preferences
        };
        localStorage.setItem(this.storageKey, JSON.stringify(stored));
      }
    } catch (error) {
      console.error('Failed to update user preferences:', error);
    }
  }

  clearExpiredConnections(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    try {
      const stored = this.getStoredConnections();
      const now = Date.now();
      const filtered = stored.filter(conn => now - conn.lastConnected < maxAge);
      
      if (filtered.length !== stored.length) {
        localStorage.setItem(this.storageKey, JSON.stringify(filtered));
        console.log(`Cleared ${stored.length - filtered.length} expired connections`);
      }
    } catch (error) {
      console.error('Failed to clear expired connections:', error);
    }
  }

  exportConnectionData(): string {
    return JSON.stringify(this.getStoredConnections(), null, 2);
  }

  importConnectionData(data: string): boolean {
    try {
      const connections = JSON.parse(data);
      if (Array.isArray(connections)) {
        localStorage.setItem(this.storageKey, data);
        console.log('Imported connection data successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to import connection data:', error);
      return false;
    }
  }
}
