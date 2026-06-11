async function createKey() {
    return await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256},
        true,
        ['encrypt', 'decrypt']
    );
}

async function encryptMessage(message) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    return await window.crypto.subtle.encrypt(
        {'name': 'AES-GCM', iv: iv},
        key,
        new TextEncoder().encode(message)
    )
}

async function decryptMessage(messageBuf, iv) {
    return await window.crypto.subtle.decrypt(
        {name: 'AES-GCM', iv: iv},
        key,
        messageBuf
    )
}
export const cryptoAPI = {
    decryptMessage: async (x,y) => await decryptMessage(x,y),
    encryptMessage: async (x) => await encryptMessage(x),
    createKey: async () => await createKey(),
}