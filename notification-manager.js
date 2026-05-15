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
      <div id="update-notification" style="position: fixed; top: -150px; left: 50%; z-index: 1000; transform: translateX(-50%); transition: top 0.5s ease-in-out; background: rgba(50, 0, 0, 0.9); border: 1px solid #a00000; border-radius: 20px; padding: 20px; width: 300px; text-align: center; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);">
        <p style="margin: 0; font-weight: 700;">An update is available!</p>
        <p style="margin: 6px 0 0; font-size: 0.9em;">Reload for newest version.</p>
        <div id="modal-buttons">
          <button id="update-button" style="background: #a00000; color: #fff; border: none; padding: 10px 20px; border-radius: 20px; font-weight: bold; margin: 10px 5px 0;">Reload</button>
        </div>
      </div>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      const el = document.getElementById('update-notification');
      if (el) el.style.top = '20px';
    }, 100);

    setTimeout(() => {
      const el = document.getElementById('update-notification');
      if (el) el.style.top = '-150px';
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
      <div id="offline-ready-notification" style="position: fixed; top: -150px; left: 50%; z-index: 1000; transform: translateX(-50%); transition: top 0.5s ease-in-out; background-color: rgba(50, 0, 0, 0.9); color: #fff; border: 1px solid #27ae60; border-radius: 12px; padding: 12px 18px; text-align: center; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);">
        <p style="margin: 0; font-weight: 700;">Ready for offline play!</p>
      </div>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      const el = document.getElementById('offline-ready-notification');
      if (el) el.style.top = '20px';
    }, 100);

    setTimeout(() => {
      const el = document.getElementById('offline-ready-notification');
      if (el) el.style.top = '-150px';
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
      <div id="install-pwa-notification" style="position: fixed; top: -150px; left: 50%; z-index: 1000; transform: translateX(-50%); transition: top 0.5s ease-in-out; background: rgba(50, 0, 0, 0.9); border: 1px solid #a00000; border-radius: 20px; padding: 20px; width: 300px; text-align: center; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);">
        <p style="margin: 0; font-weight: 700;">Install NSK Warrior?</p>
        <p style="margin: 6px 0 0; font-size: 0.9em;">Add the app to your device for quicker access.</p>
        <div id="modal-buttons">
          <button id="install-pwa-button" style="background: #a00000; color: #fff; border: none; padding: 10px 20px; border-radius: 20px; font-weight: bold; margin: 10px 5px 0;">Install</button>
          <button id="dismiss-pwa-button" style="background: #444; color: #fff; border: none; padding: 10px 20px; border-radius: 20px; font-weight: bold; margin: 10px 5px 0;">Not now</button>
        </div>
      </div>
    `;
    document.body.appendChild(notification);

    let dismissedNotification = false;
    const closeNotification = () => {
      if (dismissedNotification) return;
      dismissedNotification = true;
      const el = document.getElementById('install-pwa-notification');
      if (el) el.style.top = '-150px';
      setTimeout(() => notification.remove(), 600);
    };
    const rememberDismissal = () => {
      this.safeSetItem('install-prompt-dismissed', Date.now().toString());
      closeNotification();
    };

    setTimeout(() => {
      const el = document.getElementById('install-pwa-notification');
      if (el) el.style.top = '20px';
    }, 100);

    document.getElementById('dismiss-pwa-button')?.addEventListener('click', rememberDismissal);
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
      setTimeout(() => {
        closeNotification();
        resolve();
      }, 8000);
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
