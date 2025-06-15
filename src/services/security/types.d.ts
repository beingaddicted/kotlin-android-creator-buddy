
declare global {
  interface Window {
    securityManager?: import('./SecurityManager').SecurityManager;
  }
}

export {};
