
export interface AdminCandidate {
  deviceId: string;
  deviceName: string;
  capabilities: string[];
  joinTime: number;
  lastSeen: number;
  priority: number;
}

export interface AdminElectionEvent {
  adminId: string;
  adminName: string;
  previousAdmin: string | null;
  isOwnDevice: boolean;
}

export interface HeartbeatEvent {
  deviceId: string;
  timestamp: number;
}
