async function createKey() {
    return await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256},
        true,
        ['encrypt', 'decrypt']
    );
}

async function encryptMessage(message, key) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    return [await window.crypto.subtle.encrypt(
        {'name': 'AES-GCM', iv: iv},
        key,
        new TextEncoder().encode(message)
    ), iv]
}

async function decryptMessage(messageBuf, iv, key) {
    return await window.crypto.subtle.decrypt(
        {name: 'AES-GCM', iv: iv},
        key,
        messageBuf
    )
}

async function encryptFile(arrayBuffer, key) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
        {name: 'AES-GCM', iv},
        key,
        arrayBuffer // raw bytes, no TextEncoder
    );
    return [encrypted, iv];
}

export {decryptMessage, createKey, encryptMessage, encryptFile};