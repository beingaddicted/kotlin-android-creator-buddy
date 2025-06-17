// src/config/appConfig.ts
export const appConfig = {
  SIGNALING_SERVER_URL: import.meta.env.VITE_SIGNALING_SERVER_URL || "ws://localhost:3001"
};
