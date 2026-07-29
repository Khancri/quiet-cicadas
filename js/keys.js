import * as db from './db.js';
import * as states from './state.js';
import { createKey } from './crypto-rsa.js';
import { emitAsync } from './utils.js';
import { getUsername } from './userInfo.js';
import { socket } from './chats.js';
import * as cryptoAPI from './crypto.js';
import { updateEncryptedInfo } from './ui.js';

export async function regenRSAKeys() {
    const keys = await createKey();
    await db.savePrivateKey(keys.privateKey);

    const key = await window.crypto.subtle.exportKey('spki', keys.publicKey )
    const b64 = btoa(String.fromCharCode(...new Uint8Array(key)))
    socket.emit('rsa-key-regen', {publicKey: b64});
    alert('done!')
}

export async function fetchKey(channel) {
    console.log(`fetching key for: ${channel}`)
    const list = await emitAsync(socket, 'channel_users', {channel})
    if (list.list === null || list.list.length === 0) {
        states.setKey(await cryptoAPI.createKey());
        db.saveKey(channel, states.key)
        socket.emit('keyupdate', {channel});
        updateEncryptedInfo('end-to-end encrypted (AES-GCM)')
        states.setKeySearching(false);
    } else {
        if (list.list.length === 0) {
            // alert('no one online to give you key ;(');
            document.getElementById('message-input').disabled = true;
            document.getElementById('message-input').placeholder = 'channels locked';
            states.setKeySearching(false);
            updateEncryptedInfo('channel encrypted (all keyholders offline)')
            return;
        }
        if (list.list[0] === getUsername()) {
            await emitAsync(socket, 'forgetkey', {channel: channel});
            await fetchKey(channel)
            return;
        }
        socket.emit('request_key', {user: list.list[0], channel: channel})
    }
    if (list.list.includes(getUsername())) {
        await emitAsync(socket, 'forgetkey', {channel: channel});
        await fetchKey(channel) 
    }
}