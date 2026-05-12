class NotificationManager {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  enqueue(type, options = {}) {
    this.queue.push({ type, options });
    return this.processQueue();
  }

  async processQueue() {
    if (this.isProcessing) return;

    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const { type, options = {} } = this.queue.shift();

        switch (type) {
          case 'UPDATE_AVAILABLE':
            await this.showUpdateNotification(options);
            break;
          case 'OFFLINE_READY':
            await this.showOfflineReadyNotification(options);
            break;
          case 'INSTALL_INSTRUCTIONS':
            await this.showInstallInstructions(options);
            break;
          default:
            console.warn('Unknown notification type:', type, options);
            break;
        }
      }
    } finally {
      this.isProcessing = false;

      if (this.queue.length > 0) {
        await this.processQueue();
      }
    }
  }

  async showUpdateNotification({ onReload = () => window.location.reload() } = {}) {
    const notification = document.createElement('div');
    notification.innerHTML = `
      <div id="update-notification" style="position: fixed; top: -150px; left: 50%; z-index: 1000; transform: translateX(-50%); transition: top 0.5s ease-in-out;">
        <p id="modal-message">An update is available!</p>
        <div id="modal-buttons">
          <button id="update-button" style="background: #a00000;">Reload</button>
        </div>
      </div>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      const el = document.getElementById('update-notification');
      if (el) el.style.top = '20px';
    }, 100);

    const updateButton = document.getElementById('update-button');
    if (updateButton) {
      updateButton.addEventListener('click', () => {
        updateButton.disabled = true;
        updateButton.textContent = 'Updating...';
        onReload();
      });
    } else {
      console.warn('update-button not found when wiring click handler.');
    }
  }

  async showOfflineReadyNotification({ cacheName = 'default' } = {}) {
    const storageKey = `offline-ready-notified-${cacheName}`;
    if (localStorage.getItem(storageKey) === 'true') return;

    localStorage.setItem(storageKey, 'true');

    const notification = document.createElement('div');
    notification.innerHTML = `
      <div id="offline-ready-notification" style="position: fixed; top: -150px; left: 50%; z-index: 1000; transform: translateX(-50%); transition: top 0.5s ease-in-out; background: rgba(0, 0, 0, 0.9); color: #fff; border: 1px solid #2f8f2f; border-radius: 12px; padding: 12px 18px; text-align: center; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);">
        <p style="margin: 0; font-weight: 700;">Ready for offline play!</p>
        <p style="margin: 6px 0 0; font-size: 0.9em;">Game assets have been saved on this device.</p>
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

    setTimeout(() => {
      notification.remove();
    }, 5600);
  }

  async showInstallInstructions({ message = 'Install NSK Warrior from your browser menu for the best offline experience.' } = {}) {
    const notification = document.createElement('div');
    const panel = document.createElement('div');
    panel.id = 'install-instructions-notification';
    panel.style.cssText = 'position: fixed; top: -150px; left: 50%; z-index: 1000; transform: translateX(-50%); transition: top 0.5s ease-in-out; background: rgba(0, 0, 0, 0.9); color: #fff; border: 1px solid #a00000; border-radius: 12px; padding: 12px 18px; text-align: center; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);';

    const title = document.createElement('p');
    title.style.cssText = 'margin: 0; font-weight: 700;';
    title.textContent = 'Install instructions';

    const body = document.createElement('p');
    body.style.cssText = 'margin: 6px 0 0; font-size: 0.9em;';
    body.textContent = message;

    panel.append(title, body);
    notification.appendChild(panel);
    document.body.appendChild(notification);

    setTimeout(() => {
      const el = document.getElementById('install-instructions-notification');
      if (el) el.style.top = '20px';
    }, 100);

    setTimeout(() => {
      const el = document.getElementById('install-instructions-notification');
      if (el) el.style.top = '-150px';
    }, 5000);

    setTimeout(() => {
      notification.remove();
    }, 5600);
  }
}

export default NotificationManager;
