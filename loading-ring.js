// Custom loading ring graphic
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
    }
    
    setProgress(percent) {
        const validPercent = Math.min(100, Math.max(0, percent));
        const offset = this.circumference - (validPercent / 100) * this.circumference;
        this.ring.style.strokeDashoffset = offset;
        this.text.textContent = `${Math.floor(validPercent)}%`;
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
        
        if (taskName && taskName !== statusLabel.textContent) {
            statusLabel.textContent = taskName;
        }
    } else {
        // Game started or text element removed
        overlay.style.display = 'none';
    }
};

const observer = new MutationObserver(callback);
observer.observe(targetNode, config);
