// Button SVG icons (Keep these global/outside)
const circleSVG = `
<svg viewBox="0 0 48 48">
  <circle cx="24" cy="24" r="17" stroke-width="1" stroke="currentColor" fill="none" />
</svg>
`;

const triangleSVG = `
<svg viewBox="-2 3 52 52">
  <polygon points="24,8 42,40 6,40" stroke="currentColor" stroke-width="1" fill="none" />
</svg>
`;

const squareSVG = `
<svg viewBox="-2 -2 46 46">
  <rect x="7" y="7" width="28" height="28" stroke-width="1" stroke="currentColor" fill="none" />
</svg>
`;

const crossSVG = `
<svg viewBox="2 1 44 44">
  <g transform="rotate(45 24 24)">
    <rect x="23" y="6" width="1" height="35" fill="currentColor" />
    <rect x="6" y="23" width="35" height="1" fill="currentColor" />
  </g>
</svg>
`;

// Define the initialization function globally
window.initVirtualGamepad = function() {
  console.debug("Initializing Virtual Gamepad Customizations...");
  
  function applyCustomStyles() {
    if (document.getElementById('custom-gamepad-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'custom-gamepad-styles';
    style.innerHTML = `
            .ejs_virtualGamepad_parent {
              width: 100vw;
              height: 100vh;
              position: absolute;
            }
            .ejs_virtualGamepad_left, .ejs_virtualGamepad_right {
                position: absolute;
                height: 165px;
                cursor: grab;
                touch-action: none; 
                
                /* scale up gamepad slightly */
                transform: scale(1.16);
                /* Set origin so it scales upward and outward predictably */
                transform-origin: bottom center;
                
            }
            .ejs_dpad_main {
              position: absolute;
              right: 0;
              width: 125px;
              height: 125px;
            }
            .ejs_virtualGamepad_left::after, .ejs_virtualGamepad_right::after {
                content: "";
                position: absolute;
                width: 30px; 
                height: 30px; 
                bottom: -10px;
                left: 50%;
                transform: translateX(-50%) rotate(90deg);
                background: url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="800" fill="none" viewBox="0 0 25 25"%3E%3Cpath fill="%23545454" fill-rule="evenodd" d="M9.5 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm0 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm1.5 4.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM15.5 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm1.5 4.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM15.5 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" clip-rule="evenodd"/%3E%3C/svg%3E') no-repeat center;
                background-size: contain;
            }
            .ejs_virtualGamepad_left {
                left: 5%;
                bottom: 0;
            }
            .ejs_virtualGamepad_right {
                right: 5%;
                bottom: 0;
            }
            .ejs_virtualGamepad_left *, .ejs_virtualGamepad_right * {
                pointer-events: auto; 
            }
            .ejs_virtualGamepad_button_down {
                border-radius: 50%;
            }
        `;
    document.head.appendChild(style);
  }
  
  
  // Determine if a touch event should be allowed (not prevented)
  function shouldAllowTouch(e) {
    if (!e.target) return false;

    // Allow touch on specific interactive UI overlays
    const isBooklet = e.target.closest('#book-container');
    const isModal = e.target.closest('#custom-modal-overlay');
    const isUiLayer = e.target.closest('#ui-layer');
    const isEjsMenu = e.target.closest('.ejs_menu_parent') || e.target.closest('.ejs_menu_button');
    const isGamepadDragHandle = e.target.closest('.ejs_virtualGamepad_left') || e.target.closest('.ejs_virtualGamepad_right');

    return isBooklet || isModal || isUiLayer || isEjsMenu || isGamepadDragHandle;
  }

  // Disable default actions globally, but allow them for our custom UI
  document.addEventListener('contextmenu', (e) => {
    if (!shouldAllowTouch(e)) e.preventDefault();
  });
  document.addEventListener('touchstart', (e) => {
    if (!shouldAllowTouch(e)) {
      e.preventDefault();
    }
  }, { passive: false });
  document.addEventListener('pointerdown', (e) => {
    if (!shouldAllowTouch(e)) e.preventDefault();
  }, { passive: false });
  
  function applyStyles() {
    const virtualGamepadLeft = document.querySelector('.ejs_virtualGamepad_left');
    const virtualGamepadRight = document.querySelector('.ejs_virtualGamepad_right');
    
    // Check if elements exist BEFORE trying to access .style
    if (!virtualGamepadLeft || !virtualGamepadRight) return;
    
    // Load positions from local storage
    if (localStorage.getItem('virtualGamepadLeft')) {
      const leftPosition = JSON.parse(localStorage.getItem('virtualGamepadLeft'));
      virtualGamepadLeft.style.left = leftPosition.left;
      virtualGamepadLeft.style.bottom = leftPosition.bottom;
    }
    if (localStorage.getItem('virtualGamepadRight')) {
      const rightPosition = JSON.parse(localStorage.getItem('virtualGamepadRight'));
      virtualGamepadRight.style.right = rightPosition.right;
      virtualGamepadRight.style.bottom = rightPosition.bottom;
    }
    
    applyCustomStyles();
    makeDraggable(virtualGamepadLeft, 'left');
    makeDraggable(virtualGamepadRight, 'right');
  }
  
  function makeDraggable(element, horizontalProperty) {
    let isDragging = false;
    let startX, startY, initialPercentX, initialPercentY, longPressTimer;
    
    element.addEventListener('touchstart', (e) => {
      if (e.target !== element) return;
      
      // Stop bubbling so EmulatorJS doesn't interpret this as a tap to open the menu
      e.stopImmediatePropagation();

      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        isDragging = true;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        const rect = element.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        initialPercentX = (horizontalProperty === 'left') ?
          (rect.left / windowWidth) * 100 :
          ((windowWidth - rect.right) / windowWidth) * 100;
        initialPercentY = ((windowHeight - rect.bottom - 50) / windowHeight) * 100;
        element.style.cursor = 'grabbing';
      }, 400);
    });
    
    element.addEventListener('touchmove', (e) => {
      if (isDragging) {
        // Prevent default scrolling/zooming while dragging
        e.preventDefault();
        
        const touch = e.touches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        let newPercentX = (horizontalProperty === 'left') ?
          initialPercentX + (deltaX / windowWidth) * 100 :
          initialPercentX - (deltaX / windowWidth) * 100;
        let newPercentY = initialPercentY - (deltaY / windowHeight) * 100;
        
        newPercentX = Math.max(0, Math.min(newPercentX, 100 - (element.clientWidth / windowWidth) * 100));
        newPercentY = Math.max(0, Math.min(newPercentY, 100 - (element.clientHeight / windowHeight) * 100));
        
        if (horizontalProperty === 'left') {
          element.style.left = `${newPercentX}%`;
        } else {
          element.style.right = `${newPercentX}%`;
        }
        element.style.bottom = `${newPercentY}%`;
      } else {
        clearTimeout(longPressTimer);
      }
    });
    
    element.addEventListener('touchend', (e) => {
      clearTimeout(longPressTimer);
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'grab';
        
        const position = {
          left: element.style.left,
          right: element.style.right,
          bottom: element.style.bottom
        };
        localStorage.setItem(`virtualGamepad${horizontalProperty.charAt(0).toUpperCase() + horizontalProperty.slice(1)}`, JSON.stringify(position));
      }
    });
    
    element.addEventListener('touchcancel', (e) => {
      clearTimeout(longPressTimer);
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'grab';
      }
    });
  }
  
  // Use MutationObserver to wait for EJS to inject the gamepad elements
  const observer = new MutationObserver((mutationsList, observer) => {
    if (document.querySelector('.ejs_virtualGamepad_left') && document.querySelector('.ejs_virtualGamepad_right')) {
      applyStyles();
      observer.disconnect();
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Try applying once immediately just in case they already exist
  applyStyles();
};

// Global Settings (Must be defined immediately for EJS to see them)
EJS_VirtualGamepadSettings = [
{
  type: "button",
  text: triangleSVG,
  id: "y",
  location: "right",
  left: 40,
  bold: true,
  input_value: 9
},
{
  type: "button",
  text: squareSVG,
  id: "X",
  location: "right",
  top: 40,
  bold: true,
  input_value: 1
},
{
  type: "button",
  text: circleSVG,
  id: "b",
  location: "right",
  left: 81,
  top: 40,
  bold: true,
  input_value: 8
},
{
  type: "button",
  text: crossSVG,
  id: "a",
  location: "right",
  left: 40,
  top: 80,
  bold: true,
  input_value: 0
},
{
  type: "dpad",
  location: "left",
  right: "50%",
  joystickInput: false,
  inputValues: [4, 5, 6, 7]
}];
