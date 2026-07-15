self.addEventListener("push", (event) => {
    let data = {
      title: "Zentro",
      body: "You have a new notification.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      url: "/dashboard",
    };
  
    if (event.data) {
      try {
        data = {
          ...data,
          ...event.data.json(),
        };
      } catch {
        data.body = event.data.text();
      }
    }
  
    const options = {
      body: data.body,
      icon: data.icon || "/icon-192.png",
      badge: data.badge || "/icon-192.png",
      tag: data.tag || "zentro-notification",
      renotify: Boolean(data.renotify),
      data: {
        url: data.url || "/dashboard",
      },
      actions: Array.isArray(data.actions)
        ? data.actions
        : [],
    };
  
    event.waitUntil(
      self.registration.showNotification(
        data.title || "Zentro",
        options,
      ),
    );
  });
  
  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
  
    const targetUrl =
      event.notification.data?.url || "/dashboard";
  
    event.waitUntil(
      self.clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then((clients) => {
          for (const client of clients) {
            if (
              "focus" in client &&
              new URL(client.url).origin ===
                self.location.origin
            ) {
              client.navigate(targetUrl);
              return client.focus();
            }
          }
  
          return self.clients.openWindow(targetUrl);
        }),
    );
  });
  