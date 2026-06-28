const DB_NAME = 'cicadas';
const DB_VERSION = 1.2;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('messages')) {
                const store = db.createObjectStore('messages', { keyPath: 'id' });
                store.createIndex('channel', 'channel', { unique: false });
            }
            if (!db.objectStoreNames.contains('keys')) {
                db.createObjectStore('keys', { keyPath: 'channel' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function saveMessage(messageObj, channel) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('messages', 'readwrite');
        const id = Object.keys(messageObj)[0]
        tx.objectStore('messages').put({ id, channel, ...messageObj });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

export async function saveKey(channel, key) {
    const db = await openDB();
    const exported = await crypto.subtle.exportKey('jwk', key);
    return new Promise((resolve, reject) => {
        const tx = db.transaction('keys', 'readwrite');
        tx.objectStore('keys').put({ channel, key: exported });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

export async function savePrivateKey(key) {
    const db = await openDB();
    const exported = await crypto.subtle.exportKey('pkcs8', key);
const exportedB64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
    console.log(exported);
    alert();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('keys', 'readwrite');
        tx.objectStore('keys').put({ channel: 'private', key: exportedB64 });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

export async function retrievePrivateKey() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('keys', 'readonly');
        const req = tx.objectStore('keys').get('private');
        req.onsuccess = async () => {
            if (!req.result) return resolve(null);
            const binary = atob(req.result.key);
            const buffer = Uint8Array.from(binary, c => c.charCodeAt(0)).buffer;
            const key = await crypto.subtle.importKey('pkcs8', buffer, {name: 'RSA-OAEP', hash:'SHA-256'}, false, ['decrypt'])
            console.log(key);
            resolve(key);
        }
        req.onerror = () => reject(req.error);
    });
}

export async function getKey(channel) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('keys', 'readonly');
        const req = tx.objectStore('keys').get(channel);
        req.onsuccess = async () => {
            if (!req.result) return resolve(null);
            const key = await crypto.subtle.importKey('jwk', req.result.key, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
            resolve(key);
        };
        req.onerror = () => reject(req.error);
    });
}


export async function getMessages(channel) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('messages', 'readonly');
        const index = tx.objectStore('messages').index('channel');
        const req = index.getAll(channel);
        req.onsuccess = () => {
            const result = {};
            for (const msg of req.result) {
                const { id, channel, ...rest } = msg;
                result[id] = rest;
            }
            resolve(result);
        };
        req.onerror = () => reject(req.error);
    });
}

export async function clearChannel(channel) {
    const db = await openDB();
    const messages = await getMessages(channel);
    return new Promise((resolve, reject) => {
        const tx = db.transaction('messages', 'readwrite');
        const store = tx.objectStore('messages');
        messages.forEach(m => store.delete(m.id));
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}