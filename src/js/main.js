'use strict'

const MailService = {

    endpoint: 'https://www.1secmail.com/api/v1/',

    async genAddress() {
        const [address] = await Request.data(`${this.endpoint}?action=genRandomMailbox`, {});
        return address;
    },

    async getInbox(email) {
        const [username, domain] = email.split('@');
        return await Request.data(`${this.endpoint}?action=getMessages&login=${username}&domain=${domain}`, {});
    },

    async getMail(email, id) {
        const [username, domain] = email.split('@');
        return await Request.data(`${this.endpoint}?action=readMessage&login=${username}&domain=${domain}&id=${id}`, {});
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

                if (!response.ok) throw new Error(response.status);

                return response.json();

            } catch (error) {
                if (retries === 0 || error.name === 'AbortError') throw error;
                retries--;
                await this.delay(1000);
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
        const format = {
            address: await MailService.genAddress() ?? ": /",
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

        if (mailData.read) mailComp.classList.add('read');

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
        const windowFeatures = 'width=300,height=500,toolbar=0,location=0,menubar=0';
        const floatingTab = window.open('', '_blank', windowFeatures);
        floatingTab.document.open();
        floatingTab.document.write('<html><head><title>Email Content</title></head><body>');
        floatingTab.document.write(mail.htmlBody ?? mail.textBody);
        floatingTab.document.close();
    },

    init() {
        this.compInbox.addEventListener('click', (event) => {
            const target = event.target.closest('.inbox-item');
            if (target) {
                const mail = StorageManager.getMail(target.getAttribute('mailid'));
                this.openMail(mail);
            }
        });
    },
};

const Raccoon = {

    status: null,
    syncDelay: 1000,
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
        await StorageManager.clean();
        await StorageManager.create();
        UIManager.cleanInbox();
        Raccoon.loadAddress();
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

            if (!data) return;

            const mails = await MailService.getInbox(data.address);

            if (!mails || mails.length < 1) return;

            const storedMails = StorageManager.getInbox();
            const newMails = mails.filter(mail => !storedMails.hasOwnProperty(mail.id));

            for (let i = 0; i < newMails.length; i++) {
                let mail = {
                    ...(await MailService.getMail(data.address, newMails[i].id)),
                    read: false
                };
                StorageManager.setMail(mail);
                UIManager.setCompMail(mail);
            }

        } catch (error) {
            // console.error('Error:', error);
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

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "updateRetrievalLoop") {
            Raccoon.syncDelay = request.interval;
            Raccoon.resetSync();
        }
        sendResponse();
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