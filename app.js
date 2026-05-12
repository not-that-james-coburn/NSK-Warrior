if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      console.log('ServiceWorker registration successful with scope: ', registration.scope);

      const showUpdateAvailable = worker => {
        notificationManager.show('UPDATE_AVAILABLE', {
          version: worker?.scriptURL || registration.active?.scriptURL || 'service-worker'
        });
      };

      // Helper to handle an installing worker's lifecycle
      const handleInstalling = (worker) => {
        if (!worker) return;
        console.log('Service worker installing:', worker);
        worker.addEventListener('statechange', () => {
          console.log('Installing worker statechange:', worker.state);
          if (worker.state === 'installed') {
            // If there's an active controller, this is an update (not first install)
            if (navigator.serviceWorker.controller) {
              console.log('New service worker installed (update).');
              showUpdateAvailable(worker);
            } else {
              console.log('Service worker installed for the first time (no prior controller).');
            }
          }
        });
      };

      // If there's already a waiting worker, treat that as an available update
      if (registration.waiting) {
        console.log('Found waiting worker on register — treating as update.');
        showUpdateAvailable(registration.waiting);
      }

      // If there's an installing worker already, attach listeners
      if (registration.installing) {
        handleInstalling(registration.installing);
      }

      // Always attach updatefound to catch new installs — do this BEFORE update()
      registration.addEventListener('updatefound', () => {
        console.log('updatefound fired on registration');
        handleInstalling(registration.installing);
      });

      // Check for updates before calling update() to avoid race.
      try {
        await registration.update();
        console.log('registration.update() completed.');
      } catch (err) {
        console.warn('registration.update() failed:', err);
      }

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'OFFLINE_READY') {
          notificationManager.show('OFFLINE_READY', { cacheName: event.data.cacheName });
        }
      });

      const readyRegistration = await navigator.serviceWorker.ready;
      if (readyRegistration.active) {
        readyRegistration.active.postMessage({ type: 'CHECK_OFFLINE_READY' });
      }

      // Optional: listen for controllerchange to detect when a new worker takes control
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('controllerchange detected — a new service worker has taken control.');
        // reload here to force using the new SW:
        // window.location.reload();
      });

      window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        window.deferredPrompt = event;
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
