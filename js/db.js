const DB_NAME = 'cicadas';
const DB_VERSION = 2.5;

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
            if (!db.objectStoreNames.contains('attachments')) {
                db.createObjectStore('attachments', { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function saveMessages(messageObj, channel) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('messages', 'readwrite');
        const id = Object.keys(messageObj)[0]
        tx.objectStore('messages').put({ id, channel, ...messageObj });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

export async function saveSticker(blob, id, name) {
    if (localStorage.getItem('stickers') === null) {
        localStorage.setItem('stickers', '{}');
    }
    const sns = JSON.parse(localStorage.getItem('stickers'))
    sns[name] = id
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('stickers', 'readwrite');
        tx.objectStore('stickers').put({id, blob});
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

export async function getSticker(name) {
    if (localStorage.getItem('stickers') === null) return undefined
    const id = JSON.parse(localStorage.getItem('stickers'))[name]
    const db = await openDB();
    return new Promise((resolve, reject) => {stickers
        const tx = db.transaction('stickers', 'readonly');
        const req = tx.objectStore('stickers').get(id);
        req.onsuccess = async () => {
            if (!req.result) return resolve(null);
            console.log(req.result)
            resolve(req.result.blob);
        };
        req.onerror = () => reject(req.error);
    });
}

export async function saveAttachment(blob, id) {
    console.log(blob)
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('attachments', 'readwrite');
        tx.objectStore('attachments').put({id, blob});
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

export async function getAttachment(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('attachments', 'readonly');
        const req = tx.objectStore('attachments').get(id);
        req.onsuccess = async () => {
            if (!req.result) return resolve(null);
            console.log(req.result)
            resolve(req.result.blob);
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
                result[id] = rest[id];
            }
            resolve(result);
        };
        req.onerror = () => reject(req.error);
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
    console.log(exportedB64);
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
            const key = await crypto.subtle.importKey('pkcs8', buffer, {name: 'RSA-OAEP', hash:'SHA-256'}, false, ['decrypt', 'unwrapKey'])
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
export async function obliterate() {
    localStorage.clear();
    indexedDB.databases().then((dbs) => {
        dbs.forEach((db) => {
            indexedDB.deleteDatabase(db.name);
        });
    });
}

export async function updateReactions(id, reaction, user, channel, action) {
    const messages = await getMessages(channel)
    console.log(messages);
    const message = messages[id]
    console.log(message);
    if (message === undefined) {
        return;
    }
    if (!Object.hasOwn(message, 'reactions')) {
        message.reactions = {};
    }
    console.log(message);
    if (!Object.hasOwn(message.reactions, reaction)) {
        message.reactions[reaction] = [];
    }
    if (action === 'remove') {
        message.reactions[reaction].splice(message.reactions[reaction].indexOf(user), 1)
    } else {
    message.reactions[reaction].push(user);
    }
    
    await saveMessages({[id]: message}, channel);
    console.log(message)
}