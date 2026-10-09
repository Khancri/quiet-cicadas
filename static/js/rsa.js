import * as cryptoAPI from './crypto-rsa.js'
import { renderMessages } from './messageLib.js';
import { saveMessages } from './db.js';
import { getUsername } from './userInfo.js';


function emitAsync(socket, event, data) {
  return new Promise((resolve) => {
    socket.emit(event, data, resolve)
  })
}export async function sendMessage(content, user, socket, fileId = null) {
    var publicKey = null;
    const key = await emitAsync(socket, 'public_key_request', {user})
    
    publicKey = atob(key);
    const keyBuffer = Uint8Array.from(atob(key), c => c.charCodeAt(0));
    publicKey = await window.crypto.subtle.importKey('spki', keyBuffer, {name: 'RSA-OAEP', hash: 'SHA-256'}, false, ['encrypt'])
    console.log(publicKey)

    const encrypted = await cryptoAPI.encryptMessage(content, publicKey)
    console.log(encrypted)
    const message_obj = {to: user, payload: encrypted}
    if (fileId !== null) {
      console.log('adding attachment file id to message obj')
      message_obj.attachments = [fileId]
    }
    return await emitAsync(socket, 'dm', message_obj)

}

export async function receiveMessage(content, key) {
    return await cryptoAPI.decryptMessage(content, key);
}