// notification-manager.js
class NotificationManager {
  constructor() {
    this.queue = [];
    this.isDisplaying = false;
  }

  async show(type, options = {}) {
    this.queue.push({ type, options });
    this.processQueue();
  }

  async processQueue() {
    if (this.isDisplaying || this.queue.length === 0) return;
    this.isDisplaying = true;

    const { type, options } = this.queue.shift();

    switch (type) {
      case 'UPDATE_AVAILABLE':
        await this.showUpdateNotification(options);
        break;
      case 'INSTALL_PWA':
        await this.showInstallPrompt(options);
        break;
      case 'OFFLINE_READY':
        await this.showOfflineReady(options);
        break;
    }

    this.isDisplaying = false;
    this.processQueue(); // Process next in queue
  }

  async showUpdateNotification(options) {
    return new Promise(resolve => {
      const notification = document.createElement('div');
      notification.innerHTML = `
        <div id="update-notification" style="position: fixed; top: 20px; left: 50%; z-index: 1000; 
             transform: translateX(-50%); background: rgba(160, 0, 0, 0.95); padding: 16px 24px; 
             border-radius: 4px; color: white; text-align: center; 
             box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); animation: slideIn 0.3s ease;">
          <p style="margin: 0 0 8px; font-weight: 600;">Update Available</p>
          <p style="margin: 0 0 12px; font-size: 0.9em; opacity: 0.9;">Reload to get the latest version</p>
          <div style="display: flex; gap: 8px; justify-content: center;">
            <button id="update-reload" style="background: #ff6b6b; color: white; border: none; 
                    padding: 6px 16px; border-radius: 3px; cursor: pointer; font-weight: 600;">
              Reload Now
            </button>
            <button id="update-later" style="background: rgba(255,255,255,0.2); color: white; 
                    border: none; padding: 6px 16px; border-radius: 3px; cursor: pointer;">
              Later
            </button>
          </div>
          <style>
            @keyframes slideIn {
              from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
              to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
          </style>
        </div>
      `;
      document.body.appendChild(notification);

      document.getElementById('update-reload').addEventListener('click', () => {
        notification.remove();
        window.location.reload();
      });

      document.getElementById('update-later').addEventListener('click', () => {
        notification.remove();
        resolve();
      });

      // Auto-dismiss after 8 seconds
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
          resolve();
        }
      }, 8000);
    });
  }

  async showInstallPrompt(options) {
    return new Promise(resolve => {
      const notification = document.createElement('div');
      notification.innerHTML = `
        <div id="install-notification" style="position: fixed; top: 20px; left: 50%; z-index: 1000; 
             transform: translateX(-50%); background: rgba(0, 100, 200, 0.95); padding: 16px 24px; 
             border-radius: 4px; color: white; text-align: center; 
             box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); animation: slideIn 0.3s ease;">
          <p style="margin: 0 0 8px; font-weight: 600;">Play Offline</p>
          <p style="margin: 0 0 12px; font-size: 0.9em; opacity: 0.9;">Install NSK Warrior to play anytime</p>
          <div style="display: flex; gap: 8px; justify-content: center;">
            <button id="install-confirm" style="background: #4CAF50; color: white; border: none; 
                    padding: 6px 16px; border-radius: 3px; cursor: pointer; font-weight: 600;">
              Install
            </button>
            <button id="install-dismiss" style="background: rgba(255,255,255,0.2); color: white; 
                    border: none; padding: 6px 16px; border-radius: 3px; cursor: pointer;">
              Not Now
            </button>
          </div>
          <style>
            @keyframes slideIn {
              from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
              to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
          </style>
        </div>
      `;
      document.body.appendChild(notification);

      document.getElementById('install-confirm').addEventListener('click', () => {
        notification.remove();
        // Trigger browser install if available, or show custom instructions
        if (window.deferredPrompt) {
          window.deferredPrompt.prompt();
          window.deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
              console.log('User accepted the install prompt');
            }
            window.deferredPrompt = null;
            resolve('installed');
          });
        } else {
          // In iframe or no install available, provide manual instructions
          notificationManager.show('INSTALL_INSTRUCTIONS');
          resolve('instructions_shown');
        }
      });

      document.getElementById('install-dismiss').addEventListener('click', () => {
        localStorage.setItem('install-prompt-dismissed', Date.now());
        notification.remove();
        resolve('dismissed');
      });

      // Auto-dismiss after 10 seconds
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
          resolve('timeout');
        }
      }, 10000);
    });
  }

  async showInstallInstructions(options) {
    return new Promise(resolve => {
      const notification = document.createElement('div');
      const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad/.test(navigator.userAgent);
      
      let instructions = '';
      if (isIOS) {
        instructions = `
          <p style="margin: 0 0 8px; font-size: 0.9em;">1. Tap the Share button</p>
          <p style="margin: 0 0 8px; font-size: 0.9em;">2. Scroll and tap "Add to Home Screen"</p>
          <p style="margin: 0; font-size: 0.9em;">3. Tap "Add" to confirm</p>
        `;
      } else if (isMobile) {
        instructions = `
          <p style="margin: 0 0 8px; font-size: 0.9em;">1. Tap the menu (⋮) or share button</p>
          <p style="margin: 0 0 8px; font-size: 0.9em;">2. Tap "Add to Home Screen"</p>
          <p style="margin: 0; font-size: 0.9em;">3. Tap "Install" or "Add" to confirm</p>
        `;
      } else {
        instructions = `
          <p style="margin: 0 0 8px; font-size: 0.9em;">Look for the install icon in your address bar</p>
          <p style="margin: 0; font-size: 0.9em;">Or right-click the page and select "Install app"</p>
        `;
      }

      notification.innerHTML = `
        <div id="install-instructions" style="position: fixed; top: 20px; left: 50%; z-index: 1000; 
             transform: translateX(-50%); background: rgba(0, 100, 200, 0.95); padding: 16px 24px; 
             border-radius: 4px; color: white; text-align: center; max-width: 90%; 
             box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); animation: slideIn 0.3s ease;">
          <p style="margin: 0 0 12px; font-weight: 600;">Installation Steps</p>
          <div style="text-align: left; font-size: 0.9em; margin-bottom: 12px;">
            ${instructions}
          </div>
          <button id="install-instructions-close" style="background: rgba(255,255,255,0.2); 
                  color: white; border: none; padding: 6px 16px; border-radius: 3px; cursor: pointer;">
            Got It
          </button>
          <style>
            @keyframes slideIn {
              from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
              to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
          </style>
        </div>
      `;
      document.body.appendChild(notification);

      document.getElementById('install-instructions-close').addEventListener('click', () => {
        notification.remove();
        resolve();
      });

      // Auto-dismiss after 12 seconds
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
          resolve();
        }
      }, 12000);
    });
  }

  async showOfflineReady(options) {
    return new Promise(resolve => {
      const storageKey = `offline-ready-notified-${options.cacheName || 'default'}`;
      if (localStorage.getItem(storageKey) === 'true') {
        resolve();
        return;
      }

      localStorage.setItem(storageKey, 'true');
      console.log('showOfflineReady called');

      const notification = document.createElement('div');
      notification.innerHTML = `
        <div id="offline-ready-notification" style="position: fixed; top: 20px; left: 50%; z-index: 1000; 
             transform: translateX(-50%); background: rgba(76, 175, 80, 0.95); padding: 16px 24px; 
             border-radius: 4px; color: white; text-align: center; 
             box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); animation: slideIn 0.3s ease;">
          <p style="margin: 0; font-weight: 700;">Ready for offline play!</p>
          <p style="margin: 6px 0 0; font-size: 0.9em;">Game assets have been saved on this device.</p>
          <style>
            @keyframes slideIn {
              from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
              to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
          </style>
        </div>
      `;
      document.body.appendChild(notification);

      setTimeout(() => {
        const el = document.getElementById('offline-ready-notification');
        if (el) el.style.opacity = '0';
      }, 4000);

      setTimeout(() => {
        notification.remove();
        resolve();
      }, 4600);
    });
  }
}

const notificationManager = new NotificationManager();
