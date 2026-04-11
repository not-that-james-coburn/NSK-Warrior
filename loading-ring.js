// Custom loading ring graphic with task-based progress tracking
class BearingLoader {
    constructor(ringId, textId) {
        this.ring = document.getElementById(ringId);
        this.text = document.getElementById(textId);
        
        // Calculate circumference dynamically based on radius
        this.radius = this.ring.r.baseVal.value;
        this.circumference = 2 * Math.PI * this.radius;
        
        // Setup initial SVG states
        this.ring.style.strokeDasharray = `${this.circumference} ${this.circumference}`;
        this.ring.style.strokeDashoffset = this.circumference;
        
        // Progress tracking per task
        this.currentProgress = 0;
        this.lastTaskName = '';
    }
    
    setProgress(percent) {
        const validPercent = Math.min(100, Math.max(0, percent));
        this.currentProgress = validPercent;
        this.updateRing(validPercent);
    }
    
    updateRing(percent) {
        const offset = this.circumference - (percent / 100) * this.circumference;
        this.ring.style.strokeDashoffset = offset;
        this.text.textContent = `${Math.floor(percent)}%`;
    }
    
    resetForNewTask() {
        // Reset both counter AND visual ring for next task
        this.currentProgress = 0;
        this.updateRing(0);
    }
    
    hideOverlay() {
        const overlay = document.getElementById('custom-loader-overlay');
        overlay.style.display = 'none';
    }
}

const myLoader = new BearingLoader('loading-ring', 'loading-text');
const overlay = document.getElementById('custom-loader-overlay');
const statusLabel = document.getElementById('status-task');
const targetNode = document.querySelector('#game');

const config = { childList: true, subtree: true, characterData: true };

let emulatorReadyCheckInterval = null;

const callback = function(mutationsList, observer) {
    const loadingElem = targetNode.querySelector('.ejs_loading_text');
    
    if (loadingElem) {
        overlay.style.display = 'flex';
        
        // Use textContent to get the loading progress
        const rawText = loadingElem.textContent || "";
        
        // Hide the element completely so nothing renders behind
        loadingElem.style.display = 'none';
        
        // 1. Parse Progress FIRST (either percentage or MB)
        let percent = 0;
        let foundProgress = false;
        
        // Check for percentage format (e.g., "45%")
        const percentMatch = rawText.match(/(\d+)%/);
        if (percentMatch) {
            percent = parseInt(percentMatch[1]);
            foundProgress = true;
        } else {
            // Check for MB format (e.g., "150.5MB / 40MB") - anywhere in string, not just end
            const mbMatch = rawText.match(/(\d+(?:\.\d+)?)\s*MB\s*\/\s*(\d+(?:\.\d+)?)\s*MB/);
            if (mbMatch) {
                const downloaded = parseFloat(mbMatch[1]);
                const total = parseFloat(mbMatch[2]);
                if (total > 0) {
                    percent = Math.round((downloaded / total) * 100);
                    foundProgress = true;
                    console.log(`[Loader] MB Progress: ${downloaded}MB / ${total}MB = ${percent}%`);
                }
            }
        }
        
        // 2. Parse Task Name - remove BOTH percentage and MB patterns
        let taskName = rawText
            .replace(/\d+%/, '') // Remove percentage
            .replace(/\d+(?:\.\d+)?\s*MB\s*\/\s*\d+(?:\.\d+)?\s*MB/, '') // Remove MB progress
            .trim();
        
        if (!taskName && rawText.length > 0) taskName = rawText;
        
        // 3. Detect task changes and reset ring animation
        if (taskName && taskName !== myLoader.lastTaskName) {
            myLoader.lastTaskName = taskName;
            myLoader.resetForNewTask();
            console.log(`[Loader] New task: "${taskName}"`);
            
            // Update task label immediately
            statusLabel.textContent = taskName;
        }
        
        // Update ring with calculated percentage
        if (foundProgress) {
            myLoader.setProgress(percent);
        }
        
        // Start checking if emulator is ready
        if (!emulatorReadyCheckInterval) {
            emulatorReadyCheckInterval = setInterval(() => {
                // Check if the emulator canvas is visible and has rendered content
                const canvas = targetNode.querySelector('canvas');
                const emulator = window.EJS_emulator;
                
                // Hide loader if:
                // 1. Canvas exists and is visible (game rendering)
                // 2. Emulator exists and is playing
                if ((canvas && canvas.offsetParent !== null) ||
                    (emulator && emulator.gameManager && !emulator.paused)) {
                    
                    console.log('[Loader] Game started, hiding overlay');
                    myLoader.hideOverlay();
                    clearInterval(emulatorReadyCheckInterval);
                    emulatorReadyCheckInterval = null;
                    observer.disconnect();
                }
            }, 100);
        }
    } else {
        // Loading element disappeared - game is taking over, hide overlay
        console.log('[Loader] Loading element disappeared, hiding overlay');
        myLoader.hideOverlay();
        if (emulatorReadyCheckInterval) clearInterval(emulatorReadyCheckInterval);
        emulatorReadyCheckInterval = null;
        observer.disconnect();
    }
};

const observer = new MutationObserver(callback);
observer.observe(targetNode, config);

// Fallback: Force hide after 30 seconds in case checks fail
setTimeout(() => {
    if (overlay.style.display === 'flex') {
        console.warn('[Loader] Fallback: Force-hiding overlay after 30s timeout');
        myLoader.hideOverlay();
        if (emulatorReadyCheckInterval) clearInterval(emulatorReadyCheckInterval);
    }
}, 30000);
