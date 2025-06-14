
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.bcd1eb8b14f5447a94a2bc357ec4de2b',
  appName: 'LocationSync',
  webDir: 'dist',
  server: {
    url: 'https://bcd1eb8b-14f5-447a-94a2-bc357ec4de2b.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#488AFF',
      sound: 'beep.wav',
    },
  },
};

export default config;
