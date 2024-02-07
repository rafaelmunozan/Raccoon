chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "toggleIframe") {
    let iframe = document.getElementById('tempo-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'tempo-iframe';
      iframe.style.cssText = `
        height: 241px; width: 304px;
        position: fixed; top: 10px; right: 12px;
        z-index: 2147483647;
        border: 1px solid rgba(255, 255, 255, 0.5);
        background: rgba(226, 226, 226, 0.65);
        box-shadow: rgba(0, 0, 0, 0.3) 0px 20px 52px 0px,
                    rgba(42, 50, 26, 0.2) 0px 0px 0px 1px,
                    rgb(0 0 0 / 40%) 0px 7px 20px 0px;
        border-radius: 10px;
        display: none; // Initially hidden to allow for fade-in animation
        opacity: 0;
        backdrop-filter: blur(64px);
        filter: blur(12px);
        transform: scale(0.7);
      `;
      document.body.appendChild(iframe);
      iframe.src = chrome.runtime.getURL('index.html');
    }

    // Trigger fade in or fade out based on the iframe's current display state
    const animator = new IframeAnimator(iframe);
    if (iframe.style.display === 'none' || iframe.style.display === '') {
      animator.fadeIn({
        startTop: '-500px',
        endTop: '10px',
        duration: 680,
        easing: 'cubic-bezier(0,1.31,.28,1)', // Adjusted easing for a dynamic entrance
        startScale: 0.7,
        callback: () => {
          // Send message after fade-in completes and iframe becomes visible
          chrome.runtime.sendMessage({ action: "updateRetrievalLoop", interval: 1500 });
        }
      });
    } else {
      animator.fadeOut({
        startTop: '10px',
        endTop: '-300px',
        duration: 150,
        easing: 'ease-in',
        endScale: 0.4,
        callback: () => {
          // Send message after fade-out completes and iframe is hidden
          chrome.runtime.sendMessage({ action: "updateRetrievalLoop", interval: 20000 });
        }
      });
    }
  }
});

class IframeAnimator {
  constructor(iframe) {
    this.iframe = iframe;
  }

  animateProperties({opacity, filter, scale, top}, duration, easing, callback) {
    this.iframe.style.transition = `opacity ${duration}ms ${easing}, transform ${duration}ms ${easing}, top ${duration}ms ${easing}`;
    if (filter !== '0px') {
      this.iframe.style.transition += `, filter ${duration}ms ${easing}`;
      this.iframe.style.filter = filter;
    }
    this.iframe.style.opacity = opacity;
    this.iframe.style.transform = `scale(${scale})`;
    this.iframe.style.top = top;

    setTimeout(() => {
      if (filter === '0px') {
        this.iframe.style.removeProperty('filter');
      }
      if (callback) {
        callback();
      }
    }, duration);
  }

  fadeIn(options) {
    this.iframe.style.display = 'block'; // Ensure the iframe is set to be visible before starting animation
    // Set initial conditions
    this.iframe.style.opacity = 0;
    this.iframe.style.filter = `blur(${options.startBlur || '12px'})`;
    this.iframe.style.transform = `scale(${options.startScale || 0.7})`;
    this.iframe.style.top = options.startTop || '-500px';

    // Delay the animation to allow the browser to apply initial styles
    setTimeout(() => this.animateProperties({
        opacity: 1,
        filter: `blur(${options.endBlur || '0px'})`,
        scale: options.endScale || 1,
        top: options.endTop || '10px'
    }, options.duration, options.easing, options.callback), 25); // Slightly delay the animation start
  }


  fadeOut(options) {
    this.animateProperties({
      opacity: 0,
      filter: `blur(${options.endBlur || '64px'})`,
      scale: options.endScale || 0.7,
      top: options.endTop || '-80px'
    }, options.duration, options.easing, () => {
      this.iframe.style.display = 'none';
      if (options.callback) options.callback();
    });
  }
}
