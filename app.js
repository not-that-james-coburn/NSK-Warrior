if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      console.log('ServiceWorker registration successful with scope: ', registration.scope);

      const handleInstalling = (worker) => {
        if (!worker) return;
        console.log('Service worker installing:', worker);
        worker.addEventListener('statechange', () => {
          console.log('Installing worker statechange:', worker.state);
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('New service worker installed (update).');
            notificationManager.show('UPDATE_AVAILABLE'); // Replaced showUpdateNotification()
          }
        });
      };

      if (registration.waiting) {
        console.log('Found waiting worker on register — treating as update.');
        notificationManager.show('UPDATE_AVAILABLE'); // Replaced showUpdateNotification()
      } else if (registration.installing) {
        handleInstalling(registration.installing);
      }

      registration.addEventListener('updatefound', () => {
        console.log('updatefound fired on registration');
        handleInstalling(registration.installing);
      });

      try {
        await registration.update();
        console.log('registration.update() completed.');
      } catch (err) {
        console.warn('registration.update() failed:', err);
      }

      const readyRegistration = await navigator.serviceWorker.ready;
      readyRegistration.active?.postMessage({ type: 'CHECK_OFFLINE_READY' });

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'OFFLINE_READY') {
          notificationManager.show('OFFLINE_READY', { cacheName: event.data.cacheName });
        }
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('controllerchange detected — a new service worker has taken control.');
      });

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        window.deferredPrompt = e;
        notificationManager.show('INSTALL_PWA');
      });

      if (window.self !== window.top) {
        const dismissed = localStorage.getItem('install-prompt-dismissed');
        const now = Date.now();
        const oneWeek = 7 * 24 * 60 * 60 * 1000;

        if (!dismissed || now - parseInt(dismissed, 10) > oneWeek) {
          setTimeout(() => {
            notificationManager.show('INSTALL_PWA', { source: 'iframe' });
          }, 2000);
        }
      }
    } catch (error) {
      console.log('ServiceWorker registration failed: ', error);
    }
  });
}