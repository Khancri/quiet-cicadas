import * as cryptoAPI from './crypto-rsa.js'
import { renderMessages } from './messageLib.js';
import { saveMessages } from './db.js';
import { getUsername } from './userInfo.js';
export async function sendMessage(content, user, socket) {
    var publicKey = null;
    socket.emit('public_key_request', {user}, async (key) => {
        publicKey = atob(key);
        const keyBuffer = Uint8Array.from(atob(key), c => c.charCodeAt(0));
        publicKey = await window.crypto.subtle.importKey('spki', keyBuffer, {name: 'RSA-OAEP', hash: 'SHA-256'}, false, ['encrypt'])
        console.log(publicKey)
    
        const encrypted = await cryptoAPI.encryptMessage(content, publicKey)
        console.log(encrypted)
        socket.emit('dm', {to: user, payload: encrypted}, async (data) => {
            console.log(data)
            renderMessages({[data.hash]: {'date': data.date, content: content, user: getUsername()}}, false, `@${user}`, socket)
            saveMessages({[data.hash]: {'date': data.date, content: content, user: getUsername()}}, `@${user}`)

        })
    });
}

export async function receiveMessage(content, key) {
    return await cryptoAPI.decryptMessage(content, key);
}