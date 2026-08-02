/* What Bin Council Console service worker.
 * Protected console responses are deliberately never cached on the device.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
