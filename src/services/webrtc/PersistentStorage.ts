
export interface StoredClientInfo {
  id: string;
  name: string;
  organizationId: string;
  lastConnected: number;
  connectionAttempts: number;
}

export interface StoredServerState {
  organizationId: string;
  organizationName: string;
  adminId: string;
  lastServerOffer: any;
  clients: StoredClientInfo[];
  isActive: boolean;
}

export class PersistentStorage {
  private readonly STORAGE_KEY = 'webrtc_server_state';
  private readonly MAX_CLIENT_AGE = 24 * 60 * 60 * 1000; // 24 hours

  saveServerState(state: StoredServerState): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
      console.log('Server state saved to persistent storage');
    } catch (error) {
      console.error('Failed to save server state:', error);
    }
  }

  loadServerState(): StoredServerState | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const state: StoredServerState = JSON.parse(stored);
      
      // Clean up old clients
      state.clients = state.clients.filter(client => 
        Date.now() - client.lastConnected < this.MAX_CLIENT_AGE
      );

      return state;
    } catch (error) {
      console.error('Failed to load server state:', error);
      return null;
    }
  }

  addOrUpdateClient(client: StoredClientInfo): void {
    const state = this.loadServerState();
    if (!state) return;

    const existingIndex = state.clients.findIndex(c => c.id === client.id);
    if (existingIndex >= 0) {
      state.clients[existingIndex] = client;
    } else {
      state.clients.push(client);
    }

    this.saveServerState(state);
  }

  removeClient(clientId: string): void {
    const state = this.loadServerState();
    if (!state) return;

    state.clients = state.clients.filter(c => c.id !== clientId);
    this.saveServerState(state);
  }

  updateLastServerOffer(offer: any): void {
    const state = this.loadServerState();
    if (!state) return;

    state.lastServerOffer = offer;
    this.saveServerState(state);
  }

  setServerActive(isActive: boolean): void {
    const state = this.loadServerState();
    if (!state) return;

    state.isActive = isActive;
    this.saveServerState(state);
  }

  clearServerState(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('Server state cleared from persistent storage');
  }

  getStoredClients(): StoredClientInfo[] {
    const state = this.loadServerState();
    return state?.clients || [];
  }
}
