for (let i = 1; i <= 20; i++) {
    if (i % 2 === 1) {
        // Odd pages (right)
        $('#book').append(`
            <div id="page" class="right">
                <img src="/booklet/pages/${i}.webp" alt="Page ${i}">
            </div>
        `);
    } else {
        // Even pages (left)               
        $('#book').append(`
            <div id="page" class="left">
                <img src="/booklet/pages/${i}.webp" alt="Page ${i}">
            </div>
        `);
    }
}

// Handle page turning with click & prevent page turn after pan action
function attachPageTurnListeners() {
    let isTurning = false;
    let isDragging = false;
    let pointerDownTime = 0;
    let pointerUpTime = 0;
    
    document.querySelectorAll("#page").forEach((element) => {
        element.addEventListener("pointerdown", () => {
            isDragging = true;
            pointerDownTime = Date.now();
        });
        element.addEventListener("pointermove", (e) => {
            if (!isDragging) return;
        });
        element.addEventListener("pointerup", (e) => {
            isDragging = false;
            pointerUpTime = Date.now();
            const timeDiff = pointerUpTime - pointerDownTime;
            if (!isTurning && timeDiff < 200) {
                isTurning = true;
                const direction = element.classList.contains("left") ? "previous" : "next";
                $("#book").turn(direction);
                // One page at a time
                e.stopImmediatePropagation();
                // Manually trigger pointerup on the book (parent element) to cancel panning
                const pointerUpEvent = new PointerEvent('pointerup', {
                    bubbles: true,
                    cancelable: true,
                    pointerId: e.pointerId,
                    pointerType: e.pointerType
                });
                document.getElementById('book').dispatchEvent(pointerUpEvent);
                setTimeout(() => {
                    isTurning = false;
                    isDragging = false;
                }, 200);
            } else {
                return;
            }
        });
        element.addEventListener('mouseleave', () => {
            isDragging = false;
        });
    });
}

// Attach listeners initially
attachPageTurnListeners();

// Re-attach listeners after each page turn
$('#book').on('turning', () => {
    setTimeout(attachPageTurnListeners, 0);
});

document.addEventListener('DOMContentLoaded', (event) => {
    const book = document.getElementById('book');
    // Initialize turn.js after all pages are added
    // For firefox moved this after dom content loaded
    $('#book').turn({
        autoCenter: true,
        when: {
            turning: function(e, page, view) {
                var audio = new Audio('/booklet/sounds/page_turn.mp3');
                audio.play();
            }
        }
    });
    
    // Initialize Panzoom for game booklet
    const panzoom = Panzoom(book, {
        maxScale: 2.5,
        minScale: 1,
        setTransform: (book, { x, y, scale }) => {
            // Restrict pan within the parent container
            const rect = book.getBoundingClientRect();
            const containerRect = book.parentElement.getBoundingClientRect();
            const minX = -rect.width / 2;
            const minY = -rect.height / 2;
            const maxX = rect.width / 2;
            const maxY = rect.height / 2;
            const boundedX = Math.min(Math.max(x, minX), maxX);
            const boundedY = Math.min(Math.max(y, minY), maxY);
            book.style.transform = `translate(${boundedX}px, ${boundedY}px) scale(${scale})`;
        }
    });
    // Enable mouse wheel zoom
    book.parentElement.addEventListener('wheel', panzoom.zoomWithWheel);
    
    // Blur background on checkbox change, play sound, handle button and booklet animations 
    
    const toggleButton = document.getElementById('toggleButton');
    const blurBackground = document.getElementById('blurBackground');
    const bWrapper = document.getElementById('button-wrapper');
    
    toggleButton.addEventListener('change', () => {
        if (toggleButton.checked) {
            window.history.pushState({ bookOpen: true }, '', '#booklet');
            blurBackground.style = `display: block; z-index: 30;`;
            bWrapper.style.animationPlayState = 'paused';
            book.style.left = '0';
            book.style.animation = 'rollIn 0.7s ease forwards';
            document.getElementById("slide1").play();
            
        } else {
            bWrapper.style.animationPlayState = 'running';
            book.style.left = '-2200px';
            book.style.animation = 'rollOut 0.7s ease forwards';
            document.getElementById("slide2").play();
            (versionMenuOpen === false) ? blurBackground.style.display = 'none': blurBackground.style.zIndex = '15';
            window.history.back();
        }
    });
});

const bWrapper = document.getElementById('button-wrapper');

// Show manual button (todo: and exit button) on page click
function restartButtonAnimation() {
    bWrapper.style.animation = 'none';
    void bWrapper.offsetWidth;
    bWrapper.style.animation = 'slide-in-wait-out 4s ease-in-out forwards';
}

let isButtonAnimating = true;
bWrapper.addEventListener('animationend', () => {
    isButtonAnimating = false;
});

document.body.addEventListener('click', (e) => {
    // 1. Define elements that should be IGNORED (Clicking these should NOT open the manual)
    const isInteractiveElement =
        e.target.closest('.select_button') || // The Version/Start/Continue buttons
        e.target.closest('.save-slot-container') || // The Dropdown menus
        e.target.closest('#button-wrapper') || // The Manual icon itself (let it handle its own click)
        e.target.closest('.ejs_context_menu') || // EmulatorJS specific menus
        e.target.closest('.ejs_menu_bar'); // EmulatorJS bars
    
    // 2. If we clicked any of those, do nothing.
    if (isInteractiveElement) {
        return;
    }
    const isPaused = getComputedStyle(bWrapper).animationPlayState === 'paused';
    if (!isButtonAnimating && !isPaused) {
        isButtonAnimating = true;
        restartButtonAnimation();
    }
});
