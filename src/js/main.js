// In-memory caches for emails
let emailsCache = null;
let currentEmailCache = null;
let appDataCache = null;

// Module for handling API interactions
const EmailApi = {
    baseUrl: 'https://www.1secmail.com/api/v1/',
    processApiUrl: 'https://us-central1-raccoon-7a8f9.cloudfunctions.net/api/processEmail',
    key: 'RA_3327018decxb1_CO',

    // Generates a new mailbox
    async generateMailbox() {
        const [address] = await feetch.data(`${this.baseUrl}?action=genRandomMailbox`, {});
        return address;
    },

    // Gets messages for the specified email
    async getMessages(email) {
        const [username, domain] = email.split('@');
        return await feetch.data(`${this.baseUrl}?action=getMessages&login=${username}&domain=${domain}`, {});
    },

    // Reads a specific message by id
    async readMessage(email, id) {
        const [username, domain] = email.split('@');
        return await feetch.data(`${this.baseUrl}?action=readMessage&login=${username}&domain=${domain}&id=${id}`, {});
    },

    // Detects and processes email content
    async magicDetector(emailContent) {
        return await feetch.data(this.processApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.key
            },
            body: JSON.stringify({ emailContent })
        });
    }
};

// Manages storage operations for the email application
const StorageManager = {
    storageKey: 'emailAppData',

    // Returns the application data from storage or cache
    getStorageData() {
        if (appDataCache === null) {
            const data = localStorage.getItem(this.storageKey);
            appDataCache = data ? JSON.parse(data) : { emails: {} };
        }
        return appDataCache;
    },

    // Saves application data to storage
    setStorageData(data) {
        appDataCache = data;
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    },

    // Retrieves the current email from cache or storage
    getCurrentEmail() {
        if (currentEmailCache === null) {
            const data = this.getStorageData();
            currentEmailCache = data.currentEmail || null;
        }
        return currentEmailCache;
    },

    // Updates the current email in cache and storage
    setCurrentEmail(email) {
        const data = this.getStorageData();
        data.currentEmail = email;
        currentEmailCache = email;
        this.setStorageData(data);
    },

    // Retrieves data for a specific email ID
    getMessageData(emailId) {
        const data = this.getStorageData();
        return data.emails[emailId] || null;
    },

    // Updates email data for a specific ID
    setMessageData(emailId, data) {
        const storageData = this.getStorageData();
        storageData.emails[emailId] = { ...(storageData.emails[emailId] || {}), ...data };
        this.setStorageData(storageData);
    },

    // Returns all stored emails
    getAllMessages() {
        const data = this.getStorageData();
        return data.emails;
    },

    // Returns all stored emails that have not been processed   
    isMessageProcessed(messsageId) {
        const data = this.getStorageData();
        return data.emails[messsageId] && data.emails[messsageId].processed === true;
    },

    // Clears all data from storage
    clearAllData() {
        localStorage.removeItem(this.storageKey);
        appDataCache = null;
        emailsCache = null;
        currentEmailCache = null;
    }
};

// Manages UI interactions for the email application
const UIUtils = {

    // Updates the email display in the UI
    updateEmailUI(email) {
        const emailElement = document.querySelector('.current-mail');
        if (!emailElement) return;
    
        emailElement.removeEventListener('click', this.handleEmailClick);
        this.handleEmailClick = () => {
            this.copyToClipboard(email);
            this.indicateCopied(emailElement);
        };
        emailElement.addEventListener('click', this.handleEmailClick);
        // Animate the email part with options for uppercase display
        this.animateEmailContent(email.split('@')[0] + '@', emailElement, true);
    },
     
    // Copies text to the clipboard
    copyToClipboard(text) {
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = text;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        document.execCommand('copy');
        document.body.removeChild(tempTextArea);
        console.log('Copied to clipboard:', text);
    },

    // Indicates an action has been copied
    indicateCopied(element) {
        const originalText = element.textContent;
        element.textContent = "Copied";

        setTimeout(() => {
            element.textContent = originalText;
        }, 2000);
    },

    // Clears the inbox UI
    clearInboxUI() {
        const inboxContainer = document.querySelector('.inbox-container');
        inboxContainer.innerHTML = '';
    },

    // Adds an email to the inbox UI
    addEmailToInbox(emailId, subject, code = null) {
        const inboxContainer = document.querySelector('.inbox-container');
        if (!inboxContainer) return;
        const emailData = StorageManager.getMessageData(emailId);
        const truncatedSubject = subject.length > 30 ? `${subject.substring(0, 30)}...` : subject;
        const mailElement = this.createMailElement(emailId, truncatedSubject, code, emailData.opened);
        inboxContainer.insertBefore(mailElement, inboxContainer.firstChild);
        // Animate the .mail element as it's added to the inbox
        this.animateElementIn(mailElement, {
          duration: 200,
          startBlur: '8px',
          endBlur: '0px',
          startOpacity: 0,
          endOpacity: 1
        });
    },

    // Creates an email element for the UI
    createMailElement(emailId, truncatedSubject, code, isOpened) {
        const mailElement = document.createElement('div');
        mailElement.classList.add('mail');
        mailElement.setAttribute('data-email-id', emailId);
        if (isOpened) {
            mailElement.classList.add('opened');
        }

        const subjectElement = this.createSubjectElement(truncatedSubject, emailId);
        mailElement.appendChild(subjectElement);

        if (code) {
            const codeElement = this.createMagicElement(code);
            mailElement.appendChild(codeElement);
        }

        return mailElement;
    },

    // Creates a subject element for an email
    createSubjectElement(subject, emailId) {
        const subjectElement = document.createElement('p');
        subjectElement.classList.add('subject');
        subjectElement.textContent = subject;

        subjectElement.addEventListener('click', () => {
            this.openMailInFloatingTab(emailId);
            StorageManager.setMessageData(emailId, { opened: true });
            subjectElement.parentNode.classList.add('opened');
        });

        return subjectElement;
    },

    // Creates a code display element
    createMagicElement(code) {
        const codeElement = document.createElement('div');
        codeElement.classList.add('code-container');
        codeElement.innerHTML = `<div class="code">${code}</div>`;

        codeElement.addEventListener('click', () => {
            this.copyToClipboard(code);
            this.indicateCopied(codeElement.querySelector('.code'));
        });

        return codeElement;
    },

    // Adds the magic response for an email in the UI
    addMagicResponse(emailId, magicCode) {
        const emailElement = document.querySelector(`.mail[data-email-id="${emailId}"]`);
        const codeElement = UIUtils.createMagicElement(magicCode);
        emailElement.appendChild(codeElement);
        // Trigger animation with a slight delay to ensure the browser recognizes the new state
        requestAnimationFrame(() => {
            this.animateElementIn(emailElement.querySelector('.code-container'), {
                duration: 300,
                startBlur: '4px',
                endBlur: '0px',
                startOpacity: 0.5,
                endOpacity: 1
            });
        });
    },

    // Animate elements when appear into the UI.
    animateElementIn(element, options = {}) {
        const {
          duration = 300, // Default duration in ms
          easing = 'ease-out', // Default easing function
          startOpacity = 0, // Starting opacity
          endOpacity = 1, // Final opacity
          startBlur = '0px', // Starting blur value
          endBlur = '0px', // Final blur value
          delay = 0 // Delay before starting the animation
        } = options;
      
        // Prepare initial styles for animation
        element.style.opacity = startOpacity;
        element.style.filter = `blur(${startBlur})`;
        element.style.transition = `opacity ${duration}ms ${easing}, filter ${duration}ms ${easing}`;
      
        // Start the animation after the specified delay
        setTimeout(() => {
          element.style.opacity = endOpacity;
          element.style.filter = `blur(${endBlur})`;
        }, delay);
    },

    // Animates the current Email Address
    animateEmailContent(email, targetElement, isUpperCase) {
        // Clear previous content
        targetElement.innerHTML = '';
    
        // Process email for display, optionally converting to uppercase
        const processedEmail = isUpperCase ? email.toUpperCase() : email;
    
        // Split the processed email into spans for each character
        processedEmail.split('').forEach((char, index) => {
            const span = document.createElement('span');
            span.textContent = char;
            targetElement.appendChild(span);
    
            // Initial style to ensure animations can run
            span.style.opacity = 0;
            span.style.filter = 'blur(4px)';
            span.style.animation = 'none';
    
            // Calculate delay based on index to create staggered effect
            const delay = index * 20; // 100 milliseconds between each span
    
            setTimeout(() => {
                span.style.transition = 'opacity 0.8s ease, filter 0.8s ease';
                span.style.opacity = 1;
                span.style.filter = 'blur(0)';
            }, delay);
        });
    },

    // Opens an email in a new tab
    openMailInFloatingTab(emailId) {
        const emailData = StorageManager.getMessageData(emailId);
        if (!emailData) return;

        const windowFeatures = 'width=300,height=500,toolbar=0,location=0,menubar=0';
        const floatingTab = window.open('', '_blank', windowFeatures);
        floatingTab.document.open();
        floatingTab.document.write('<html><head><title>Email Content</title></head><body>');
        floatingTab.document.write(emailData.content);
        floatingTab.document.close();
    }
};

// Main class for the email application
class EmailApp {
    constructor() {
        this.checkInterval = null;
        this.currentEmail = '';
        this.retrieving = false;
        this.retrievalInterval = 3000;

    }

    // Initializes the email application
    async init() {
        this.setupEventListeners();
        await this.fetchEmailAndUpdateUI();
        this.loadEmailsToUI();
    }

    // Sets up event listeners for the application
    setupEventListeners() {
        document.querySelector('.refresh').onclick = () => {
            clearInterval(this.checkInterval);
            StorageManager.clearAllData();
            UIUtils.clearInboxUI();
            this.fetchEmailAndUpdateUI();
        };
    }

    // Loads stored emails into the UI
    loadEmailsToUI() {
        const allEmails = StorageManager.getAllMessages();
        if (allEmails) {
            const sortedEmails = Object.entries(allEmails).sort((a, b) => a[1].timestamp - b[1].timestamp);
            sortedEmails.forEach(([emailId, emailData]) => {
                if (emailData && emailData.processed && emailData.subject) {
                    UIUtils.addEmailToInbox(emailId, emailData.subject, emailData.code);
                }
            });
        }
    }

    // Fetches a new email and updates the UI
    async fetchEmailAndUpdateUI() {
        const currentEmail = StorageManager.getCurrentEmail();
        if (!currentEmail || new Date().getTime() - currentEmail.timestamp >= 3600000) {
            const newEmail = await EmailApi.generateMailbox();
            StorageManager.setCurrentEmail({ email: newEmail, timestamp: new Date().getTime() });
            this.currentEmail = newEmail;
        } else {
            this.currentEmail = currentEmail.email;
        }
        UIUtils.updateEmailUI(this.currentEmail);
        this.startRetrievalLoop(this.currentEmail);
    }

    updateRetrievalInterval(newInterval) {
        this.retrievalInterval = newInterval;
        this.startRetrievalLoop(this.currentEmail); // Restart the loop with the new interval
    }

    // Starts the loop to check for new emails
    startRetrievalLoop(email) {
        clearInterval(this.checkInterval);
        this.checkInterval = setInterval(async () => {
            if (!this.retrieving) {
                await this.retrieveEmails(email);
            }
        }, this.retrievalInterval); // Check interval
    }

    // Retrieves emails for the current mailbox
    async retrieveEmails(email) {
        if (this.retrieving) return;
        this.retrieving = true;
    
        try {
            const emails = await EmailApi.getMessages(email);
            if (!emails || emails.length === 0) {
                return;
            }
    
            // Filter out emails that have already been processed
            const unprocessedEmails = emails.filter(emailObj => !StorageManager.isMessageProcessed(emailObj.id));
    
            // Process each email in parallel
            await Promise.all(unprocessedEmails.map(async (emailObj) => {
                // Mark the email as processed to prevent reprocessing
                StorageManager.setMessageData(emailObj.id, { processed: true });
    
                const emailContent = await EmailApi.readMessage(email, emailObj.id);
                if (!emailContent) return;
    
                const emailInfo = {
                    content: emailContent.htmlBody || emailContent.textBody,
                    subject: emailObj.subject,
                    timestamp: new Date().getTime(),
                    opened: false,
                    processed: true
                };
    
                StorageManager.setMessageData(emailObj.id, emailInfo);
                UIUtils.addEmailToInbox(emailObj.id, emailObj.subject);
    
                // Process the magic code async
                const magicCode = await EmailApi.magicDetector(emailContent.htmlBody || emailContent.textBody);
                if (magicCode && magicCode.action !== 'copy') return;

                StorageManager.setMessageData(emailObj.id, { code: magicCode.value });
                UIUtils.addMagicResponse(emailObj.id, magicCode.value);

            }));

        } finally {this.retrieving = false;}
    }        
    
}

// Network request handler with retries
const feetch = {
    async data(url, options, retries = 3) {
        while (retries >= 0) {
            try {
                const response = await fetch(url, options);
                if (!response.ok) { throw new Error(`Network Error: ${response.status}`); }
                return response.json();
            } catch (error) {
                if (retries === 0) {throw error;}
                retries--; 
                await this.delay(1000);
            }
        }
    },
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// Initializes the email application on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new EmailApp();
    app.init();
    // Listening for messages in main.js within the iframe
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === "updateRetrievalLoop") {
          // Update the retrieval loop interval based on the message
          app.updateRetrievalInterval(request.interval);
        }
      });
  
});
