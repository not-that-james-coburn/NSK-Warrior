import NotificationManager from './notification-manager.js';

const notificationManager = new NotificationManager();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
      
      let updatePromptShown = false;
      let refreshingForUpdate = false;

      const promptForUpdate = (worker = registration.waiting) => {
        if (updatePromptShown) return;
        updatePromptShown = true;

        notificationManager.enqueue('UPDATE_AVAILABLE', {
          onReload: () => {
            const waitingWorker = registration.waiting || worker;
            if (waitingWorker) {
              waitingWorker.postMessage({ type: 'SKIP_WAITING' });
            } else {
              window.location.reload();
            }
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
              console.log('New service worker installed and waiting for user approval.');
              promptForUpdate(worker);
            } else {
              console.log('Service worker installed for the first time (no prior controller).');
            }
          }
        });
      };
      
      // If there's already a waiting worker, treat that as an available update
      if (registration.waiting) {
        console.log('Found waiting worker on register — treating as update.');
        promptForUpdate(registration.waiting);
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
          notificationManager.enqueue('OFFLINE_READY', { cacheName: event.data.cacheName });
        }
      });

      const readyRegistration = await navigator.serviceWorker.ready;
      if (readyRegistration.active) {
        readyRegistration.active.postMessage({ type: 'CHECK_OFFLINE_READY' });
      }

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshingForUpdate) return;
        refreshingForUpdate = true;
        console.log('controllerchange detected — reloading for the approved service worker update.');
        window.location.reload();
      });
    } catch (error) {
      console.log('ServiceWorker registration failed: ', error);
    }
  });
}
