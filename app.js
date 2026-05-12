const notificationManager = window.notificationManager || new window.NotificationManager();
window.notificationManager = notificationManager;

let refreshingForUpdate = false;
let updateReloadRequested = false;
let updateReloadFallbackTimer = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      console.log('ServiceWorker registration successful with scope: ', registration.scope);

      const reloadForApprovedUpdate = (reason) => {
        if (refreshingForUpdate) return;

        refreshingForUpdate = true;

        if (updateReloadFallbackTimer) {
          clearTimeout(updateReloadFallbackTimer);
          updateReloadFallbackTimer = null;
        }

        console.log(`${reason} — reloading for the approved service worker update.`);
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!updateReloadRequested) return;
        reloadForApprovedUpdate('controllerchange detected');
      });

      const showUpdateAvailable = worker => {
        const updateWorker = worker || registration.waiting;

        notificationManager.show('UPDATE_AVAILABLE', {
          version: updateWorker?.scriptURL || registration.active?.scriptURL || 'service-worker',
          onReload: () => {
            const waitingWorker = registration.waiting || updateWorker;

            updateReloadRequested = true;

            if (waitingWorker) {
              waitingWorker.postMessage({ type: 'SKIP_WAITING' });

              if (updateReloadFallbackTimer) {
                clearTimeout(updateReloadFallbackTimer);
              }

              updateReloadFallbackTimer = setTimeout(() => {
                reloadForApprovedUpdate('controllerchange was not observed after SKIP_WAITING');
              }, 4000);

              return;
            }

            reloadForApprovedUpdate('No waiting service worker was available');
            if (waitingWorker) {
              waitingWorker.postMessage({ type: 'SKIP_WAITING' });
              return;
            }

            window.location.reload();
          }
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

      window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        window.deferredPrompt = event;
        notificationManager.show('INSTALL_PWA');
      });

      if (window.self !== window.top) {
        const dismissed = notificationManager.safeGetItem('install-prompt-dismissed');
        const now = Date.now();
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        const dismissedAt = dismissed ? parseInt(dismissed, 10) : 0;

        if (!dismissedAt || now - dismissedAt > oneWeek) {
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
