/** null = not tried yet; true = SW proxy active; false = use direct Render URL */
let swActive = null;

let proxyReady;

/**
 * Production: register a service worker so /api/* is same-origin (avoids CORS / VPN blocks).
 * Dev: Vite proxies /api to localhost — no service worker.
 */
export async function ensureApiProxy() {
  if (import.meta.env.DEV) {
    swActive = false;
    return;
  }

  if (!("serviceWorker" in navigator)) {
    swActive = false;
    return;
  }

  if (!proxyReady) {
    proxyReady = navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        swActive = true;
      })
      .catch(() => {
        swActive = false;
      });
  }

  await proxyReady;
}

/** Direct cross-origin fetch only when the service worker could not be registered. */
export function useDirectApiHost() {
  return swActive === false;
}
