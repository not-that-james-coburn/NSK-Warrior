/**
 * SPA MANAGER - NSK WARRIOR (Integrated)
 */

// --- 1. CONFIGURATION ---
const APP_CONFIG = {
  ejsPath: "emulatorjs/4.0.9/data/",
  core: "mednafen_psx_hw",
  biosUrl: "/api/serve-game/scph5501.bin?key=bios",
  gameUrl: "/api/serve-game/RPG_Maker_USA.zip?key=rom",
  
  versions: {
    'og': {
      label: "Original Game",
      prefix: "NSK_WARRIOR_0",
      loadState: "/versions/original/RPG Maker (USA).state",
      slots: 8,
      legacyKeys: ["NSK WARRIOR", "NSK_WARRIOR_OG", "NSK_WARRIOR_OG_1", "NSK_WARRIOR_OG_2", "NSK_WARRIOR_OG_3", "NSK_WARRIOR_OG_4"]
    },
    'v1.1': {
      label: "Version 1.1",
      prefix: "NSK_WARRIOR_V1",
      loadState: "/versions/v1.1/RPG Maker (USA).state",
      slots: 8,
      legacyKeys: ["NSK WARRIOR v1.1", "NSK_WARRIOR_v1.1", "NSK_WARRIOR_v1.1_1", "NSK_WARRIOR_v1.1_2", "NSK_WARRIOR_v1.1_3", "NSK_WARRIOR_v1.1_4"]
    },
    'kf': {
      label: "Keen-Fine Edition",
      prefix: "NSK_WARRIOR_KF",
      loadState: "/versions/keen-fine/RPG Maker (USA).state",
      slots: 8,
      legacyKeys: ["NSK WARRIOR KF"],
      versionAlert: false,
      alertMessage: "Please wait for next update.\nComing soon!",
      updated: "1.4",
      versionInfo: true,
      infoMessage: "***CRITICAL BUG FIXES***\n\nIn this update:\n\n* Restored Assembly cinematic\n* Filter Room refresh\n* Improved Assembly side quests\n* FIX: Cram-a-lot",
    },
    'tp': {
      label: "Test Play",
      prefix: "TEST_PLAY",
      loadState: "/versions/test-play/RPG Maker (USA).state",
      slots: 8,
      versionAlert: false,
      alertMessage: "Please wait for next update.\nComing soon!",
      updated: "1.7", // Cart, Cramalot, Assembly Cart cinematic, Filter rooms, Assembly quests
      versionInfo: true,
      infoMessage: "***CRITICAL BUG FIXES***\n\nThis version is for testing purposes.\n\n* Exit battles\n* Switch control\n* Clip walls by holding 'Square'",
    }
  }
};

// Global State
let globalMode = 'PLAY';
let anySavesFound = false;
let currentGameVersion = null;

// --- 2. DATABASE CONFIG ---
const DB_STATES = 'EmulatorJS-states';
const DB_SCREENSHOTS = 'EmulatorSaves';
const STORE_STATES = 'states';
const STORE_SCREENSHOTS = 'screenshots';
const KEY_MASTER_LIST = '?EJS_KEYS!';

// --- ROBUST DATABASE HELPERS ---

function openDB(name, version = 1, onUpgrade = null) {
  return new Promise((resolve) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = (e) => { if (onUpgrade) onUpgrade(e.target.result); };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => {
      console.warn(`[DB Error] ${name}:`, e);
      resolve(null);
    };
  });
}

function openStateDB() {
  return openDB(DB_STATES, 1, (db) => {
    if (!db.objectStoreNames.contains(STORE_STATES)) db.createObjectStore(STORE_STATES);
  });
}

function openScreenshotDB() {
  return openDB(DB_SCREENSHOTS, 1, (db) => {
    if (!db.objectStoreNames.contains(STORE_SCREENSHOTS)) db.createObjectStore(STORE_SCREENSHOTS);
  });
}

// --- UTILITIES ---

async function checkForAnySaves() {
  try {
    const db = await openStateDB();
    if (!db || !db.objectStoreNames.contains(STORE_STATES)) { if (db) db.close(); return false; }
    
    return new Promise(resolve => {
      const tx = db.transaction([STORE_STATES], 'readonly');
      const req = tx.objectStore(STORE_STATES).getAllKeys();
      
      req.onsuccess = () => {
        // 1. Get all keys from the DB result
        const allKeys = req.result || [];
        
        // 2. Filter for just the ones starting with your prefix
        const matchingSaves = allKeys.filter(k => k.startsWith("NSK"));
        
        // 3. Log the specific array of filenames found
        if (matchingSaves.length > 0) {
          console.log(`Saves Found: ${matchingSaves.join(', ')}`);
        } else {
          console.log("No NSK_WARRIOR saves found.");
        }
        
        // 4. Resolve true if we found any, false otherwise
        resolve(matchingSaves.length > 0);
      }
      
      req.onerror = () => resolve(false);
    });
  } catch (e) { return false; }
}

async function getSlotInfo(prefix, slotNum) {
  const key = `${prefix}_${slotNum}.state`;
  try {
    const db = await openStateDB();
    if (!db || !db.objectStoreNames.contains(STORE_STATES)) { if (db) db.close(); return "Empty"; }
    return new Promise(resolve => {
      const tx = db.transaction([STORE_STATES], 'readonly');
      const req = tx.objectStore(STORE_STATES).count(key);
      req.onsuccess = () => resolve(req.result > 0 ? "Saved Game" : "Empty");
      req.onerror = () => resolve("Empty");
    });
  } catch (e) { return "Empty"; }
}

async function getSaveBlob(uniqueId) {
  try {
    const db = await openStateDB();
    if (!db || !db.objectStoreNames.contains(STORE_STATES)) { if (db) db.close(); return null; }
    return new Promise(resolve => {
      const tx = db.transaction([STORE_STATES], 'readonly');
      const req = tx.objectStore(STORE_STATES).get(uniqueId + ".state");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  } catch (e) { return null; }
}

/**
 * Checks a list of potential legacy keys and returns the ones that exist.
 * FIX: Strictly ignores keys that match the current version's prefix.
 */
async function findAvailableLegacySaves(keysArray, currentPrefix) {
  if (!keysArray || keysArray.length === 0) return [];
  
  try {
    const db = await openStateDB();
    if (!db || !db.objectStoreNames.contains(STORE_STATES)) return [];
    
    const foundKeys = [];
    const tx = db.transaction([STORE_STATES], 'readonly');
    const store = tx.objectStore(STORE_STATES);
    
    await Promise.all(keysArray.map(key => {
      return new Promise(resolve => {
        // CRITICAL FIX: Ignore keys that belong to the current version
        if (currentPrefix && key.includes(currentPrefix)) {
          // Skip this key, it's a current save slot, not legacy
          resolve();
          return;
        }
        
        const req = store.count(key + ".state");
        req.onsuccess = () => {
          if (req.result > 0) {
            foundKeys.push(key);
            console.log(`Legacy Save Found: ${key}`);
          }
          resolve();
        };
        req.onerror = () => resolve();
      });
    }));
    
    return foundKeys;
  } catch (e) { return []; }
}

async function saveScreenshot(key, blob) {
  const db = await openScreenshotDB();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_SCREENSHOTS], 'readwrite');
    const store = tx.objectStore(STORE_SCREENSHOTS);
    const request = store.put(blob, key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e);
  });
}

async function loadScreenshot(key) {
  try {
    const db = await openScreenshotDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_SCREENSHOTS], 'readonly');
      const req = tx.objectStore(STORE_SCREENSHOTS).get(key);
      req.onsuccess = (e) => {
        const res = e.target.result;
        if (!res) resolve(null);
        else if (res.image) resolve(res);
        else resolve({ image: res, created: null });
      };
      req.onerror = () => resolve(null);
    });
  } catch (e) { return null; }
}

/**
 * Migrates a save from Legacy Name -> New Slot Name
 * FIX: Waits for transaction.oncomplete to prevent rollback before reload.
 */
async function migrateLegacySave(legacyBaseName, targetBaseName) {
  const legacyFile = legacyBaseName + ".state";
  const targetFile = targetBaseName + ".state";
  
  // 1. Migrate State File & Update Index
  const dbStates = await openStateDB();
  if (dbStates && dbStates.objectStoreNames.contains(STORE_STATES)) {
    await new Promise((resolve, reject) => {
      const tx = dbStates.transaction([STORE_STATES], 'readwrite');
      const store = tx.objectStore(STORE_STATES);
      
      // CRITICAL FIX: Only resolve when the transaction is 100% done
      tx.oncomplete = () => {
        console.log("State DB Transaction Committed.");
        resolve();
      };
      
      tx.onerror = (e) => {
        console.error("State DB Transaction Failed:", e);
        reject(e);
      };
      
      store.get(legacyFile).onsuccess = (e) => {
        const data = e.target.result;
        if (data) {
          // A. Move the file
          store.put(data, targetFile);
          store.delete(legacyFile);
          
          // B. Update the EJS Master Index (?EJS_KEYS!)
          store.get(KEY_MASTER_LIST).onsuccess = (e2) => {
            let keys = e2.target.result || [];
            
            // Remove old key
            const oldIdx = keys.indexOf(legacyFile);
            if (oldIdx > -1) keys.splice(oldIdx, 1);
            
            // Add new key (if not already there)
            if (!keys.includes(targetFile)) keys.push(targetFile);
            
            // Save Index back
            store.put(keys, KEY_MASTER_LIST);
          };
        }
        // DO NOT call resolve() here! Wait for tx.oncomplete
      };
    });
  }
  
  // 2. Migrate Screenshot (Same logic applied here for safety)
  const dbScreens = await openScreenshotDB();
  if (dbScreens) {
    await new Promise((resolve, reject) => {
      const tx = dbScreens.transaction([STORE_SCREENSHOTS], 'readwrite');
      const store = tx.objectStore(STORE_SCREENSHOTS);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve(); // Proceed even if screenshot fails
      
      store.get(legacyBaseName).onsuccess = (e) => {
        const data = e.target.result;
        if (data) {
          store.put(data, targetBaseName);
          store.delete(legacyBaseName);
        }
        // DO NOT call resolve() here
      };
    });
  }
  
  await showModal("Migration Complete!", 'alert');
  return true;
}

/**
 * REFACTOR: Completely remove save AND screenshot to reset slot to empty
 */
async function deleteSaveState(keyName) {
  const fileName = keyName + ".state";
  
  // 1. Delete State File
  const dbStates = await openStateDB();
  if (dbStates && dbStates.objectStoreNames.contains(STORE_STATES)) {
    await new Promise(resolve => {
      const tx = dbStates.transaction([STORE_STATES], 'readwrite');
      const store = tx.objectStore(STORE_STATES);
      store.delete(fileName);
      store.get(KEY_MASTER_LIST).onsuccess = (e) => {
        let keys = e.target.result || [];
        const idx = keys.indexOf(fileName);
        if (idx > -1) {
          keys.splice(idx, 1);
          store.put(keys, KEY_MASTER_LIST);
        }
      };
      tx.oncomplete = () => resolve();
    });
  }
  
  // 2. Delete Screenshot
  const dbScreens = await openScreenshotDB();
  if (dbScreens && dbScreens.objectStoreNames.contains(STORE_SCREENSHOTS)) {
    await new Promise(resolve => {
      const tx = dbScreens.transaction([STORE_SCREENSHOTS], 'readwrite');
      tx.objectStore(STORE_SCREENSHOTS).delete(keyName);
      tx.oncomplete = () => resolve();
    });
  }
}

/**
 * Utility: Gets all keys belonging to a specific version prefix
 */
async function getVersionKeys(prefix) {
  const db = await openStateDB();
  return new Promise(resolve => {
    const tx = db.transaction([STORE_STATES], 'readonly');
    const req = tx.objectStore(STORE_STATES).getAllKeys();
    req.onsuccess = () => resolve(req.result.filter(k => k.startsWith(prefix) && k.endsWith('.state')));
    req.onerror = () => resolve([]);
  });
}

// --- HELPERS FOR BUNDLING ---

function blobToBase64(data) {
  return new Promise((resolve, reject) => {
    // SAFETY: If data is null/undefined, stop.
    if (!data) return resolve(null);
    
    // SAFETY: If data is NOT a Blob (e.g. it's an ArrayBuffer), convert it.
    let blob = data;
    if (!(data instanceof Blob)) {
      // Wrap raw data/buffers in a Blob
      blob = new Blob([data]);
    }
    
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64, fallbackType = 'application/octet-stream') {
  // Safety: Ensure input is a string
  if (typeof base64 !== 'string') return null;
  
  // Check if it has the standard Data URI prefix
  const parts = base64.split(',');
  let mime = fallbackType;
  let dataStr = base64;
  
  if (parts.length > 1) {
    // Has prefix (e.g., "data:image/png;base64,...")
    // safely extract mime type
    const mimeMatch = parts[0].match(/:(.*?);/);
    if (mimeMatch) mime = mimeMatch[1];
    dataStr = parts[1];
  }
  
  // Decode
  try {
    const bstr = atob(dataStr);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    console.error("Failed to convert Base64 to Blob:", e);
    return null;
  }
}

/**
 * SHARE: Exports State + Screenshot as a Bundle
 */
async function shareSave(uniqueId) {
  // Define variables outside try block for reuse in fallback
  let stateBlob = null;
  let screenshotData = null;
  
  try {
    // 1. Fetch Data
    stateBlob = await getSaveBlob(uniqueId);
    if (!stateBlob) {
      showModal("Error: Save file is empty or missing.", "alert");
      return;
    }
    
    screenshotData = await loadScreenshot(uniqueId);
    
    // 2. Prepare Bundle (JSON)
    // The new blobToBase64 handles ArrayBuffers safely now.
    const bundle = {
      type: 'NSK_WARRIOR_BUNDLE',
      version: 1,
      timestamp: new Date().toISOString(),
      stateData: await blobToBase64(stateBlob),
      screenshotImage: screenshotData?.image ? await blobToBase64(screenshotData.image) : null,
      screenshotDate: screenshotData?.created || null
    };
    
    const jsonString = JSON.stringify(bundle);
    const fileContent = new Blob([jsonString], { type: 'text/plain' });
    
    // 3. Prepare File
    // We use .txt to satisfy Android Share Sheet requirements
    const shareFile = new File([fileContent], `${uniqueId}.state.txt`, { type: "text/plain" });
    
    // 4. Share
    const shareData = {
      files: [shareFile],
      title: `${uniqueId}`,
      text: 'Exporting save bundle with screenshot.'
    };
    
    if (navigator.canShare && navigator.canShare(shareData)) {
      await navigator.share(shareData);
    } else {
      throw new Error("Native sharing not supported");
    }
    
  } catch (err) {
    console.warn("Share API failed, falling back to download.", err);
    
    // --- FALLBACK: DOWNLOAD AS BUNDLE ---
    // If share fails, we still want to give them the Bundle (JSON), not just the raw state.
    try {
      if (stateBlob) {
        // Re-create the bundle for download
        const bundle = {
          type: 'NSK_WARRIOR_BUNDLE',
          version: 1,
          timestamp: new Date().toISOString(),
          stateData: await blobToBase64(stateBlob),
          screenshotImage: screenshotData?.image ? await blobToBase64(screenshotData.image) : null,
          screenshotDate: screenshotData?.created || null
        };
        
        const jsonString = JSON.stringify(bundle);
        const blob = new Blob([jsonString], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        // For direct download, we can use the specific double extension safely
        a.download = `${uniqueId}.state.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (dlErr) {
      console.error("Download fallback failed", dlErr);
      showModal("Download failed.", "alert");
    }
  }
}

/**
 * IMPORT: Handles Bundles (JSON) or Raw States
 */
async function importSave(uniqueId, verId, container) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.state, .txt, .json';
  
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // 1. READ FILE IMMEDIATELY (Prevent security timeout)
    let fileBuffer;
    try {
      fileBuffer = await file.arrayBuffer();
    } catch (readErr) {
      console.error(readErr);
      showModal("Failed to read file.", "alert");
      return;
    }
    
    // 2. USER CONFIRMATION
    const confirm = await showModal(`Overwrite Slot with ${file.name}?`, 'confirm');
    if (!confirm) return;
    
    // 3. PARSE DATA (Before touching DB)
    let isBundle = false;
    let stateBlobToSave = null;
    let screenshotToSave = null;
    let createdDate = null;
    
    try {
      const textDecoder = new TextDecoder();
      const textContent = textDecoder.decode(fileBuffer);
      const json = JSON.parse(textContent);
      
      if (json.type === 'NSK_WARRIOR_BUNDLE') {
        isBundle = true;
        if (json.stateData) {
          stateBlobToSave = base64ToBlob(json.stateData, 'application/octet-stream');
        }
        if (json.screenshotImage) {
          screenshotToSave = base64ToBlob(json.screenshotImage, 'image/png');
          createdDate = json.screenshotDate;
        }
      }
    } catch (e) {
      isBundle = false;
    }
    
    if (!stateBlobToSave) {
      stateBlobToSave = new Blob([fileBuffer]);
    }
    
    // 4. OPEN ALL DATABASES (Before starting transactions)
    const dbState = await openStateDB();
    const dbScreen = await openScreenshotDB();
    
    if (!dbState) {
      showModal("Database Error: Could not open State DB", "alert");
      return;
    }
    
    // 5. PERFORM TRANSACTIONS (Synchronously queued)
    
    // Transaction A: Save State
    const txState = dbState.transaction([STORE_STATES], 'readwrite');
    txState.objectStore(STORE_STATES).put(stateBlobToSave, uniqueId + ".state");
    
    txState.onerror = (err) => console.error("State DB Error:", err);
    
    // --- Transaction B: Handle Screenshot (Update OR Delete) ---
    const txScreen = dbScreen.transaction([STORE_SCREENSHOTS], 'readwrite');
    const screenStore = txScreen.objectStore(STORE_SCREENSHOTS);
    
    if (screenshotToSave) {
      screenStore.put({
        image: screenshotToSave,
        created: createdDate || new Date().toLocaleString()
      }, uniqueId);
    } else {
      screenStore.delete(uniqueId);
    }
    
    txState.oncomplete = () => {
      showModal("Import Successful", "alert");
      globalMode = 'PLAY';
      renderSaveSlots(verId, container);
    };
  };
  input.click();
}

/**
 * Custom Modal Helper (Replaces alert/confirm)
 * Returns a Promise: true (Confirm/OK) or false (Cancel)
 */
function showModal(message, type = 'alert') {
  return new Promise((resolve) => {
    const overlay = document.getElementById('custom-modal-overlay');
    const msgEl = document.getElementById('modal-message');
    const infoEl = document.getElementById('info-modal-message');
    const btnsEl = document.getElementById('modal-buttons');
    
    msgEl.style.display = 'block';
    infoEl.style.display = 'none';
    msgEl.innerText = message;
    btnsEl.innerHTML = ''; // Clear old buttons
    
    // Create Buttons
    const okBtn = document.createElement('button');
    okBtn.className = 'modal-btn confirm';
    okBtn.innerText = type === 'confirm' ? 'Yes' : 'OK';
    
    okBtn.onclick = (e) => {
      e.stopPropagation();
      overlay.classList.remove('visible');
      resolve(true);
    };
    
    btnsEl.appendChild(okBtn);
    
    if (type === 'confirm') {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'modal-btn';
      cancelBtn.innerText = 'No';
      cancelBtn.onclick = (e) => {
        e.stopPropagation(); // Prevent bubbling
        overlay.classList.remove('visible');
        resolve(false);
      };
      
      btnsEl.appendChild(cancelBtn);
    }
    
    if (type === 'info') {
      msgEl.style.display = 'none';
      infoEl.style.display = 'block';
      infoEl.innerText = message;
    }
    
    overlay.classList.add('visible');
  });
}

/**
 * Handles the visual state of the booklet.
 * Returns TRUE if an action was performed (useful for stopping event chains).
 */
function bookHandler(action) {
  const toggleButton = document.getElementById('toggleButton');
  const blurBackground = document.getElementById('blurBackground');
  const book = document.getElementById('book');
  const bWrapper = document.getElementById('button-wrapper');
  const s1 = document.getElementById("slide1");
  const s2 = document.getElementById("slide2");
  
  if (!toggleButton) return false;
  
  if (action === 'open') {
    if (!toggleButton.checked) {
      toggleButton.checked = true;
      if (blurBackground) blurBackground.style.display = 'block';
      if (bWrapper) bWrapper.style.animationPlayState = 'paused';
      if (book) {
        book.style.left = '0';
        book.style.animation = 'rollIn 0.7s ease forwards';
      }
      if (s1) s1.play();
      return true; // Action performed
    }
  }
  
  if (action === 'close') {
    if (toggleButton.checked) {
      toggleButton.checked = false;
      if (s2) s2.play();
      if (bWrapper) bWrapper.style.animationPlayState = 'running';
      if (book) {
        book.style.left = '-2200px';
        book.style.animation = 'rollOut 0.7s ease forwards';
        
        // Handle Menu Overlap Z-Index
        if (window.versionMenuOpen === true) {
          if (blurBackground) blurBackground.style.zIndex = '15';
        } else {
          if (blurBackground) blurBackground.style.display = 'none';
        }
      }
      return true; // Action performed
    }
  }
  
  return false; // No action needed (already in desired state)
}

// --- 3. UNIFIED NAVIGATION HANDLER ---

window.addEventListener('popstate', async (event) => {
  const state = event.state;
  const gameContainer = document.getElementById('game-container');
  const isGameVisible = window.getComputedStyle(gameContainer).display !== 'none';
  
  // --- 1. HANDLE BOOKLET (Forward) ---
  if (state && state.bookOpen) {
    bookHandler('open');
  }
  
  // --- 2. HANDLE IN-GAME MENU (Forward to #menu) ---
  else if (state && state.menuOpen) {
    // Re-open UI without pushing state again
    document.querySelectorAll('.version-select-btn').forEach(btn => btn.style.display = 'none');
    document.getElementById('ui-layer').style.display = 'flex';
    
    // Use the mode saved in history, or default to SAVE
    transitionToVersions(state.mode || 'SAVE');
    
    if (currentGameVersion) {
      const container = document.getElementById(`slots-${currentGameVersion}`);
      renderSaveSlots(currentGameVersion, container);
    }
    
    // Close Booklet if open
    bookHandler('close');
  }
  
  // --- 3. HANDLE GAME (Back to #game) ---
  else if (state && state.gameStart) {
    // If we came back to the game, ensure overlays are closed
    
    // A. Close Booklet if open
    bookHandler('close');
    
    // B. Close In-Game Menu if open
    if (window.versionMenuOpen) {
      closeInGameMenu();
    }
  }
  
  // --- 4. HANDLE EXIT / ROOT ---
  else {
    if (toggleButton.checked) {
      bookHandler('close');
      return
      
    } else {
      // Exit Prompt Logic
      if (isGameVisible) {
        const msg = (window.EJS_emulator.settings['save-state-location'] !== 'download') ?
          "Save and Exit?" :
          "Exit? Progress will NOT be saved.";
        
        showModal(msg, 'confirm').then(async (shouldExit) => {
          if (!shouldExit) {
            window.history.pushState({ gameStart: true }, '', '#game');
            return;
          }
          
          if (window.EJS_emulator.settings['save-state-location'] !== 'download') {
            console.log('Back navigation detected. Saving...');
            try { await performManualSave(); } catch (err) { console.error("Save failed:", err); }
          }
          window.location.reload();
        });
      }
    }
  }
});

// --- 4. UI & MENU LOGIC ---

async function initApp() {
  if (window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname);
  }
  globalMode = 'PLAY';
  anySavesFound = await checkForAnySaves();
  initVersionMenuStructure();
  renderStartMenu();
}

function initVersionMenuStructure() {
  const root = document.getElementById('version-list-root');
  if (!root) return;
  root.innerHTML = '';
  root.className = "version-list-flex";
  
  Object.entries(APP_CONFIG.versions).forEach(([id, config]) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'version-unit';
    
    const btn = document.createElement('button');
    btn.className = 'select_button version-select-btn';
    btn.innerText = config.label;
    btn.onclick = () => handleVersionSelect(id);
    btn.dataset.verId = id;
    if (id === "tp") btn.style.cssText = "background: rgba(50, 0, 0, 0.9); border: 1px solid #a00000";
    
    const container = document.createElement('div');
    container.id = `slots-${id}`;
    container.className = 'save-slot-container';
    
    wrapper.appendChild(btn);
    wrapper.appendChild(container);
    root.appendChild(wrapper);
  });
}

function toggleManageMode(verId, container) {
  if (globalMode === 'PLAY') globalMode = 'MANAGE';
  else if (globalMode === 'MANAGE') globalMode = 'PLAY';
  
  // Refresh only the container that triggered this
  renderSaveSlots(verId, container);
}

function renderStartMenu() {
  const menu = document.getElementById('start-menu');
  menu.innerHTML = '';
  
  const btn = createBtn("PLAY", () => transitionToVersions('PLAY'));
  btn.id = 'start_button';
  menu.appendChild(btn);
}

function createBtn(text, onClick) {
  const btn = document.createElement('button');
  btn.className = 'select_button';
  btn.innerText = text;
  btn.onclick = (e) => {
    e.stopPropagation();
    onClick(e);
  };
  return btn;
}

function createSVGBtn(icon, color, onClick) {
  const btn = document.createElement('button');
  btn.innerHTML = icon;
  btn.style.cssText = `
        width: 42px; height: 42px; border-radius: 50%; border: none;
        outline: none; -webkit-tap-highlight-color: transparent;
        background: ${color}; color: white; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: transform 0.1s;
    `;
  btn.onclick = (e) => {
    e.stopPropagation();
    btn.style.transform = "scale(0.9)";
    setTimeout(() => btn.style.transform = "scale(1)", 100);
    onClick();
  };
  return btn;
}

window.versionMenuOpen = false;

function transitionToVersions(mode) {
  globalMode = mode;
  
  const header = document.querySelector('#version-menu h2');
  if (header) {
    header.childNodes[0].nodeValue = (mode === 'SAVE' ? "SAVE GAME" : (mode === 'LOAD' ? "LOAD GAME" : "SELECT VERSION"));
  }
  
  const backBtn = document.querySelector('#close_button');
  if (backBtn) {
    backBtn.style.display = (mode === 'PLAY') ? 'none' : 'inline-block';
  }
  
  document.getElementById('start-menu').classList.add('slide-out-down');
  const blur = document.getElementById('blurBackground');
  
  setTimeout(() => {
    document.getElementById('version-menu').classList.add('slide-in-down');
    if (blur) blur.style = `display: block; z-index: 15`;
  }, 100);
  window.versionMenuOpen = true;
}

function resetToTitle() {
  if (document.getElementById('game-container').style.display !== 'none') {
    closeInGameMenu();
    return;
  }
  
  document.querySelectorAll('.save-slot-container').forEach(el => el.classList.remove('open'));
  window.versionMenuOpen = false;
  document.getElementById('version-menu').classList.remove('slide-in-down');
  
  const blur = document.getElementById('blurBackground');
  if (blur) blur.style.display = 'none';
  
  setTimeout(() => {
    document.getElementById('start-menu').classList.remove('slide-out-down');
  }, 300);
}

function openInGameMenu(mode) {
  const s1 = document.getElementById("slide1");
  const s2 = document.getElementById("slide2");
  document.querySelectorAll('.version-select-btn').forEach(btn => btn.style.display = 'none');
  document.getElementById('ui-layer').style.display = 'flex';
  window.history.pushState({ menuOpen: true, mode: mode }, '', '#menu');
  transitionToVersions(mode);
  if (currentGameVersion) {
    const container = document.getElementById(`slots-${currentGameVersion}`);
    renderSaveSlots(currentGameVersion, container);
  }
  if (s1) s1.play();
}

function closeInGameMenu() {
  const s1 = document.getElementById("slide1");
  const s2 = document.getElementById("slide2");
  if (window.location.hash === '#menu') {
    window.history.back();
    return;
  }
  document.getElementById('version-menu').classList.remove('slide-in-down');
  const blur = document.getElementById('blurBackground');
  if (blur) blur.style.display = 'none';
  if (s2) s2.play();
  setTimeout(() => {
    document.getElementById('ui-layer').style.display = 'none';
    window.versionMenuOpen = false;
  }, 300);
}

async function handleVersionSelect(verId) {
  if (!verId || !APP_CONFIG.versions[verId]) return;
  
  if ((globalMode === 'SAVE' || globalMode === 'LOAD') && verId !== currentGameVersion) return;
  
  document.querySelectorAll('.save-slot-container').forEach(el => {
    if (el.id !== `slots-${verId}`) el.classList.remove('open');
  });
  
  const config = APP_CONFIG.versions[verId];
  if (config.versionAlert === true) { await showModal(config.alertMessage, 'alert'); return; }
  
  const container = document.getElementById(`slots-${verId}`);
  if (container.classList.contains('open')) {
    container.classList.remove('open');
  } else {
    await renderSaveSlots(verId, container);
  }
  if (config.versionInfo === true) {
    await showModal(config.infoMessage, 'info');
    config.versionInfo = false;
    return;
  }
}

async function renderSaveSlots(verId, container) {
  container.innerHTML = '';
  const config = APP_CONFIG.versions[verId];
  
  // 1. Find ALL valid legacy saves for this version
  let foundLegacySaves = [];
  if (globalMode === 'PLAY' && config.legacyKeys) {
    foundLegacySaves = await findAvailableLegacySaves(config.legacyKeys, config.prefix);
  }
  
  for (let i = 1; i <= config.slots; i++) {
    const uniqueId = `${config.prefix}_${i}`;
    const status = await getSlotInfo(config.prefix, i);
    const screenshotData = await loadScreenshot(uniqueId);
    
    const row = document.createElement('div');
    row.className = 'slot-row';
    
    // Thumbnail
    const img = document.createElement('img');
    img.style.width = "150px";
    img.style.objectFit = "cover";
    img.style.marginRight = "10px";
    img.style.borderRadius = "4px";
    if (screenshotData && screenshotData.image) img.src = URL.createObjectURL(screenshotData.image);
    else img.src = "images/save-placeholder.png";
    
    // Text Info
    const infoDiv = document.createElement('div');
    infoDiv.className = "infoDiv";
    infoDiv.style = "margin-right:10px;flex:1;width:70px;overflow-wrap:break-word";
    
    let displayStatus = status;
    let importTargetKey = null;
    
    // 2. Logic: If slot is empty AND we have a legacy save in our "found" pile...
    if (status === "Empty" && foundLegacySaves.length > 0 && globalMode === 'PLAY') {
      // Grab the first available legacy save
      importTargetKey = foundLegacySaves.shift(); // Removes it from array so next slot gets the next one
      let rawStatus = `Legacy Save Found: ${importTargetKey}`;
      displayStatus = rawStatus.replace(/_/g, '_<wbr/>');
    }
    
    const dateDisplay = screenshotData?.created ?
      screenshotData.created.replace(' ', '<br>') :
      displayStatus;
    
    infoDiv.innerHTML = `<div style="font-weight:bold; font-size: 0.9em">Slot ${i}</div>
                         <div style="font-size:0.7em; color:#aaa; line-height: 1.2;">${dateDisplay}</div>`;
    
    // --- BUTTON LOGIC ---
    const actionBtn = document.createElement('button');
    actionBtn.className = 'modal-btn';
    actionBtn.style.whiteSpace = "nowrap";
    actionBtn.style.margin = "0"; // Reset any margins
    
    // 1. SAVE MODE
    if (globalMode === 'SAVE') {
      actionBtn.innerText = (status === "Empty") ? "Save New" : "Overwrite";
      actionBtn.style.backgroundColor = (status === "Empty") ? "#a00000" : "rgba(50, 0, 0, 0.9)";
      actionBtn.style.border = (status === "Empty") ? "none" : "1px solid #a00000";
      actionBtn.onclick = async (e) => {
        e.stopPropagation();
        if (status !== "Empty") {
          const confirmOverwrite = await showModal("Overwrite this save?", 'confirm');
          if (!confirmOverwrite) return;
        }
        performManualSave(uniqueId).then(async () => {
          await showModal("Game Saved!", 'alert');
          closeInGameMenu();
        });
      };
      // APPEND BUTTON
      row.appendChild(actionBtn);
    }
    // 2. MANAGE MODE (Updated from Delete Mode)
    else if (globalMode === 'MANAGE') {
      
      const btnGroup = document.createElement('div');
      btnGroup.style.cssText = 'display:flex; margin-left:auto;';
      
      // --- DELETE SAVE FILE BUTTON ---
      const delBtn = createSVGBtn(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#a00000" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" role="img" title="Delete File">
        <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
        '#00000000', async () => {
          if (status !== "Saved Game") return;
          const confirm = await showModal(`Delete Slot ${i}?`, 'confirm');
          if (confirm) {
            await deleteSaveState(uniqueId);
            renderSaveSlots(verId, container);
          }
        });
      if (status !== "Saved Game") delBtn.style.opacity = '0.3';
      
      // --- SHARE SAVE FILE BUTTON ---
      const shareBtn = createSVGBtn(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>',
        '#00000000', async () => {
          if (status !== "Saved Game") return;
          await shareSave(uniqueId);
        });
      if (status !== "Saved Game") shareBtn.style.opacity = '0.3';
      
      // --- IMPORT SAVE FILE BUTTON ---
      const impBtn = createSVGBtn(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="1" y2="12"></line></svg>',
        '#00000000', () => importSave(uniqueId, verId, container));
      
      btnGroup.append(delBtn, shareBtn, impBtn);
      row.appendChild(btnGroup);
    }
    // 3. PLAY / LOAD MODE
    else {
      if (importTargetKey) {
        actionBtn.innerText = "Import";
        actionBtn.style.cssText += "background-color: rgba(50, 0, 0, 0.9); border: 1px solid #27ae60;";
        actionBtn.onclick = async (e) => {
          e.stopPropagation();
          const doImport = await showModal(`Import "${importTargetKey}" to Slot ${i}?`, 'confirm');
          if (doImport) {
            // A. Run Migration and wait for it to finish
            const success = await migrateLegacySave(importTargetKey, uniqueId);
            
            // B. If successful, re-render this menu instantly
            if (success) {
              await renderSaveSlots(verId, container);
            }
          }
        };
      }
      else if (status === "Empty") {
        const storageKey = `${verId}_UPDATE_ACKNOWLEDGED`;
        const lastSeenVersion = localStorage.getItem(storageKey);
        const showUpdateTag = config.updated && (lastSeenVersion !== config.updated);
        
        if (showUpdateTag) {
          actionBtn.innerText = "Updated";
          actionBtn.classList.add('pulse');
        } else {
          actionBtn.innerText = "New Game";
        }
        actionBtn.style.backgroundColor = "#a00000";
        actionBtn.onclick = (e) => {
          e.stopPropagation();
          if (showUpdateTag) {
            localStorage.setItem(storageKey, config.updated);
          }
          launchGame(verId, i);
        };
      }
      else {
        actionBtn.innerText = (globalMode === 'LOAD') ? "Load" : "Continue";
        actionBtn.style.cssText += "background-color: rgba(50, 0, 0, 0.9); border: 1px solid #a00000;";
        actionBtn.onclick = async (e) => {
          e.stopPropagation();
          if (globalMode === 'LOAD') {
            const doLoad = await showModal("Load this save? Unsaved progress will be lost.", 'confirm');
            if (!doLoad) return;
            performManualLoad(uniqueId);
            closeInGameMenu();
          } else {
            launchGame(verId, i);
          }
        };
      }
      row.appendChild(actionBtn);
    }
    
    row.insertBefore(infoDiv, row.lastChild);
    row.insertBefore(img, infoDiv);
    
    container.appendChild(row);
  }
  
  // --- FOOTER ELEMENTS ---
  
  // 1. MANAGE Mode Toggle (Only in PLAY/MANAGE - Main Menu)
  if (globalMode === 'PLAY' || globalMode === 'MANAGE') {
    const toggleRow = document.createElement('div');
    toggleRow.style.textAlign = "center";
    toggleRow.style.padding = "10px";
    toggleRow.style.borderTop = "1px solid #333";
    
    const toggleBtn = document.createElement('button');
    toggleBtn.innerText = (globalMode === 'MANAGE') ? "Done" : "Manage Saves";
    toggleBtn.style.cssText = "background: transparent; color: #888; border: 1px solid #555; padding: 5px 15px; border-radius: 20px; font-size: 11px; cursor: pointer;";
    
    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      toggleManageMode(verId, container);
    };
    
    toggleRow.appendChild(toggleBtn);
    container.appendChild(toggleRow);
  }
  
  // 2. Tab-Style Close Button (Only in SAVE/LOAD - In Game)
  if (globalMode === 'SAVE' || globalMode === 'LOAD') {
    // Switch to relative position for in game menu to center over game screen
    document.querySelector('.save-slot-container').style.position = "relative";
    const closeRow = document.createElement('div');
    closeRow.style.cssText = "display: flex; justify-content: center; background: rgba(255,255,255,0.15); margin-top: 10px; border-radius: 25px; cursor: pointer; padding: 5px;";
    closeRow.onclick = closeInGameMenu;
    
    // SVG Up Arrow / Close Icon
    closeRow.innerHTML = `
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 54 54" style="width: 35px; height: 35px; fill: white;">
          <g><path d="M27.707,18.935c-0.391-0.391-1.023-0.391-1.414,0l-10.5,10.5c-0.391,0.391-0.391,1.023,0,1.414s1.023,0.391,1.414,0 L27,21.056l9.793,9.793c0.195,0.195,0.451,0.293,0.707,0.293s0.512-0.098,0.707-0.293c0.391-0.391,0.391-1.023,0-1.414 L27.707,18.935z" /></g>
        </svg>
      `;
    
    container.appendChild(closeRow);
  }
  
  container.classList.add('open');
}

// --- 5. EMULATOR & GAME LOGIC ---

/**
 * Injects a custom "Exit" button into the EmulatorJS toolbar.
 */
function injectExitButton() {
  // We use a timer because the Emulator builds its UI dynamically after load
  let attempts = 0;
  const findToolbar = setInterval(() => {
    attempts++;
    // Look for the main button container in EJS 4.x
    const toolbar = document.querySelector('.ejs_menu_bar');
    
    if (toolbar) {
      clearInterval(findToolbar);
      
      // Prevent duplicate buttons if function runs twice
      if (document.getElementById('ejs-custom-exit')) return;
      
      // Create the button wrapper
      const btn = document.createElement('div');
      btn.id = 'ejs-custom-exit';
      btn.className = 'ejs_menu_button'; // Re-use EJS styling class
      
      btn.innerHTML = `
        <svg viewBox="0 0 460 460"><path style="fill:none;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;stroke:rgb(255,255,255);stroke-opacity:1;stroke-miterlimit:4;" d="M 14.000061 7.636414 L 14.000061 4.5 C 14.000061 4.223877 13.776123 3.999939 13.5 3.999939 L 4.5 3.999939 C 4.223877 3.999939 3.999939 4.223877 3.999939 4.5 L 3.999939 19.5 C 3.999939 19.776123 4.223877 20.000061 4.5 20.000061 L 13.5 20.000061 C 13.776123 20.000061 14.000061 19.776123 14.000061 19.5 L 14.000061 16.363586 " transform="matrix(21.333333,0,0,21.333333,0,0)"/><path style="fill:none;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;stroke:rgb(255,255,255);stroke-opacity:1;stroke-miterlimit:4;" d="M 9.999939 12 L 21 12 M 21 12 L 18.000366 8.499939 M 21 12 L 18 15.500061 " transform="matrix(21.333333,0,0,21.333333,0,0)"/></svg>
      <span class="ejs_menu_text">Exit</span>`;
      
      // Click Handler (Uses our custom showModal)
      btn.onclick = async () => {
        // 1. Pause (Optional, usually good practice)
        if (window.EJS_emulator) {
          window.EJS_emulator.pause();
        }
        
        // 2. Determine Message
        const msg = (window.EJS_emulator.settings['save-state-location'] !== 'download') ?
          "Exit Game? Progress will be saved." :
          "Exit Game? Progress will NOT be saved.";
        
        // 3. Confirm
        const doExit = await showModal(msg, 'confirm');
        
        if (doExit) {
          if (window.EJS_emulator.settings['save-state-location'] !== 'download') {
            try { await performManualSave(); } catch (e) { console.error(e); }
          }
          window.location.reload(); // Graceful Exit
        } else {
          // Resume if canceled
          if (window.EJS_emulator && window.EJS_emulator.gameManager) {
            window.EJS_emulator.play();
          }
        }
      };
      
      // Append to the toolbar
      toolbar.appendChild(btn);
      console.log("Custom Exit Button injected.");
    }
    
    // Stop trying after 10 seconds
    if (attempts > 20) clearInterval(findToolbar);
  }, 500);
}

function displayIcon(icon) {
  const emulator = window.EJS_emulator;
  if (!emulator) return;
  
  if (!emulator.iconElem) {
    emulator.iconElem = emulator.createElement("div");
    Object.assign(emulator.iconElem.style, {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      zIndex: "1000",
      width: "100px",
      height: "100px",
      color: "white",
      opacity: "0.7",
      transition: "opacity 0.5s ease",
      pointerEvents: "none",
      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    });
    emulator.elements.parent.appendChild(emulator.iconElem);
  }
  clearTimeout(emulator.iconTimeout);
  clearTimeout(emulator.iconCleanupTimeout);
  emulator.iconElem.innerHTML = icon;
  requestAnimationFrame(() => emulator.iconElem.style.opacity = "1");
  emulator.iconTimeout = setTimeout(() => {
    emulator.iconElem.style.opacity = "0";
    emulator.iconCleanupTimeout = setTimeout(() => emulator.iconElem.innerHTML = "", 500);
  }, 1500);
}

function goFullScreen() {
  const el = document.body;
  const requestFS = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
  if (requestFS) requestFS.call(el).catch(err => console.error('Fullscreen error:', err));
}

async function performManualSave(targetId = null) {
  if (!window.EJS_emulator || !window.EJS_emulator.gameManager) return;
  
  const emulator = window.EJS_emulator;
  const saveName = (targetId || window.EJS_gameName) + ".state";
  
  try {
    const state = await emulator.gameManager.getState();
    
    // Check setting: Browser or Download?
    if (emulator.settings['save-state-location'] === 'browser') {
      // --- BROWSER SAVE ---
      await emulator.storage.states.put(saveName, state);
      
      const saveSVG = `<svg viewBox="0 0 448 512"><path fill="currentColor" d="M433.941 129.941l-83.882-83.882A48 48 0 0 0 316.118 32H48C21.49 32 0 53.49 0 80v352c0 26.51 21.49 48 48 48h352c26.51 0 48-21.49 48-48V163.882a48 48 0 0 0-14.059-33.941zM224 416c-35.346 0-64-28.654-64-64 0-35.346 28.654-64 64-64s64 28.654 64 64c0 35.346-28.654 64-64 64zm96-304.52V212c0 6.627-5.373 12-12 12H76c-6.627 0-12-5.373-12-12V108c0-6.627 5.373-12 12-12h228.52c3.183 0 6.235 1.264 8.485 3.515l3.48 3.48A11.996 11.996 0 0 1 320 111.48z"/></svg>`;
      displayIcon(saveSVG);
      
      const screenshotData = emulator.gameManager.screenshot();
      const blob = new Blob([screenshotData], { type: 'image/png' });
      const date = new Date();
      const timeString = `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      
      await saveScreenshot(targetId || window.EJS_gameName, { image: blob, created: timeString });
      console.log(`Saved to Browser: ${targetId || window.EJS_gameName}`);
      
    } else {
      // --- DOWNLOAD SAVE ---
      const blob = new Blob([state]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = saveName;
      a.click();
      URL.revokeObjectURL(url);
      console.log("Save downloaded.");
    }
    
    if (targetId) window.EJS_gameName = targetId;
    
  } catch (err) { console.error("Error saving:", err); }
}

async function performManualLoad(targetId = null) {
  if (!window.EJS_emulator || !window.EJS_emulator.gameManager) return;
  
  const emulator = window.EJS_emulator;
  const saveName = (targetId || window.EJS_gameName) + ".state";
  
  try {
    // Check setting: Browser or Download?
    if (emulator.settings['save-state-location'] === 'browser') {
      // --- BROWSER LOAD ---
      const state = await emulator.storage.states.get(saveName);
      if (state) {
        emulator.gameManager.loadState(state);
        const loadSVG = `<svg viewBox="0 0 576 512"><path fill="currentColor" d="M572.694 292.093L500.27 416.248A63.997 63.997 0 0 1 444.989 448H45.025c-18.523 0-30.064-20.093-20.731-36.093l72.424-124.155A64 64 0 0 1 152 256h399.964c18.523 0 30.064 20.093 20.73 36.093zM152 224h328v-48c0-26.51-21.49-48-48-48H272l-64-64H48C21.49 64 0 85.49 0 112v278.046l69.077-118.418C86.214 242.25 117.989 224 152 224z"/></svg>`;
        displayIcon(loadSVG);
        console.log(`Loaded from Browser: ${targetId || window.EJS_gameName}`);
      }
    } else {
      // --- DOWNLOAD (FILE) LOAD ---
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.state';
      input.style.display = 'none';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const arrayBuffer = await file.arrayBuffer();
        const state = new Uint8Array(arrayBuffer);
        emulator.gameManager.loadState(state);
        console.log("State Loaded from File.");
      };
      document.body.appendChild(input);
      input.click();
      setTimeout(() => document.body.removeChild(input), 1000);
    }
    if (targetId) window.EJS_gameName = targetId;
    
  } catch (err) { console.error("Error loading:", err); }
}

window.EJS_onGameStart = async function(emulator) {
  window.history.pushState({ gameStart: true }, '', '#game');
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'hidden' && window.EJS_emulator.settings['save-state-location'] !== 'download') {
      await performManualSave();
    }
  });
  // Add custom button to EJS toolbar
  injectExitButton();
  // Add custom gamepad styles (draggable + PSX svg shapes)
  if (window.initVirtualGamepad) {
    window.initVirtualGamepad();
  }
};

// REFACTOR: Smart Hook - Check Save Location
window.EJS_onSaveState = function(e) {
  if (window.EJS_emulator.settings['save-state-location'] === 'download') {
    performManualSave(); // Bypass Menu
    return true;
  }
  openInGameMenu('SAVE');
  return true;
};

// REFACTOR: Smart Hook - Check Save Location
window.EJS_onLoadState = function(e) {
  if (window.EJS_emulator.settings['save-state-location'] === 'download') {
    performManualLoad(); // Bypass Menu
    return true;
  }
  openInGameMenu('LOAD');
  return true;
};

// --- 6. LAUNCHER ---

async function launchGame(verId, slotNum) {
  const config = APP_CONFIG.versions[verId];
  const uniqueId = `${config.prefix}_${slotNum}`;
  
  // HOT-SWAP
  if (window.EJS_emulator && window.EJS_emulator.gameManager && document.getElementById('game-container').style.display !== 'none') {
    closeInGameMenu();
    currentGameVersion = verId;
    window.EJS_gameName = uniqueId;
    await performManualLoad(uniqueId);
    return;
  }
  
  // COLD LAUNCH
  document.getElementById('ui-layer').style.display = 'none';
  document.getElementById('bg-img').style.display = 'none';
  document.getElementById('game-container').style.display = 'flex';
  const blur = document.getElementById('blurBackground');
  if (blur) blur.style.display = 'none';
  window.versionMenuOpen = false;
  
  const oldScript = document.getElementById('ejs-loader');
  if (oldScript) oldScript.remove();
  
  currentGameVersion = verId;
  
  window.EJS_player = '#game';
  window.EJS_core = APP_CONFIG.core;
  window.EJS_gameName = uniqueId;
  window.EJS_gameUrl = APP_CONFIG.gameUrl;
  window.EJS_biosUrl = APP_CONFIG.biosUrl;
  window.EJS_pathtodata = APP_CONFIG.ejsPath;
  window.EJS_startOnLoaded = true;
  window.EJS_color = "#800000";
  window.EJS_backgroundColor = "#000000";
  window.EJS_threads = (typeof SharedArrayBuffer !== 'undefined' && typeof Atomics !== 'undefined');
  console.log("Threads enabled?", EJS_threads);
  window.EJS_Buttons = { restart: false };
  window.EJS_defaultOptions = { 'save-state-location': 'browser' };
  
  let rawData = await getSaveBlob(uniqueId);
  if (rawData) {
    let blob = rawData;
    if (!(rawData instanceof Blob)) blob = new Blob([rawData]);
    window.EJS_loadStateURL = URL.createObjectURL(blob);
  } else {
    window.EJS_loadStateURL = config.loadState;
  }
  
  goFullScreen();
  
  const script = document.createElement('script');
  script.src = APP_CONFIG.ejsPath + 'loader.js';
  script.id = 'ejs-loader';
  document.body.appendChild(script);
}

document.addEventListener('DOMContentLoaded', initApp);