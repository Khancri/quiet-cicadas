import * as cryptoAPI from './crypto-rsa.js'

export async function sendMessage(content, user, socket) {
    var publicKey = null;
    socket.emit('public_key_request', {user}, async (key) => {
        console.log(publicKey)
        publicKey = atob(key);
        const keyBuffer = Uint8Array.from(atob(key), c => c.charCodeAt(0));
        publicKey = await window.crypto.subtle.importKey('spki', keyBuffer, {name: 'RSA-OAEP', hash: 'SHA-256'}, false, ['encrypt'])
    
        const encrypted = await cryptoAPI.encryptMessage(content, publicKey)
        socket.emit('dm', {to: user, payload: encrypted})
    });
}

export async function receiveMessage(content, key) {
    return await cryptoAPI.decryptMessage(content, key);
}