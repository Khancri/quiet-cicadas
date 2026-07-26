import { updateEncryptedInfo } from './ui.js'
import * as states from './state.js'
import * as RSA from './rsa.js'
import * as cryptoAPI from './crypto.js'
import * as db from './db.js'
import * as messagesLib from './messageLib.js'
import { getUsername } from './userInfo.js'

function getDMChannelName(user) {
    if (user.localeCompare(getUsername()) < 0) {
        return `@${user}-${getUsername()}`
    } else {
        return`@${getUsername()}-${user}`
    }
}

function emitAsync(socket, event, data) {
  return new Promise((resolve) => {
    socket.emit(event, data, resolve)
  })
}


export default function linkSocket(socket) {
    socket.on('key_exchange', async (data, callback) => {
        const requestedKey = await db.getKey(data['channel']);
        const key = await emitAsync(socket,'public_key_request', {user: data['user']})
        const keyBuffer = Uint8Array.from(atob(key), c => c.charCodeAt(0));
        const publicKey = await crypto.subtle.importKey('spki', keyBuffer, {name: 'RSA-OAEP', hash: 'SHA-256'}, true, ['wrapKey']);
        const wrappedKey = await crypto.subtle.wrapKey('raw', requestedKey, publicKey, {name: 'RSA-OAEP'});
        console.log(callback)
        socket.emit('request_key_complete', {user: data['user'], payload: btoa(String.fromCharCode(...new Uint8Array(wrappedKey)))});
    });    

    socket.on('request_key_complete', async (key_) => {
        const keyBuffer = Uint8Array.from(atob(key_), c => c.charCodeAt(0)).buffer;
        const privKey = await db.retrievePrivateKey();
        key_ = await window.crypto.subtle.unwrapKey('raw', keyBuffer, privKey, {name: 'RSA-OAEP'}, {name: 'AES-GCM', length: 256}, true, ['encrypt', 'decrypt'])
        states.setKeySearching(false);
        db.saveKey(states.channel, key_);
        socket.emit('keyupdate', {channel: states.channel});
        states.setKey(key_);
        updateEncryptedInfo('end-to-end encrypted (AES-GCM)')
    });

    socket.on('typing', async (data) => {
        const indicator = document.getElementById('typing-indicator');
        if (data.length === 0) {
            indicator.hidden = true;
            return; 
        } 
        if (data.includes(getUsername())) {
            const i = data.indexOf(getUsername());
            data.splice(i, 1);
            data.reverse();
            data.push('You');
            data.reverse();
        }
        if (data.length > 1) {
            indicator.querySelector('.is-are').innerText = 'are'
            console.log('multi')
        } else if (data.length === 1 && data.includes('You')) {
            indicator.querySelector('.is-are').innerText = 'are'
            console.log('you')
        } else {
            indicator.querySelector('.is-are').innerText = 'is'
            console.log('single')
        }
        
        indicator.hidden = false;
        const span = indicator.querySelector('.user');
        span.innerText = data.join(', ');
    })

    socket.on('new_message', async (message) => {
        message[Object.keys(message)[0]].content = new TextDecoder().decode(await cryptoAPI.decryptMessage(message[Object.keys(message)[0]].content, message[Object.keys(message)[0]].iv, states.key))
        await messagesLib.renderMessages(message, false, states.channel, socket); 
        const messages = document.getElementById('messages');
        await db.saveMessages(message, states.channel);
        
        messages.scrollTop = messages.scrollHeight;
    });

    socket.on('dm', async (message) => {
        console.log(message)
        const obj = message[Object.keys(message)[0]];
        const privKey = await db.retrievePrivateKey();
        obj.content = new TextDecoder().decode(await RSA.receiveMessage(obj.content, privKey))
        if (states.channel === getDMChannelName(obj['user'])){
            await messagesLib.renderMessages(message, false, states.channel, socket); 
        } else{
            console.log('no renders')
        }
        await db.saveMessages(message, `${states.channel}`);
        
        const messages = document.getElementById('messages');
        messages.scrollTop = messages.scrollHeight;
    });

    socket.on('message_reacted', (data) => {
        console.log(data)
        messagesLib.react(data['id'], states.channel, data['reaction'], data['user'], data['action'], socket);
        db.updateReactions(data['id'], data['reaction'], data['user'], states.channel, data['action'])
    })

    socket.on('direct_message', async (data) => {
        const privKey = await db.retrievePrivateKey();
        if (privKey === null) {alert('NOOOO TRUMP'); return;}
        const decrypted = await RSA.receiveMessage(data, privKey);
        alert(new TextDecoder().decode(decrypted));
    })
}