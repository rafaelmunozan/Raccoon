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