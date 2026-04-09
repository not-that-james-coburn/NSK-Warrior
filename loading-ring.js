// Custom loading ring graphic with two-stage progress tracking
class BearingLoader {
    constructor(ringId, textId) {
        this.ring = document.getElementById(ringId);
        this.text = document.getElementById(textId);
        
        // Calculate circumference dynamically based on radius
        this.radius = this.ring.r.baseVal.value;
        this.circumference = 2 * Math.PI * this.radius;
        
        // Setup initial SVG states (JS overrides CSS here for dynamic sizing)
        this.ring.style.strokeDasharray = `${this.circumference} ${this.circumference}`;
        this.ring.style.strokeDashoffset = this.circumference;
        
        // Two-stage progress tracking
        this.currentProgress = 0;
        this.isFinalizingPhase = false;
        this.finalizationStartTime = null;
        this.finalizationDuration = 1500; // 1.5 seconds to go from 99% to 100%
        this.gameStarted = false;
    }
    
    setProgress(percent) {
        const validPercent = Math.min(100, Math.max(0, percent));
        
        // If we're hitting 99% and haven't entered finalization, trigger it
        if (validPercent >= 99 && !this.isFinalizingPhase) {
            this.startFinalizationPhase();
            return; // Don't update yet, let finalization handle it
        }
        
        // If not in finalization phase, update normally
        if (!this.isFinalizingPhase) {
            this.currentProgress = validPercent;
            this.updateRing(validPercent);
        }
    }
    
    startFinalizationPhase() {
        this.isFinalizingPhase = true;
        this.finalizationStartTime = Date.now();
        this.animateToCompletion();
    }
    
    animateToCompletion() {
        const elapsed = Date.now() - this.finalizationStartTime;
        const progress = Math.min(elapsed / this.finalizationDuration, 1);
        
        // Exponential easing for smooth natural progression
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const displayProgress = 99 + (easedProgress * 1); // 99% -> 100%
        
        this.updateRing(displayProgress);
        
        // Continue animation until 100%
        if (progress < 1) {
            requestAnimationFrame(() => this.animateToCompletion());
        } else {
            // Animation complete, ready to hide overlay when game is ready
            this.gameStarted = true;
        }
    }
    
    updateRing(percent) {
        const offset = this.circumference - (percent / 100) * this.circumference;
        this.ring.style.strokeDashoffset = offset;
        this.text.textContent = `${Math.floor(percent)}%`;
    }
    
    hideOverlay() {
        overlay.style.display = 'none';
    }
}

const myLoader = new BearingLoader('loading-ring', 'loading-text');
const overlay = document.getElementById('custom-loader-overlay');
const statusLabel = document.getElementById('status-task');
const targetNode = document.querySelector('#game');

const config = { childList: true, subtree: true, characterData: true };

const callback = function(mutationsList, observer) {
    // Check if the emulator's internal loading text element exists
    const loadingElem = targetNode.querySelector('.ejs_loading_text');
    
    if (loadingElem) {
        overlay.style.display = 'flex';
        
        // Use textContent! innerText returns empty string if element is hidden/invisible
        const rawText = loadingElem.textContent || "";
        
        // Hide the default text so only our ring shows
        loadingElem.style.visibility = 'hidden';
        
        // 1. Parse Percentage
        const percentMatch = rawText.match(/(\d+)%/);
        if (percentMatch) {
            const percent = parseInt(percentMatch[1]);
            myLoader.setProgress(percent);
        }
        
        // 2. Parse Task Name
        // Strip out the percentage OR file size (e.g. "45%" or "10.5MB") to get clean text
        let taskName = rawText.replace(/(\d+%|\d+(\.\d+)?MB)$/, '').trim();
        
        // Fallback: If stripping leaves nothing (rare), keep raw text
        if (!taskName && rawText.length > 0) taskName = rawText;
        
        // Add "Finalizing..." message when we hit 99%
        if (myLoader.isFinalizingPhase && !taskName.includes('Finalizing')) {
            taskName = 'Finalizing...';
        }
        
        if (taskName && taskName !== statusLabel.textContent) {
            statusLabel.textContent = taskName;
        }
    } else {
        // Loading text has disappeared = game is taking over
        // If we're at 100%, hide the overlay immediately
        if (myLoader.gameStarted || myLoader.isFinalizingPhase) {
            myLoader.hideOverlay();
        }
    }
};

const observer = new MutationObserver(callback);
observer.observe(targetNode, config);

// Fallback: Hide overlay if it's stuck after 6 seconds total
setTimeout(() => {
    if (overlay.style.display === 'flex') {
        console.warn('[Loader] Fallback: Force-hiding overlay after 6s timeout');
        myLoader.hideOverlay();
    }
}, 6000);
