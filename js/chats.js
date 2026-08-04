import io from './socketio.js'
import Cropper from './cropper.js'

// import { createToast = } from './toasts.js';
import * as cryptoAPI from './crypto.js';
import * as RSA from './rsa.js';
import { createKey } from './crypto-rsa.js';
import * as messagesLib from './messageLib.js'
import { getUsername, updateInfo } from './userInfo.js';
import { twemoji } from './twemoji.js';
import * as db from './db.js'
import { pfpValid } from './profiles.js';
import { changeMainPanel, updateEncryptedInfo, renderChannelHistory, createNotificationBadge  } from './ui.js';
import * as states from './state.js'
import linkSocket from './socket.js'
import {linkDefaultEventListeners} from './events.js';
import {emitAsync, getUserFromChannel, getDMChannelName} from './utils.js';
import * as keys from './keys.js';

export const socket = io({ transports: ['websocket'],
  forceBase64: false  });
console.log(socket.io.engine.transport.name)


const daata = {
    'uuid': {
        date: '2026-06-09T11:11:40.152Z',
        content: 'oo ee oo aa aa ting tang walla walla bang bang',
        user: 'khancri',
        reactions: {
            '🎉': ['khancri', 'l.', 'giitar_ruff'],
            '⛷': ['sneakylinkbj']
        }
    },
    'uuid2': {
        date: '2026-06-09T11:11:40.152Z',
        content: '😼',
        user: 'khancri',
        reactions: {
            '😼': ['khancri', 'meow meow ']
        }
    }
}
changeMainPanel(document.getElementById('t-chatBox'))
await cacheCheck();
if (!await db.retrievePrivateKey()) {
    keys.regenRSAKeys();
}

renderChannelHistory(); 
messagesLib.newChannel('general', async () => {
    changeMessageBox('general')
});

await changeMessageBox('general');

async function cacheCheck() {
    updateEncryptedInfo('Grabbing Cache..')
    const cache = await emitAsync(socket, 'cachegrab')
    console.log('cache', cache);
    for (const obj of cache) {
        if (obj.action) {
            db.updateReactions(obj.id, obj.content, obj.user, obj.channel, obj.action)
            return;
        }
        var channel;
        if (!obj.iv) {
            obj.content = new TextDecoder().decode(await RSA.receiveMessage(obj.content, await db.retrievePrivateKey()))
            createNotificationBadge(getDMChannelName(obj.user))
        } else {
            console.log(obj);
            states.setChannel(obj.channel);
            const channelKey = await db.getKey(obj.channel)
            console.log(channelKey)
            obj.content = new TextDecoder().decode(await cryptoAPI.decryptMessage(obj.content, obj.iv, channelKey))
            db.addUnread(obj.channel)
            console.log(obj.channel)
        }
        const id = obj.id
        const saveChannel = obj.channel ?? getDMChannelName(obj.user)
        await db.saveMessages({[id]:obj}, saveChannel)
    }
    updateEncryptedInfo('Complete!')
}


async function subscribeToPush() {
    const json = await fetch('/api/notificationKey')
    var notifkey = (await (json).json()).key;
    const serviceWorker_sw = await navigator.serviceWorker.register('file/js/sw.js')
    // serviceWorker_sw.addEventListener('updatefound', () => {
    //     const newWorker = reg.installing;
    //     newWorker.addEventListener('statechange', () => {
    //     // Check if the new service worker is installed and waiting
    //     if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
    //         // Prompt user to refresh, e.g., show a banner: "Update Available"
    //         alert("New version available! Refresh to update.");
    //     }
    //     });
    // });
    
    console.log(notifkey)
    console.log('here')
    notifkey = urlBase64ToUint8Array(notifkey);
    const sub = await serviceWorker_sw.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: notifkey
    });
    console.log(sub)

    await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub)
    });
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}



export async function regetKey() { 
    document.getElementById('message-input').placeholder = 'say something...';
    document.getElementById('message-input').disabled = false;
    if (states.channel.startsWith('@')) {
        const user = getUserFromChannel(states.channel);
        console.log(`user: ${user}`)
        var key_ = await emitAsync(socket, 'public_key_request', {user})

        if (key_ === undefined) {
            updateEncryptedInfo('user doesn\'t exist');
            return;
        }
        key_ = Uint8Array.from(atob(key_), c => c.charCodeAt(0));
        key_ = await window.crypto.subtle.importKey('spki', key_, {name: 'RSA-OAEP', hash: 'SHA-256'}, true, ['encrypt'])
        states.setKey(key_)
        updateEncryptedInfo('end-to-end encrypted (RSA)')
        return;
    }
    key_ = await db.getKey(states.channel)
    if (key_ === null) {
        keys.fetchKey(states.channel);
        states.setKeySearching(true);
    } else {
        console.log('key found!')
        updateEncryptedInfo('end-to-end encrypted (AES-GCM)')
        states.setKey(key_);
    }
}
window.refreshKey = regetKey;

document.getElementById('regen-keys').onclick = async () => {
    keys.regenRSAKeys();
}
var cropper;
document.getElementById('pfp-file-input').onchange = async (e) => {
    const img = document.getElementById('pfp-file-input').files[0];
    document.getElementById('modal').innerHTML = `<img id="cropImg" style="max-width:100%"><button id="crop-complete">Done</button>`
    document.getElementById('modal').style.display = 'block';
    const el = document.getElementById('cropImg');
    el.src = URL.createObjectURL(img);
    el.onload = () => {
        if (cropper) cropper.destroy();
        cropper = new Cropper(el, {
            aspectRatio: 1,
            viewMode: 1,
        });
    };
    setTimeout(() => {
        document.getElementById('crop-complete').addEventListener('click', () => {
            alert('hi');
            cropper.getCroppedCanvas().toBlob(async (blob) => {
                const formData = new FormData();
                formData.append('pfp', blob, 'pfp.png');
                const pfpUpload = await fetch('pfp', {method: 'POST', body: formData});
                if (pfpUpload.status == 204) {
                    alert('uploaded!');
                    document.getElementById('corner-pfp').src = `/pfp/${getUsername()}` + "?t=" + new Date().getTime()
                }
            });
            document.getElementById('modal').innerHTML = '';
            document.getElementById('modal').style.display = 'none';
        }, {once: true});

    }, 500);
};



export const encryptOpts = {

    'group':  async (content, channel) => {
        var fileId = null;
        if (states.pendingAttachments !== null) {
            const formData = new FormData()
            const array = await states.pendingAttachments.arrayBuffer()
            console.log(array)
            const image = await cryptoAPI.encryptFile(array, states.key)
            console.log(image)
            
            formData.append('file', new Blob([image[0]]))
            formData.append('iv', btoa(String.fromCharCode(...image[1])))
            formData.append('channel', states.channel)
            formData.append('fileName', states.pendingAttachments.name)
            formData.append('mimeType', states.pendingAttachments.type)
            const res = await fetch('/api/upload', {method: 'POST', body: formData})
            document.getElementById('attachment-preview').hidden = true;
            document.getElementById('attachment-input').value = '';
            if (!res.ok) {alert('file lost in transit'); return;}
            fileId = (await res.json()).id
            if (states.pendingAttachments.type.startsWith('image/')) {
                await db.saveAttachment(new Blob([array], {type: states.pendingAttachments.type}), fileId)
            }
            states.setPendingAttachments(null);
        }
        const encrypted = await cryptoAPI.encryptMessage(content, states.key)

        const message_obj = {
            content: encrypted[0],
            channel: channel,
            iv: encrypted[1]
        }
        console.log('sending..', message_obj)
        if (fileId !== null) {
            message_obj.attachments = [fileId]
        } 

        socket.emit('message', message_obj);
    },
    'dm': async (content, user, socket) => {

        var fileId = null;
        if (states.pendingAttachments !== null) {

            const fileKey = await cryptoAPI.createKey()

            const formData = new FormData()
            const array = await states.pendingAttachments.arrayBuffer()
            console.log(array)
            const image = await cryptoAPI.encryptFile(array, fileKey)
            console.log(image)
            var publicKey = await emitAsync(socket, 'public_key_request', {user})
            const keyBuffer = Uint8Array.from(atob(publicKey), c => c.charCodeAt(0));
            publicKey = await crypto.subtle.importKey('spki', keyBuffer, {name: 'RSA-OAEP', hash: 'SHA-256'}, true, ['wrapKey']);
            const wrappedKey = await crypto.subtle.wrapKey('raw', fileKey, publicKey, {name: 'RSA-OAEP'});
            
            formData.append('file', new Blob([image[0]]))
            formData.append('key', btoa(String.fromCharCode(...new Uint8Array(wrappedKey))))
            formData.append('iv', btoa(String.fromCharCode(...image[1])))
            formData.append('channel', states.channel)
            formData.append('fileName', states.pendingAttachments.name)
            formData.append('mimeType', states.pendingAttachments.type)
            const res = await fetch('/api/upload', {method: 'POST', body: formData})
            states.setPendingAttachments(null);
            document.getElementById('attachment-preview').hidden = true;
            document.getElementById('attachment-input').value = '';
            if (!res.ok) {alert('file lost in transit'); return;}
            fileId = (await res.json()).id
        }
        if (fileId !== null) {
            console.log('dm file id')
            return await RSA.sendMessage(content, user, socket, fileId)
        }
        return await RSA.sendMessage(content, user, socket)
    },
}




var timeout;
export async function changeMessageBox(channelName) {
    changeMainPanel(document.getElementById('t-chatBox'));
    updateEncryptedInfo('Finding brood metadata...')
    if (states.channel) socket.emit('typing', {channel: states.channel, prevEntered: true})
    clearTimeout(timeout)
    document.getElementById('typing-indicator').style.display = 'none';
    messagesLib.undoAllActiveChannels();
    if (channelName.startsWith('@')) {
        states.setChannel(getDMChannelName(channelName.replace('@', '')))
    } else {
        states.setChannel(channelName)
    }

    if (states.channel.startsWith('@')) {
        const user = getUserFromChannel(states.channel);
        if (document.querySelector(`[data-user-data="${encodeURIComponent(user)}"]`) === null) return;
        document.querySelector(`[data-user-data="${encodeURIComponent(user)}"]`).classList.add('active')
        document.querySelector(`[data-user-data="${encodeURIComponent(user)}"]`).classList.remove('notify')
        document.getElementById('channel-name').innerText = `@${user}`
        db.removeUnread(getDMChannelName(user))
    } else {
        console.log(`.sidebar .dm-item[data-channel-name="${encodeURIComponent(states.channel)}"]`)
        document.querySelector(`[data-channel-data="${encodeURIComponent(states.channel)}"]`).classList.add('active')
        document.querySelector(`[data-channel-data="${encodeURIComponent(states.channel)}"]`).classList.remove('notify')
        document.getElementById('channel-name').innerText = `#${states.channel}`
        states.setChannel(channelName)
        db.removeUnread(channelName)
    }
    await regetKey();

    document.getElementById('messages').innerHTML = '';

    console.log(states.channel)
    await getMessages1();
    socket.emit("join", { room: states.channel });
}



checkUser();

async function checkUser() {
    const username = (await (await fetch('me')).json()).username
    const valid = await pfpValid(username)
    const cornerPfp = document.getElementById('corner-pfp');
    const oldAvatar = cornerPfp.querySelector('.ascii-avatar');
    if (oldAvatar) oldAvatar.remove();
    if (!valid[0]) {
        cornerPfp.appendChild(valid[1])
        document.querySelector('#corner-pfp img').style.display = 'none';
    } else {
        document.querySelector('#corner-pfp img').style.display = 'block';
        document.querySelector('#corner-pfp img').src = `/pfp/${username}`;
    }
    
    updateInfo(username);
    document.getElementById('current-user-username').innerText = username;
}

export async function getMessages1() {
    console.log('getting messages..')
    var data = await db.getMessages(states.channel);
    console.log(data)
    if (!data || Object.keys(data).length === 0) return;
    await messagesLib.renderMessages(data, false, states.channel, socket);
}





function unreact(emoji, messageID, channel) {
    socket.emit('unreact', {id: states.selectedMessageID, reaction: emoji, channel: channel})
}






linkDefaultEventListeners(socket);
linkSocket(socket)