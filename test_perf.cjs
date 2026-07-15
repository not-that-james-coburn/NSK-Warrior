// Mock necessary globals
global.document = {
  createElement: (tag) => ({
    style: {},
    className: '',
    appendChild: () => {},
    innerHTML: '',
    addEventListener: () => {}
  })
};

global.URL = {
  createObjectURL: () => 'mock_url'
};

const APP_CONFIG = {
  versions: {
    'og': {
      prefix: "NSK_WARRIOR_0",
      slots: 8,
      legacyKeys: []
    }
  }
};

global.globalMode = 'PLAY';
global.APP_CONFIG = APP_CONFIG;

// Mock functions
global.findAvailableLegacySaves = async () => [];
global.getSlotInfo = async (prefix, i) => {
  return new Promise(resolve => setTimeout(() => resolve(`Status ${i}`), 10)); // 10ms delay
};
global.loadScreenshot = async (id) => {
  return new Promise(resolve => setTimeout(() => resolve({ image: {}, created: '2023-01-01' }), 10)); // 10ms delay
};

global.openConfirmModal = () => {};

// Add original renderSaveSlots
const fs = require('fs');
const vmSource = fs.readFileSync('version-manager.js', 'utf8');

const renderSaveSlotsOriginal = async function renderSaveSlots(verId, container) {
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

    row.appendChild(img);
    row.appendChild(infoDiv);
    row.appendChild(actionBtn);
    container.appendChild(row);
  }
};

const renderSaveSlotsOptimized = async function renderSaveSlots(verId, container) {
  container.innerHTML = '';
  const config = APP_CONFIG.versions[verId];

  // 1. Find ALL valid legacy saves for this version
  let foundLegacySaves = [];
  if (globalMode === 'PLAY' && config.legacyKeys) {
    foundLegacySaves = await findAvailableLegacySaves(config.legacyKeys, config.prefix);
  }

  const slotPromises = [];
  for (let i = 1; i <= config.slots; i++) {
    const uniqueId = `${config.prefix}_${i}`;
    slotPromises.push(Promise.all([
      i,
      uniqueId,
      getSlotInfo(config.prefix, i),
      loadScreenshot(uniqueId)
    ]));
  }

  const slotResults = await Promise.all(slotPromises);

  for (const [i, uniqueId, status, screenshotData] of slotResults) {
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

    row.appendChild(img);
    row.appendChild(infoDiv);
    row.appendChild(actionBtn);
    container.appendChild(row);
  }
};

async function runBenchmark() {
  const container1 = { innerHTML: '', appendChild: () => {} };
  const container2 = { innerHTML: '', appendChild: () => {} };

  console.log("Running baseline benchmark...");
  const startOriginal = performance.now();
  await renderSaveSlotsOriginal('og', container1);
  const endOriginal = performance.now();
  console.log(`Baseline time: ${endOriginal - startOriginal} ms`);

  console.log("Running optimized benchmark...");
  const startOptimized = performance.now();
  await renderSaveSlotsOptimized('og', container2);
  const endOptimized = performance.now();
  console.log(`Optimized time: ${endOptimized - startOptimized} ms`);
}

runBenchmark();
