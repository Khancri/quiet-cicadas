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
import { updateEncryptedInfo } from './ui.js';
import * as states from './state.js'
import linkSocket from './socket.js'
import linkEventListeners from './events.js';
import * as keys from './keys.js';

export const socket = io();



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
await cacheCheck();
if (!await db.retrievePrivateKey()) {
    keys.regenKeys();
}

renderChannelHistory(); 
messagesLib.newChannel('general', async () => {
    changeMessageBox('general')
});

await changeMessageBox('general');

async function cacheCheck() {
    updateEncryptedInfo('Grabbing Cache..')
    const cache = await emitAsync(socket, 'cachegrab')
    console.log(cache);
    for (const [id, value] of Object.entries(cache)) {
        if (id === 'reactions') {
            console.log('loading reactions')
            for (const [id, value] of Object.entries(cache)) {
                messagesLib.react(id, value.channel, data.reaction, data.user, data.action, socket)
            }
            continue
        }
        var channel;
        if (value.iv === null) {
            value.content = new TextDecoder().decode(await RSA.receiveMessage(value.content, await db.retrievePrivateKey()))
            states.setChannel(value.channel.replace('@', '').replace(getUsername(), '').replace('-', ''));
        } else {
            console.log(value);
            states.setChannel(value.channel);
            value.content = new TextDecoder().decode(await cryptoAPI.decryptMessage(value.content, value.iv, await db.getKey(channel)))
        }

        console.log(value.channel)
        await db.saveMessages({[id]:value}, value.channel)
    }
    updateEncryptedInfo('Complete!')
}

//   .then(reg => console.log('sw registered', reg))
//   .catch(err => console.error('sw registration failed', err));


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

export function getUserFromChannel() {
    const list = states.channel.replace('@', '').split('-')
        list.splice(list.indexOf(getUsername()), 1); const user = list[0];
        return user;
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
        updateEncryptedInfo('end-to-encrypted (RSA)')
        return;
    }
    key_ = await db.getKey(states.channel)
    if (key_ === null) {
        keys.fetchKey(states.channel);
        states.setKeySearching(true);
    } else {
        updateEncryptedInfo('end-to-end encrypted (AES-GCM)')
        states.setKey(key_);
    }
}
window.refreshKey = regetKey;

document.getElementById('regen-keys').onclick = async () => {
    regenKeys();
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



function renderChannelHistory(dmCallback, callback) {
    const history = messagesLib.getChannelHistory();
    if (history === null) return
    for (const [channel, status] of Object.entries(history)) {
        if (status === false) continue;
        if (channel.startsWith('@')) {
            messagesLib.newDirectMessageChannel(channel.replace('@', ''), async () => {
                await changeMessageBox(channel)
            })
        } else {
            messagesLib.newChannel(channel, async () => {
                await changeMessageBox(channel)
            })
        }
    }
}
var timeout;
export async function changeMessageBox(channelName) {
    updateEncryptedInfo('Finding brood metadata...')
    socket.emit('typing', {channel: states.channel, prevEntered: true})
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


export function getDMChannelName(user) {
    if (user.localeCompare(getUsername()) < 0) {
        return `@${user}-${getUsername()}`
    } else {
        return`@${getUsername()}-${user}`
    }
}


    checkUser();
    // getMessages1();
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
    var data = await db.getMessages(states.channel);
    if (!data || Object.keys(data).length === 0) return;
    await messagesLib.renderMessages(data, false, states.channel, socket);
}




document.querySelector('.hamburger').onclick = () => {
    document.querySelector('.sidebar').style.transform = 'none';
}

document.querySelector('.sidebar-disable').onclick = () => {
    document.querySelector('.sidebar').style.transform = 'translateX(-100%)';
}


function unreact(emoji, messageID, channel) {
    socket.emit('unreact', {id: states.selectedMessageID, reaction: emoji, channel: channel})
}




export function emitAsync(socket, event, data) {
  return new Promise((resolve) => {
    socket.emit(event, data, resolve)
  })
}
linkEventListeners(socket);
linkSocket(socket)