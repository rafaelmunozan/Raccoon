const toggle = function() {
  let iframe = document.getElementById('tempo-iframe');

  if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'tempo-iframe';
      iframe.style.cssText = `
      height: 141px; width: 302px;
      position: fixed; top: 22px; right: 24px;
      z-index: 2147483647;
      border: none;
      background: linear-gradient(rgb(241 241 241 / 75%) 0%, rgb(255 255 255 / 95%) 100%);
      box-shadow: 
        rgba(0, 0, 0, 0.2) 0px 0px 0px 0.5px, 
        rgba(0, 0, 0, 0.14) 0px 22px 18px -20px, 
        rgba(0, 0, 0, 0.14) 0px 37px 44px -20px, 
        rgba(0, 0, 0, 0.09) 0px -2px 1px inset, 
        rgba(255, 255, 255, 0.09) 0px 2px 1px inset, 
        rgb(255 255 255) 0px 0px 0px 0.5px inset;
      border-radius: 18px;
      backdrop-filter: blur(64px);
      display: none;
      opacity: 0;
      transform: scale(0.8);
      transition: opacity 0.1s cubic-bezier(0,0,.58,1), transform 0.1s cubic-bezier(0,0,.58,1);
    `;
      document.body.appendChild(iframe);
      iframe.src = chrome.runtime.getURL('index.html');
  }

  if (iframe.style.display === 'none' || iframe.style.display === '') {
      iframe.style.display = 'block';
      requestAnimationFrame(() => {
          requestAnimationFrame(() => {
              iframe.style.opacity = '1';
              iframe.style.transform = 'scale(1)';
          });
      });
      chrome.runtime.sendMessage({
          action: "updateRetrievalLoop",
          interval: 900
      });
  } else {
      iframe.style.opacity = '0';
      iframe.style.transform = 'scale(0.8)';
      iframe.addEventListener('transitionend', () => {
          iframe.style.display = 'none';
      }, {
          once: true
      });
      chrome.runtime.sendMessage({
          action: "updateRetrievalLoop",
          interval: 0
      });
  }
};

window.addEventListener('message', (event) => {
  if (event.data.action === 'adjustHeight') {
      const iframe = document.getElementById('tempo-iframe');
      if (iframe) {
          iframe.style.height = `${event.data.height}px`;
      }
  }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "toggleIframe") {
      toggle();
  }
  sendResponse();
});

// Track window position
let isDragging = false;
let currentX;
let currentY;

// Handle messages from the extension iframe
window.addEventListener('message', (event) => {
    if (event.data.action === 'openMailWindow') {
        createMailWindow(event.data.content, event.data.subject);
    }
});

function createMailWindow(content, subject) {
    const windowContainer = document.createElement('div');
    windowContainer.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-404px, -296px);
        width: 700px;
        height: 600px;
        background: rgb(245, 245, 245);
        z-index: 2147483647;
        border-radius: 18px;
        box-shadow: rgba(0, 0, 0, 0.2) 0px 4px 23px 0px;
        overflow: hidden;
        font-family: Arial, sans-serif;
        border: 0.5px solid #d3d3d3;
    `;

    const titleBar = document.createElement('div');
    titleBar.style.cssText = `
        padding-top: 6px;
        padding-bottom: 6px;
        padding-left: 12px;
        padding-right: 8px;
        cursor: move;
        display: flex;
        justify-content: space-between;
        align-items: center;
        user-select: none;
    `;

    // Only show block assets toggle if content contains HTML
    const hasHtml = /<[a-z][\s\S]*>/i.test(content);
    titleBar.innerHTML = `
        <div style="font-weight: bold; font-size: 13px;"">${subject}</div>
        <div style="display: flex;gap: 18px;">
            ${hasHtml ? `
                <label style="display: flex;align-items: center;font-size: 12px;gap: 10px;">
                    <input type="checkbox" checked id="blockAssets"> Block Ttrackers
                </label>
            ` : ''}
            <button style="padding: 4px 8px;cursor: pointer;outline: none;border: 0;background: transparent;font-weight: bold;">✕</button>
        </div>
    `;

    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = `
        padding: 8px;
        overflow-y: auto;
        height: calc(100% - 45px);
        background: transparent;
        padding-top: 0;
        padding-bottom: 0px;
    `;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = `
        width: 100%;
        height: 100%;
        border: none;
        background: white;
        border-radius: 12px;
        border: 0.5px solid #e0e0e0;
    `;

    contentContainer.appendChild(iframe);
    windowContainer.appendChild(titleBar);
    windowContainer.appendChild(contentContainer);
    document.body.appendChild(windowContainer);

    // Initialize iframe content with asset blocking
    const updateContent = () => {
        const doc = iframe.contentDocument;
        doc.open();
        if (hasHtml) {
            const blockAssets = titleBar.querySelector('#blockAssets');
            if (blockAssets?.checked) {
                const sanitizedContent = content.replace(/<img[^>]*>/g, '[Image]')
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
                    .replace(/src=/gi, 'data-src=');
                doc.write(sanitizedContent);
            } else {
                doc.write(content);
            }
        } else {
            // If content is plain text, wrap it in pre tag for better formatting
            doc.write(`<pre style="white-space: pre-wrap; word-wrap: break-word; margin: 0;">${content}</pre>`);
        }
        doc.close();
    };
    updateContent();

    // Handle asset blocking toggle
    if (hasHtml) {
        titleBar.querySelector('#blockAssets').addEventListener('change', updateContent);
    }

    // Improved dragging functionality
    let isDragging = false;
    let startX, startY;
    let currentX = 0;
    let currentY = 0;
    
    titleBar.addEventListener('mousedown', (e) => {
        if (e.target === titleBar || e.target.parentElement === titleBar) {
            e.preventDefault();
            isDragging = true;
            
            // Get current transform values
            const transform = window.getComputedStyle(windowContainer).transform;
            const matrix = new DOMMatrix(transform);
            currentX = matrix.m41;
            currentY = matrix.m42;
            
            // Store initial mouse position
            startX = e.clientX - currentX;
            startY = e.clientY - currentY;
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
    });

    const handleMouseMove = (e) => {
        if (isDragging) {
            e.preventDefault();
            
            // Calculate new position
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            // Use requestAnimationFrame for smooth animation
            requestAnimationFrame(() => {
                // Use transform instead of left/top
                windowContainer.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            });
        }
    };

    const handleMouseUp = () => {
        if (isDragging) {
            isDragging = false;
            // Store final position
            const transform = window.getComputedStyle(windowContainer).transform;
            const matrix = new DOMMatrix(transform);
            currentX = matrix.m41;
            currentY = matrix.m42;
            
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        }
    };

    // Handle close button
    titleBar.querySelector('button').addEventListener('click', () => {
        windowContainer.remove();
        // Clean up event listeners
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    });
}