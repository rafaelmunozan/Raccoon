// Constants
const STYLES = {
    iframe: `
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
    `,
    mailWindow: {
        container: `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-193px, -323px);
            width: 600px;
            height: 600px;
            background: rgba(224, 224, 224, 0.84);
            z-index: 2147483647;
            border-radius: 16px;
            box-shadow: rgba(0, 0, 0, 0.14) 0px 22px 18px -20px, 
                       rgba(0, 0, 0, 0.14) 0px 37px 44px -20px,
                       rgba(0, 0, 0, 0.09) 0px -2px 1px inset,
                       rgba(255, 255, 255, 0.09) 0px 2px 1px inset,
                       rgb(255, 255, 255) 0px 0px 0px 0.5px inset;
            overflow: hidden;
            font-family: Inter;
            border: 0.5px solid rgb(167, 167, 167);
            backdrop-filter: blur(18px);
        `,
        titleBar: `
            padding: 6px 8px 6px 12px;
            cursor: move;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
            height: 42px !important;
        `,
        content: `
            padding: 8px;
            overflow-y: auto;
            height: calc(100% - 52px);
            background: transparent;
            padding-top: 0;
            padding-bottom: 0px;
        `
    }
};

// Utility functions
const Utils = {
    truncateText(text, maxLength) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    },
    
    sanitizeHtmlContent(content) {
        return content.replace(/<img[^>]*>/g, '')
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/src=/gi, 'data-src=');
    }
};

// Main iframe management
class IframeManager {
    static create() {
        const iframe = document.createElement('iframe');
        iframe.id = 'tempo-iframe';
        iframe.style.cssText = STYLES.iframe;
        document.body.appendChild(iframe);
        iframe.src = browser.runtime.getURL('index.html');
        return iframe;
    }

    static toggle() {
        let iframe = document.getElementById('tempo-iframe') || this.create();

        if (iframe.style.display === 'none' || iframe.style.display === '') {
            this.show(iframe);
        } else {
            this.hide(iframe);
        }
    }

    static show(iframe) {
        iframe.style.display = 'block';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                iframe.style.opacity = '1';
                iframe.style.transform = 'scale(1)';
            });
        });
        this.updateRetrievalLoop(900);
    }

    static hide(iframe) {
        iframe.style.opacity = '0';
        iframe.style.transform = 'scale(0.8)';
        iframe.addEventListener('transitionend', () => {
            iframe.style.display = 'none';
        }, { once: true });
        this.updateRetrievalLoop(0);
    }

    static updateRetrievalLoop(interval) {
        browser.runtime.sendMessage({
            action: "updateRetrievalLoop",
            interval
        });
    }
}

// Mail Window management
class MailWindow {
    constructor(content, subject) {
        this.content = content;
        this.subject = subject;
        this.blockingEnabled = true;
        this.hasHtml = /<[a-z][\s\S]*>/i.test(content);
        this.blobUrl = null;
        this.init();
    }

    init() {
        this.createWindow();
        this.setupDragBehavior();
        this.setupContentHandling();
        this.setupEventListeners();
    }

    createWindow() {
        this.windowContainer = document.createElement('div');
        this.windowContainer.style.cssText = STYLES.mailWindow.container;
        
        this.createTitleBar();
        this.createContentArea();
        
        document.body.appendChild(this.windowContainer);
    }

    createTitleBar() {
        const titleBar = document.createElement('div');
        titleBar.style.cssText = STYLES.mailWindow.titleBar;
        titleBar.innerHTML = this.getTitleBarHTML();
        this.windowContainer.appendChild(titleBar);
    }

    getTitleBarHTML() {
        return `
            <div style="font-weight: 500; font-size: 14px; color: #000000; 
                        font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;
                        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                        max-width: 350px;">
                ${Utils.truncateText(this.subject, 50)}
            </div>
            <div style="display: flex; gap: 18px; align-items: center;">
                ${this.hasHtml ? this.getBlockAssetsButtonHTML() : ''}
                ${this.getCloseButtonHTML()}
            </div>
        `;
    }

    createContentArea() {
        const contentContainer = document.createElement('div');
        contentContainer.style.cssText = STYLES.mailWindow.content;
        
        this.iframe = document.createElement('iframe');
        this.iframe.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            background: white;
            border-radius: 12px;
            border: 0.5px solid rgb(167, 167, 167);
        `;
        
        contentContainer.appendChild(this.iframe);
        this.windowContainer.appendChild(contentContainer);
    }

    createBlobUrl(content) {
        // Revoke previous blob URL if exists
        if (this.blobUrl) {
            URL.revokeObjectURL(this.blobUrl);
        }

        const htmlTemplate = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { 
                        margin: 12px;
                        font-family: -apple-system, system-ui, BlinkMacSystemFont, 
                                    "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                        ${!this.hasHtml ? 'white-space: pre-wrap; word-wrap: break-word; font-family: monospace;' : ''}
                    }
                </style>
            </head>
            <body>${content}</body>
            </html>
        `;

        const blob = new Blob([htmlTemplate], { type: 'text/html' });
        return URL.createObjectURL(blob);
    }

    updateContent() {
        const contentToDisplay = this.hasHtml && this.blockingEnabled ? 
            Utils.sanitizeHtmlContent(this.content) : 
            this.content;

        this.blobUrl = this.createBlobUrl(contentToDisplay);
        this.iframe.src = this.blobUrl;
    }

    setupContentHandling() {
        this.updateContent();
    }

    setupDragBehavior() {
        new DragHandler(this.windowContainer);
    }

    setupEventListeners() {
        const closeButton = this.windowContainer.querySelector('#closeButton');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                this.cleanup();
                this.windowContainer.remove();
            });
        }

        // Store the handler as a class property so we can reuse it
        this.blockButtonHandler = () => this.toggleBlockingMode();
        
        const blockButton = this.windowContainer.querySelector('#blockAssets');
        if (blockButton && this.hasHtml) {
            blockButton.addEventListener('click', this.blockButtonHandler);
        }
    }

    getBlockAssetsButtonHTML() {
        return `
            <button id="blockAssets" style="
                all: unset;
                font-size: 12px;
                padding: 4px 12px;
                border-radius: 6px;
                cursor: pointer;
                background: #fff;
                border: 1px solid #c5c5c5;
                color: #000000;
                font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;
                flex-shrink: 0;
            ">Block Trackers: ${this.blockingEnabled ? 'ON' : 'OFF'}</button>
        `;
    }

    getCloseButtonHTML() {
        return `
            <button id="closeButton" style="
                background: none;
                border: none;
                padding: 6px;
                cursor: pointer;
                color: #666;
                font-size: 14px;">
                ✕
            </button>
        `;
    }

    toggleBlockingMode() {
        this.blockingEnabled = !this.blockingEnabled;
        const blockButton = this.windowContainer.querySelector('#blockAssets');
        if (blockButton) {
            // Update the entire button HTML to maintain styles
            blockButton.outerHTML = this.getBlockAssetsButtonHTML();
            // Reattach event listener using the stored handler
            this.windowContainer.querySelector('#blockAssets')
                .addEventListener('click', this.blockButtonHandler);
            this.updateContent();
        }
    }

    cleanup() {
        if (this.blobUrl) {
            URL.revokeObjectURL(this.blobUrl);
        }
    }
}

// Drag behavior handler
class DragHandler {
    constructor(element) {
        this.element = element;
        this.isDragging = false;
        this.currentX = 0;
        this.currentY = 0;
        this.setupListeners();
    }

    setupListeners() {
        const titleBar = this.element.querySelector('div');
        titleBar.addEventListener('mousedown', this.handleMouseDown.bind(this));
    }

    handleMouseDown(e) {
        if (e.target === e.currentTarget || e.target.parentElement === e.currentTarget) {
            e.preventDefault();
            this.startDrag(e);
        }
    }

    startDrag(e) {
        this.isDragging = true;
        const matrix = new DOMMatrix(window.getComputedStyle(this.element).transform);
        this.currentX = matrix.m41;
        this.currentY = matrix.m42;
        this.startX = e.clientX - this.currentX;
        this.startY = e.clientY - this.currentY;

        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    handleMouseMove(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        
        const deltaX = e.clientX - this.startX;
        const deltaY = e.clientY - this.startY;
        
        requestAnimationFrame(() => {
            this.element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        });
    }

    handleMouseUp() {
        if (!this.isDragging) return;
        this.isDragging = false;
        
        const matrix = new DOMMatrix(window.getComputedStyle(this.element).transform);
        this.currentX = matrix.m41;
        this.currentY = matrix.m42;
        
        document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        document.removeEventListener('mouseup', this.handleMouseUp.bind(this));
    }
}

// Event Listeners
window.addEventListener('message', (event) => {
    if (event.data.action === 'adjustHeight') {
        const iframe = document.getElementById('tempo-iframe');
        if (iframe) {
            iframe.style.height = `${event.data.height}px`;
        }
    }
    if (event.data.action === 'toggleIframe') {
        IframeManager.toggle(event.data.forceClose); // Pass through the forceClose flag
    }
    if (event.data.action === 'openMailWindow') {
        new MailWindow(event.data.content, event.data.subject);
    }
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleIframe") {
        IframeManager.toggle();
    }
    sendResponse();
});