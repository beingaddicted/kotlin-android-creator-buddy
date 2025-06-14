
import { SecurityManager } from './SecurityManager';

declare global {
  interface Window {
    securityManager?: SecurityManager;
  }
}

export {};
