class NotificationManager {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.currentType = null;
    this.currentDedupKey = null;
    this.shownUpdateVersions = new Set();
  }

  safeGetItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  safeSetItem(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  getDedupKey(type, options = {}) {
    if (type === 'UPDATE_AVAILABLE') {
      return options.cacheName || options.cacheVersion || options.version || 'unknown-update-version';
    }

    return type;
  }

  hasMatchingNotification(type, dedupKey) {
    if (this.currentType === type && this.currentDedupKey === dedupKey) return true;

    return this.queue.some(item => {
      return item.type === type && this.getDedupKey(item.type, item.options) === dedupKey;
    });
  }

  hasSeenUpdateVersion(dedupKey) {
    return this.shownUpdateVersions.has(dedupKey);
  }

  markUpdateVersionSeen(dedupKey) {
    this.shownUpdateVersions.add(dedupKey);
  }

  async show(type, options = {}) {
    if (!options.allowDuplicate) {
      const dedupKey = this.getDedupKey(type, options);

      if (type === 'UPDATE_AVAILABLE') {
        if (this.hasSeenUpdateVersion(dedupKey) || this.hasMatchingNotification(type, dedupKey)) {
          return false;
        }

        this.markUpdateVersionSeen(dedupKey);
      } else if (this.hasMatchingNotification(type, dedupKey)) {
        return false;
      }
    }

    this.queue.push({ type, options });
    this.processQueue();
    return true;
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const { type, options } = this.queue.shift();
    this.currentType = type;
    this.currentDedupKey = this.getDedupKey(type, options);

    try {
      await this.render(type, options);
    } finally {
      this.currentType = null;
      this.currentDedupKey = null;
      this.isProcessing = false;
      this.processQueue();
    }
  }

  render(type, options = {}) {
    switch (type) {
      case 'UPDATE_AVAILABLE':
        return this.showUpdateNotification(options);
      case 'OFFLINE_READY':
        return this.showOfflineReadyNotification(options.cacheName);
      case 'INSTALL_PWA':
        return this.showInstallPwaNotification(options);
      default:
        console.warn(`Unknown notification type: ${type}`);
        return Promise.resolve();
    }
  }

  showUpdateNotification(options = {}) {
    console.log('showUpdateNotification called');
    const notification = document.createElement('div');
    notification.innerHTML = `
      <div id="update-notification" class="notice-toast notice-toast--panel">
        <p class="notice-title">An update is available!</p>
        <p class="notice-subtitle">Reload for newest version.</p>
        <div id="modal-buttons">
          <button id="update-button" class="modal-btn confirm">Reload</button>
        </div>
      </div>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      const el = document.getElementById('update-notification');
      if (el) el.classList.add('is-visible');
    }, 100);

    setTimeout(() => {
      const el = document.getElementById('update-notification');
      if (el) el.classList.remove('is-visible');
    }, 5000);

    const updateButton = document.getElementById('update-button');
    if (updateButton) {
      updateButton.addEventListener('click', () => {
        if (typeof options.onReload === 'function') {
          options.onReload();
          return;
        }

        window.location.reload();
      });
    } else {
      console.warn('update-button not found when wiring click handler.');
    }

    return this.removeAfter(notification, 5600);
  }

  showOfflineReadyNotification(cacheName = 'default') {
    const storageKey = `offline-ready-notified-${cacheName}`;
    if (this.safeGetItem(storageKey) === 'true') return Promise.resolve();

    this.safeSetItem(storageKey, 'true');
    console.log('showOfflineReadyNotification called');

    const notification = document.createElement('div');
    notification.innerHTML = `
      <div id="offline-ready-notification" class="notice-toast notice-toast--compact">
        <p class="notice-title">Ready for offline play!</p>
      </div>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      const el = document.getElementById('offline-ready-notification');
      if (el) el.classList.add('is-visible');
    }, 100);

    setTimeout(() => {
      const el = document.getElementById('offline-ready-notification');
      if (el) el.classList.remove('is-visible');
    }, 5000);

    return this.removeAfter(notification, 5600);
  }

  showInstallPwaNotification(options = {}) {
    const accepted = this.safeGetItem('install-prompt-accepted');
    const dismissed = this.safeGetItem('install-prompt-dismissed');
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const dismissedAt = dismissed ? parseInt(dismissed, 10) : 0;

    if (accepted === 'true' || (dismissedAt && now - dismissedAt <= oneWeek)) {
      return Promise.resolve();
    }

    const notification = document.createElement('div');
    notification.innerHTML = `
      <div id="install-pwa-notification" class="notice-toast notice-toast--panel">
        <p class="notice-title">Install the App</p>
        <div id="modal-buttons">
          <button id="dismiss-pwa-button" class="modal-btn">Not now</button>
          <button id="install-pwa-button" class="modal-btn confirm">OK</button>
        </div>
        <div>
          <button id="install-pwa-info-button" class="modal-btn">What's This?</button>
        </div>
      </div>
    `;
    document.body.appendChild(notification);

    let dismissedNotification = false;
    let autoDismissTimeout = null;
    let autoDismissStartedAt = 0;
    let autoDismissRemaining = 8000;
    let resolveNotification = () => {};

    const clearAutoDismiss = () => {
      if (!autoDismissTimeout) return;

      clearTimeout(autoDismissTimeout);
      autoDismissTimeout = null;
    };
    const closeNotification = () => {
      if (dismissedNotification) return;
      dismissedNotification = true;
      clearAutoDismiss();
      const el = document.getElementById('install-pwa-notification');
      if (el) el.classList.remove('is-visible');
      setTimeout(() => notification.remove(), 600);
      resolveNotification();
    };
    const pauseAutoDismiss = () => {
      if (!autoDismissTimeout) return;

      autoDismissRemaining = Math.max(0, autoDismissRemaining - (Date.now() - autoDismissStartedAt));
      clearAutoDismiss();
    };
    const startAutoDismiss = (delay = autoDismissRemaining) => {
      if (dismissedNotification) return;

      clearAutoDismiss();
      autoDismissRemaining = delay;
      autoDismissStartedAt = Date.now();
      autoDismissTimeout = setTimeout(closeNotification, autoDismissRemaining);
    };
    const rememberDismissal = () => {
      this.safeSetItem('install-prompt-dismissed', Date.now().toString());
      closeNotification();
    };
    const showInfoModal = async () => {
      if (dismissedNotification) return;

      pauseAutoDismiss();

      if (typeof window.showModal === 'function') {
        await window.showModal([
          'You will be redirected to nsk-warrior.netlify.app to install this game as a PWA.',
          'A PWA (progressive web app) is a website that can be installed like an app for quicker launching and offline/app-like behavior.',
          '',
          '𝗖𝗵𝗿𝗼𝗺𝗲: use the browser install prompt if shown, or the install icon / browser menu option.',
          '',
          '𝗦𝗮𝗳𝗮𝗿𝗶: use Share, then “Add to Home Screen.”',
          '',
          '𝗙𝗶𝗿𝗲𝗳𝗼𝘅: use the browser menu or home-screen/install option where supported.'
        ].join('\n'), 'info');
      } else {
        console.warn('showModal is not available for the install PWA info dialog.');
      }

      startAutoDismiss(autoDismissRemaining);
    };

    setTimeout(() => {
      const el = document.getElementById('install-pwa-notification');
      if (el) el.classList.add('is-visible');
    }, 100);
    startAutoDismiss();

    document.getElementById('dismiss-pwa-button')?.addEventListener('click', rememberDismissal);
    document.getElementById('install-pwa-info-button')?.addEventListener('click', showInfoModal);
    document.getElementById('install-pwa-button')?.addEventListener('click', async () => {
      if (window.deferredPrompt) {
        window.deferredPrompt.prompt();
        const choice = await window.deferredPrompt.userChoice;

        if (choice?.outcome === 'accepted') {
          this.safeSetItem('install-prompt-accepted', 'true');
        } else if (choice?.outcome === 'dismissed') {
          this.safeSetItem('install-prompt-dismissed', Date.now().toString());
        }

        window.deferredPrompt = null;
      } else if (options.source === 'iframe') {
        window.open(window.location.href, '_blank', 'noopener');
        this.safeSetItem('install-prompt-dismissed', Date.now().toString());
      }

      closeNotification();
    });

    return new Promise(resolve => {
      resolveNotification = resolve;
    });
  }

  removeAfter(notification, delay) {
    return new Promise(resolve => {
      setTimeout(() => {
        notification.remove();
        resolve();
      }, delay);
    });
  }
}

if (typeof window !== 'undefined') {
  window.NotificationManager = NotificationManager;
  window.notificationManager = window.notificationManager || new NotificationManager();
}
