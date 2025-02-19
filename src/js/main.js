'use strict'

const MailService = {

    endpoint: 'https://api.mail.tm', // Updated endpoint

    async genAddress() {
        try {
            // 1. Get domains
            const domainsResponse = await Request.data(`${this.endpoint}/domains`, {
                method: 'GET'
            });
            if (!domainsResponse || !domainsResponse['hydra:member'] || domainsResponse['hydra:member'].length === 0) {
                throw new Error("Failed to fetch domains");
            }
            // Select a random domain
            const domains = domainsResponse['hydra:member'];
            const randomIndex = Math.floor(Math.random() * domains.length);
            const domain = domains[randomIndex].domain;

            // 2. Create Account
            const username = Math.random().toString(36).substring(2, 15); // Generate random username
            const password = Math.random().toString(36).substring(2, 15); // Generate random password (consider making this more robust/configurable)
            const address = `${username}@${domain}`;

            const accountResponse = await Request.data(`${this.endpoint}/accounts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    address: address,
                    password: password
                })
            });

            if (!accountResponse) {
                throw new Error("Failed to create account");
            }

            // 3. Get Token (for future authenticated requests - though not strictly needed for just returning address)
            const tokenResponse = await Request.data(`${this.endpoint}/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    address: address,
                    password: password
                })
            });

            if (!tokenResponse || !tokenResponse.token) {
                throw new Error("Failed to get token");
            }


            return { address: address, token: tokenResponse.token }; // Return address and token
        } catch (error) {
            console.error("Error generating address:", error);
            return null; // Or handle error more gracefully
        }
    },

    async getInbox(token) {
        try {
            const messagesResponse = await Request.data(`${this.endpoint}/messages`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}` // Include Bearer token
                }
            });
            if (!messagesResponse || !messagesResponse['hydra:member']) {
                throw new Error("Failed to fetch inbox");
            }
            return messagesResponse['hydra:member']; // Return array of messages
        } catch (error) {
            console.error("Error fetching inbox:", error);
            return null; // Or handle error more gracefully
        }
    },

    async getMail(token, id) {
        try {
            const mailResponse = await Request.data(`${this.endpoint}/messages/${id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}` // Include Bearer token
                }
            });
            if (!mailResponse) {
                throw new Error("Failed to fetch mail");
            }
            return mailResponse;
        } catch (error) {
            console.error("Error fetching mail:", error);
            return null; // Or handle error more gracefully
        }
    },

};

const Request = {

    async data(url, options, retries = 3) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // Timeout after 5 seconds

        while (retries >= 0) {
            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    let message = `HTTP error! status: ${response.status}`;
                    try {
                        const errorData = await response.json();
                        message += `\nDetails: ${JSON.stringify(errorData)}`; // Include error details if available
                    } catch (jsonError) {
                        message += `\nCould not parse error JSON.`;
                    }
                    throw new Error(message);
                }


                return response.json();

            } catch (error) {
                if (retries === 0 || error.name === 'AbortError') throw error;
                retries--;
                await this.delay(1000);
                console.warn(`Request to ${url} failed, retrying (${retries} retries left): ${error.message}`); // Log retry attempts
            }
        }
    },

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

};

const StorageManager = {

    storageKey: 'data',
    cache: {},

    async init() {
        this.cache = (JSON.parse(localStorage.getItem(this.storageKey))) ?? await this.create();
    },

    async create() {
        const addressData = await MailService.genAddress(); // Now genAddress returns {address, token}
        const format = {
            address: addressData?.address ?? ": /",
            token: addressData?.token ?? null, // Store the token
            timestamp: new Date().getTime(),
            inbox: {}
        };
        this.set(format);
    },

    set(data) {
        this.cache = {
            ...this.cache,
            ...data
        };
        localStorage.setItem(this.storageKey, JSON.stringify(this.cache));
    },

    get() {
        return this.cache;
    },

    setAddress(value) {
        return this.set({
            address: value
        });
    },

    getAddress() {
        return this.get().address;
    },

    getToken() { // Add getToken function
        return this.get().token;
    },

    setMail(data) {
        const inbox = this.getInbox();
        if (inbox[data.id]) inbox[data.id] = {
            ...inbox[data.id],
            ...data
        };
        else inbox[data.id] = data;
        return this.set({
            inbox
        });
    },

    getMail(id) {
        return this.getInbox()[id] || null;
    },

    getInbox() {
        return this.get().inbox;
    },

    clean() {
        localStorage.removeItem(this.storageKey);
        this.cache = null;
    }

};

const UIManager = {

    compAddress: document.getElementById('address'),
    compInbox: document.getElementById('inbox'),

    setCompAddress(address) {
        this.compAddress.removeEventListener('click', this.handleEmailClick);
        this.handleEmailClick = () => this.setCopy(address, this.compAddress);
        this.compAddress.addEventListener('click', this.handleEmailClick);

        this.compAddress.innerHTML = address.split('@')[0] + '@';
    },

    setCompMail(mailData) {
        mailData.subject = mailData.subject.length > 40 ? `${mailData.subject.substring(0, 40)}...` : mailData.subject;

        const mailComp = document.createElement('div');
        mailComp.classList.add('inbox-item');

        if (mailData.seen) mailComp.classList.add('read'); // Use 'seen' from mail.tm

        mailComp.textContent = mailData.subject;
        mailComp.setAttribute('mailid', mailData.id);

        this.compInbox.insertBefore(mailComp, this.compInbox.firstChild);
    },

    // Copies text to the clipboard
    setCopy(text, comp) {
        const tempComp = document.createElement('textarea');
        tempComp.value = text;
        document.body.appendChild(tempComp);
        tempComp.select();
        document.execCommand('copy');
        document.body.removeChild(tempComp);

        if (!comp) return;

        const originalText = comp.textContent;
        comp.textContent = "Copied";
        setTimeout(() => {
            comp.textContent = originalText;
        }, 2000);
    },

    // Clears the inbox UI
    cleanInbox() {
        this.compInbox.innerHTML = '';
    },

    // Opens an email in a new tab
    openMail(mail) {
        // Send message to content script to create email window
        window.parent.postMessage({
            action: 'openMailWindow',
            content: mail.html[0] ?? mail.text,
            subject: mail.subject
        }, '*');
    },

    init() {
        this.initCloseButton();
        this.compInbox.addEventListener('click', async (event) => {
            const target = event.target.closest('.inbox-item');
            if (target) {
                const mailId = target.getAttribute('mailid');
                let mail = StorageManager.getMail(mailId);
                if (!mail || !mail.html) { // Check if full mail content is loaded or needs refresh
                    const token = StorageManager.getToken();
                    if (token) {
                        mail = await MailService.getMail(token, mailId); // Fetch full mail content if needed
                        if (mail) {
                            StorageManager.setMail({...mail, id: mailId}); // Update cache with full content
                        }
                    }
                }
                if (mail) {
                    this.openMail(mail);
                    if (!mail.seen) { // Mark as read if not already
                        const token = StorageManager.getToken();
                        if (token) {
                            await Request.data(`${MailService.endpoint}/messages/${mailId}`, { // Mark as read
                                method: 'PATCH',
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'Content-Type': 'application/merge-patch+json' // Important content type for PATCH
                                },
                                body: JSON.stringify({ "seen": true })
                            });
                            target.classList.add('read'); // Update UI to show as read
                            StorageManager.setMail({ id: mailId, seen: true }); // Update cache
                        }
                    }
                }
            }
        });
    },

    initCloseButton() {
        const closeButton = document.getElementById('close');
        if (!closeButton) {
            console.error('Close button not found');
            return;
        }
        closeButton.addEventListener('click', () => {
            // Send message to content script
            window.parent.postMessage({
                action: 'toggleIframe',
                forceClose: true // Add this flag to force close
            }, '*');
        });
    },
};

const Raccoon = {

    status: null,
    syncDelay: 2000,
    timeoutid: null,

    async loadAddress() {

        const data = StorageManager.get();

        if (!data) return this.restartAddress();

        let {
            address,
            timestamp
        } = data;

        if (!address || new Date().getTime() - timestamp >= 2600000) return this.restartAddress();

        UIManager.setCompAddress(address);
    },

    async restartAddress() {
        try {
            await StorageManager.clean();
            await StorageManager.create();
            UIManager.cleanInbox();
            await this.loadAddress();
        } catch (error) {
            console.error('Failed to restart address:', error);
            // Add a small delay before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Retry once
            await StorageManager.clean();
            await StorageManager.create();
            UIManager.cleanInbox();
            await this.loadAddress();
        }
    },

    createRestartEvent() {
        document.getElementById('generate').addEventListener('click', async () => {
            await this.restartAddress();
        })
    },

    loadMails() {
        const inbox = StorageManager.getInbox();
        for (const id in inbox) UIManager.setCompMail(inbox[id]);
    },

    async checking() {
        try {
            const data = StorageManager.get();

            if (!data || !data.token) {
                // If no data or token, generate new address
                await this.restartAddress();
                return;
            }

            const mails = await MailService.getInbox(data.token);

            // If API call fails or returns invalid response, generate new address
            if (!mails) {
                await this.restartAddress();
                return;
            }

            if (mails.length < 1) return;

            const storedMails = StorageManager.getInbox();
            const newMails = mails.filter(mail => !storedMails.hasOwnProperty(mail.id));

            for (let i = 0; i < newMails.length; i++) {
                let mail = newMails[i];
                StorageManager.setMail(mail);
                UIManager.setCompMail(mail);
            }

        } catch (error) {
            // If any error occurs during the process, generate new address
            await this.restartAddress();
        }
    },

    sync() {
        this.syncLoop();
    },

    syncLoop() {

        if (!this.syncDelay) return;

        this.timeoutid = setTimeout(async () => {
            try {
                await this.checking()
            } finally {
                this.sync()
            }
        }, this.syncDelay);

    },

    resetSync() {

        if (!this.syncDelay) return;

        if (this.timeoutid) {
            clearTimeout(this.timeoutid);
            this.timeoutid = null;
        }

        this.sync();

    },

    async init() {
        await StorageManager.init();
        UIManager.init();
        await this.loadAddress();
        this.loadMails();
        this.createRestartEvent();
        this.sync()
    }

};

document.addEventListener('DOMContentLoaded', async () => {

    await Raccoon.init();

    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "updateRetrievalLoop") {
            Raccoon.syncDelay = request.interval;
            Raccoon.resetSync();
        }
    });

    document.getElementById('generate').addEventListener('click', () => {
        const refreshIcon = document.getElementById('generate');
        refreshIcon.classList.add('rotate');
        refreshIcon.addEventListener('animationend', () => {
            refreshIcon.classList.remove('rotate');
        }, {
            once: true
        });
    });

    const adjustIframeHeight = function() {
        const bodyHeight = document.body.scrollHeight;
        let newHeight = 141; // Initial height of the iframe

        if (bodyHeight > 141) {
            newHeight = bodyHeight;
        }

        window.parent.postMessage({
            action: 'adjustHeight',
            height: newHeight
        }, '*');
    }

    const observer = new MutationObserver(() => {
        adjustIframeHeight();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
    });

    adjustIframeHeight();
});