
export class ConfigurationService {
  private static instance: ConfigurationService;

  static getInstance(): ConfigurationService {
    if (!ConfigurationService.instance) {
      ConfigurationService.instance = new ConfigurationService();
    }
    return ConfigurationService.instance;
  }

  // Get Google Play package name dynamically
  getGooglePlayPackageName(): string {
    // Try to get from capacitor config first, fallback to hardcoded
    if (typeof window !== 'undefined' && (window as any).Capacitor?.getPlatform() === 'android') {
      // In a real app, this would come from Capacitor's app info
      return 'app.lovable.bcd1eb8b14f5447a94a2bc357ec4de2b';
    }
    return 'app.lovable.bcd1eb8b14f5447a94a2bc357ec4de2b';
  }

  // Validate geographic coordinates
  validateCoordinates(latitude: number, longitude: number): boolean {
    return (
      latitude >= -90 && latitude <= 90 &&
      longitude >= -180 && longitude <= 180
    );
  }

  // Validate organization name with enhanced security
  validateOrganizationName(name: string): { valid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Organization name is required' };
    }

    if (name.length < 3 || name.length > 100) {
      return { valid: false, error: 'Organization name must be between 3 and 100 characters' };
    }

    // Check for malicious patterns
    const maliciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /[<>]/g
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(name)) {
        return { valid: false, error: 'Organization name contains invalid characters' };
      }
    }

    return { valid: true };
  }

  // Generate secure session timeout configuration
  getSessionConfig() {
    return {
      timeout: 24 * 60 * 60 * 1000, // 24 hours
      warningTime: 5 * 60 * 1000, // 5 minutes before expiry
      maxIdleTime: 60 * 60 * 1000 // 1 hour idle
    };
  }
}

export const configService = ConfigurationService.getInstance();
