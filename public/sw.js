self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
// ponytail: fetch handler vacío solo para cumplir criterios de instalación PWA;
// agregar cache offline cuando haga falta
self.addEventListener("fetch", () => {});

self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { body: e.data?.text() };
  }
  e.waitUntil(
    self.registration.showNotification(data.title ?? "Nexus", {
      body: data.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow(e.notification.data?.url ?? "/"));
});
