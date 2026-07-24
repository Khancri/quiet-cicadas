import { getUsername } from "./userInfo.js";
import { twemoji } from "./twemoji.js";
import * as states from './state.js'
import { pfpValid, showProfileModal } from "./profiles.js";
import { decryptMessage } from "./crypto.js";
import { retrievePrivateKey } from "./db.js";

async function createMessage(data, id, channel, socket) {
    var message = document.createElement('div');
    message.classList.add('message');
    const stripped = data['content'].replace(/\s/g, '');

    const isEmoji = /^\p{Emoji}+$/u.test(stripped);
    if (isEmoji) {
        message.classList.add('emoji-message');
    }
    message.dataset.id = id;
    
    const pfp = document.createElement('div');
    pfp.classList.add('avatar');
    message.appendChild(pfp);
    pfp.style.backgroundImage = `url(/pfp/${data.user})`;
    pfp.style.backgroundSize = 'cover';

    const content = document.createElement('div');
    content.classList.add('content');
    message.appendChild(content);
    message.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        states.setSelectedMessageID(id);
        const menu = document.getElementById('context')
        menu.style.display = 'flex';
        const { pageX: x, pageY: y } = event;
        menu.style.top = `${y}px`
        menu.style.left = `${x}px`
        const thing = document.addEventListener('click', () => {
            menu.style.display = 'none';
        }, {once: true})
    })

    const metadata = document.createElement('div');
    metadata.classList.add('metadata');
    content.appendChild(metadata);

    const usernameEl = document.createElement('b');
    usernameEl.classList.add('username'); usernameEl.innerText = data.user;
    usernameEl.onclick = async (e) => {
        const { pageX: x, pageY: y } = event;
        e.stopPropagation();
        const prof = document.getElementById('profile')
        const clickEvent = (e) => {
            if (e.target.closest('#profile')) return;
            prof.style.display = 'none';
            document.removeEventListener('click', clickEvent);
        };
        await showProfileModal(data.user, clickEvent, {x, y}, socket)
        document.addEventListener('click', clickEvent);
    };
    const dataEl = document.createElement('span');
    const date = new Date(data.date);
    dataEl.classList.add('date'); dataEl.innerText =  date.toLocaleString();
    metadata.appendChild(usernameEl); metadata.appendChild(dataEl);

    const messageContent = document.createElement('span');
    messageContent.classList.add('messageContent'); messageContent.innerText = data.content;
    content.appendChild(messageContent);

    const reactionRow = document.createElement('div');
    reactionRow.className = 'reaction-row';
    content.appendChild(reactionRow);


    if (data.attachmentId) {
        const attachEl = document.createElement('div');
        attachEl.className = 'attachment';
        attachEl.innerText = 'loading attachment...';
        content.appendChild(attachEl);
        loadAttachment(data.attachmentId, attachEl, channel); // no await
    }
    message = twemoji.parse(message);
    return message;
}

function downloadFile(bytes, filename, mimetype) {
    console.log({bytes, filename, mimetype})
    const blob = new Blob([bytes], { type: mimetype });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
}

async function loadAttachment(id, el, channel) {
    const res = await fetch(`/api/attachment-metadata/${id}`)
    if (!res.ok) {
        el.innerText = `🚫 already grabbed file`;
        el.classList.add('disabled')
        return;
    }
    const meta = await res.json();
    console.log(meta);
    if (!meta.pending.includes(getUsername())) {
        el.innerText = `📎 ${meta.fileName} (already have)`;
        el.classList.add('disabled')
        return;
    }
    el.innerText = `📎 ${meta.fileName}`;
    const iv = Uint8Array.from(atob(meta.iv), c => c.charCodeAt(0));
    el.style.cursor = 'pointer';
    if (meta.key !== undefined) {
        el.onclick = async () => {
            el.innerText = 'downloading...';

            const privKey = await retrievePrivateKey();
            const keyBuffer = Uint8Array.from(atob(meta.key), c => c.charCodeAt(0)).buffer;
            const fileKey = await window.crypto.subtle.unwrapKey('raw', keyBuffer, privKey, {name: 'RSA-OAEP'}, {name: 'AES-GCM', length: 256}, true, ['encrypt', 'decrypt'])

            const res = await fetch(`/api/attachment/${id}`);
            const encrypted = await res.arrayBuffer();
            const decrypted = await decryptMessage(encrypted, iv, fileKey)
            console.log(decrypted)
            downloadFile(decrypted, meta.fileName, meta.mime_type);
            el.innerText = `📎 ${meta.fileName} (downloaded)`;
        };
        return;
    }
    el.onclick = async () => {
        el.innerText = 'downloading...';
        const res = await fetch(`/api/attachment/${id}`);
        const encrypted = await res.arrayBuffer();
        const decrypted = await decryptMessage(encrypted, iv, states.key)
        console.log(decrypted)
        downloadFile(decrypted, meta.fileName, meta.mime_type);
        el.innerText = `📎 ${meta.fileName} (downloaded)`;
    };
}

function react(id, channel, emoji, user, action, socket, messageObj) {
    const messages = document.querySelector('.messages');
    if (!messageObj) {
        messageObj = document.querySelector(`[data-id="${id}"]`)
    }
    const reactionRow = messageObj.querySelector('.reaction-row') ?? document.createElement('div');
    const reactionEl = reactionRow.querySelector(`[data-emoji="${encodeURIComponent(emoji)}"]`) ?? document.createElement('div'); 
    var counter;
    if (messageObj.querySelector(`[data-emoji="${encodeURIComponent(emoji)}"]`) !== null) {
        counter = parseInt(reactionEl.querySelector('.counter').innerText, 10); 
    } else {
        counter = 0;
    }
    reactionRow.className = 'reaction-row'
    reactionEl.className = 'reaction'; reactionEl.dataset.emoji = encodeURIComponent(emoji);
    reactionEl.innerHTML = `<span class="emoji">${emoji}</span><span class="counter">${counter+1}</span>`
    // // reactionEl.title = messageObj.reactions[emoji].join(', ')
    var peopleReacted;
    if (reactionEl.dataset.peopleReacted === undefined ||
         reactionEl.dataset.peopleReacted === null) {
        peopleReacted = [];
    } else {
        peopleReacted = reactionEl.dataset.peopleReacted.split(',');
    }
    peopleReacted.push(user);
    reactionEl.dataset.peopleReacted = peopleReacted.join(',')
    reactionEl.title = peopleReacted.join(', ')
    if (peopleReacted.includes(getUsername())) {
        reactionEl.classList.add('self-reacted')
    }
    reactionEl.onclick = () => {
        if (peopleReacted.includes(getUsername())) {
            socket.emit('unreact', {id: id, reaction: emoji, channel: channel})
        } else {
            socket.emit('react', {id: id, reaction: emoji, channel: channel})
        }
    };  
    twemoji.parse(reactionEl);
    console.log(reactionEl.outerHTML)
    reactionRow.appendChild(reactionEl);
    if (!messageObj.querySelector('.reaction-row')) {
        messageObj.appendChild(reactionRow);
    }
    console.log(messageObj)
    return reactionRow
}


async function renderMessages(data, overwrite = false, channel, socket) {
    console.log(data)
    const sorted = Object.entries(data).sort((a, b) => new Date(a[1].date) - new Date(b[1].date));
    const div = document.getElementById('messages')
    for (let i = 0; i < sorted.length; i++) {
        const [key, value] = sorted[i];
        const prev = i > 0 ? sorted[i - 1][1] : null;
        console.log(sorted[i - 1])
        const message = document.querySelector(`[data-id="${key}"]`);
        if (message === null) {
            const el = await createMessage(value, key, channel, socket);
            const lastMessage = div.lastElementChild;
            const lastUser = lastMessage?.querySelector('.username')?.innerText;

            if (lastUser === value.user) {
                el.classList.add('grouped');
                lastMessage.classList.add('grouped-head')
            }
            div.appendChild(el);
            
            if (value.reactions) {
                for (const [emoji, array] of Object.entries(value.reactions)) {
                    for (const user of array) {
                        react(key, channel, emoji, user, 'add', socket);
                    }
                }
            }
        } 
        else if (overwrite === true) {
            var reactionRow = message.querySelector('.reaction-row')
            console.log(value)
            for (const el of reactionRow.querySelectorAll('.reaction')) {
                if (!value.reactions[el.dataset.emoji]) {
                    el.remove();
                }
            }
            for (const [emoji, array] of Object.entries(value.reactions)) {
                if (reactionRow.querySelector(`.reaction[data-emoji=\"${emoji}\"]`)) {
                    reactionRow.querySelector(`.reaction[data-emoji=\"${emoji}\"] > span.counter`).innerText = array.length;
                } else {
                    reactionRow = react({[key]: value}, channel, emoji, socket, message)
                }
            }
        }
    }
}

function closeChannel(channelName) {
    var channelRanking;
    if (channelName.startsWith('@')) {
        channelRanking = document.querySelector(`[data-user-data="${channelName.replace('@', '')}"]`);
    } else {
        channelRanking = document.querySelector(`[data-channel-data="${channelName}"]`);
    }
    removeChannelFromHistory(channelName)
    channelRanking.remove();
}

function newChannel(channelName, callback) {
    if (document.querySelector(`[data-channel-data="${encodeURIComponent(channelName)}"]`) !== null) {
        undoAllActiveChannels();
        document.querySelector(`[data-channel-data="${encodeURIComponent(channelName)}"]`).classList.add('active');
        return;
    };
    const channelRanking = document.querySelector('#t-channelRanking').content.cloneNode(true);
    channelRanking.querySelector('span').innerText = channelName;
    // channelRanking.onclick = callback
    channelRanking.querySelector('.channel-exit').onclick = () => closeChannel(channelName)
    // channelRanking.dataset.channelData = channelName;
    console.log(channelRanking);
    document.querySelector('#channelList').appendChild(channelRanking);
    const list = document.querySelectorAll('#channelList > .dm-item');
    console.log(list[list.length-1]);
    list[list.length-1].onclick = callback;
    list[list.length-1].dataset.channelData = encodeURIComponent(channelName);
    addChannelToHistory(channelName)
}

async function newDirectMessageChannel(user, callback) {
    if (document.querySelector(`[data-user-data="${encodeURIComponent(`@${user}`)}"]`) !==null) {
        undoAllActiveChannels();
        document.querySelector(`[data-user-data="${encodeURIComponent(user)}"]`).classList.add('active');
        return;
    };
    undoAllActiveChannels();
    const channelRanking = document.querySelector('#t-userRanking').content.cloneNode(true);
    channelRanking.querySelector('span').innerText = user;
    const valid = await pfpValid(user);
    if (!valid[0]) {
        channelRanking.querySelector('.avatar-sm').appendChild(valid[1])
    } else {
        channelRanking.querySelector('img').src = `/pfp/${user}`
    }
    
    channelRanking.querySelector('.channel-exit').onclick = () => closeChannel('@' + user)
    channelRanking.onclick = (e) => {
        if (e.closest('.channel-exit')) {
            // console.log('nun')
            return;
        }
        callback();
    };
    console.log(channelRanking);
    document.querySelector('#dmList').appendChild(channelRanking);
    
    const list = document.querySelectorAll('#dmList > .dm-item');
    list[list.length-1].dataset.userData = encodeURIComponent(user);
    list[list.length-1].onclick = callback;
    console.log(list[list.length-1]);
    addChannelToHistory(`@${user}`);
}

function undoAllActiveChannels() {
    for (const channel of document.querySelectorAll('.sidebar .dm-item.active')) {
        channel.classList.remove('active');
    }
}


function addChannelToHistory(channel) {
    var orig = JSON.parse(localStorage.getItem('open-channels'));
    if (orig == null) {
        orig = {};
    }
    orig[channel] = true;
    localStorage.setItem('open-channels', JSON.stringify(orig));
}

function removeChannelFromHistory(channel) {
    var orig = JSON.parse(localStorage.getItem('open-channels'));
    if (orig === null) return;
    delete orig[channel];
    localStorage.setItem('open-channels', JSON.stringify(orig));
}

function getChannelHistory() {
    return JSON.parse(localStorage.getItem('open-channels'));
}
export {
    react, renderMessages, newChannel, 
    newDirectMessageChannel, undoAllActiveChannels, 
    getChannelHistory, removeChannelFromHistory, addChannelToHistory
}