
import { AdminCandidate } from './types';

export class ElectionLogic {
  static selectWinner(candidates: AdminCandidate[]): AdminCandidate | null {
    if (candidates.length === 0) return null;
    
    // Sort by priority (highest first), then by join time (earliest first)
    const sortedCandidates = [...candidates].sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.joinTime - b.joinTime; // Earlier join time first
    });
    
    return sortedCandidates[0];
  }

  static calculatePriority(capabilities: string[]): number {
    if (!Array.isArray(capabilities)) return 0;
    
    let priority = 0;
    
    // Higher priority for devices with more capabilities
    priority += capabilities.length;
    
    // Bonus for specific capabilities
    if (capabilities.includes('location.view')) priority += 5;
    if (capabilities.includes('admin.manage')) priority += 10;
    if (capabilities.includes('server.temporary')) priority += 3;
    
    return priority;
  }
}
