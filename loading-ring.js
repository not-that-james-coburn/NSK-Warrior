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
        this.animationFrameId = null;
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
        // Reset ring for next task
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
        
        // Hide the default EJS loading text so only our ring shows
        loadingElem.style.visibility = 'hidden';
        
        // 1. Parse Percentage
        const percentMatch = rawText.match(/(\d+)%/);
        if (percentMatch) {
            const percent = parseInt(percentMatch[1]);
            myLoader.setProgress(percent);
        }
        
        // 2. Parse Task Name
        let taskName = rawText.replace(/(\d+%|\d+(\.\d+)?MB)$/, '').trim();
        if (!taskName && rawText.length > 0) taskName = rawText;
        
        // 3. Detect task changes and reset ring animation
        if (taskName && taskName !== myLoader.lastTaskName) {
            myLoader.lastTaskName = taskName;
            myLoader.resetForNewTask();
            
            console.log(`[Loader] New task: ${taskName}`);
        }
        
        // Update task label
        if (taskName && taskName !== statusLabel.textContent) {
            statusLabel.textContent = taskName;
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
