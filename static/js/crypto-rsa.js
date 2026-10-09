async function createKey() {
    return await window.crypto.subtle.generateKey(
        { 
            name: 'RSA-OAEP', 
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256'
        },
        true,
        ['encrypt', 'decrypt']
    );
}

async function encryptMessage(message, key) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    return await window.crypto.subtle.encrypt(
        {'name': 'RSA-OAEP', 'hash': 'SHA-256'},
        key,
        new TextEncoder().encode(message)
    )
}

async function decryptMessage(messageBuf, key) {
    return await window.crypto.subtle.decrypt(
        {'name': 'RSA-OAEP', 'hash': 'SHA-256'},
        key,
        messageBuf
    )
}
export {decryptMessage, createKey, encryptMessage};