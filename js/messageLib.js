import { getUsername } from "./userInfo.js";
import { twemoji } from "./twemoji.js";

function createMessage(data, id, channel, socket) {
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
        pfp.style.backgroundImage = `url('/pfp/${data.user}')`;
        pfp.style.backgroundSize = 'cover';

        const content = document.createElement('div');
        content.classList.add('content');
        message.appendChild(content);
        message.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            selectedMessageID = id;
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
        if (data.reactions) {
            for (const [emoji, array] of Object.entries(data.reactions)) {
                react({[id]: data}, channel, emoji, socket, message)
            }
        }
        message = twemoji.parse(message);
        return message;
}


function react(messages, channel, emoji, socket, messageObj = null) {
    const id = Object.keys(messages)[0];
    const message = messages[id];
    const reactionRow = messageObj.querySelector('.reaction-row') ?? document.createElement('div');
    reactionRow.className = 'reaction-row'
    const reactionEl = document.createElement('div'); 
    reactionEl.className = 'reaction'; reactionEl.dataset.emoji = emoji;
    reactionEl.innerHTML = `<span class="emoji">${emoji}</span>:<span class="counter">${messages[id].reactions[emoji].length}</span>`
    reactionEl.title = messages[id].reactions[emoji].join(', ')
    if (messages[id].reactions[emoji].includes(getUsername())) {
        reactionEl.classList.add('self-reacted')
    }
    reactionEl.onclick = () => {
        alert('hi'); 
        if (messages[id].reactions[emoji].includes(getUsername())) {
            socket.emit('unreact', {'id': id, reaction: emoji, channel: channel})
        } else {
            socket.emit('react', {'id': id, reaction: emoji, channel: channel})
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


function renderMessages(data, overwrite = false, channel, socket) {
    console.log(data)
    const sorted = Object.entries(data).sort((a, b) => new Date(a[1].date) - new Date(b[1].date));
    const div = document.getElementById('messages')
    for (let i = 0; i < sorted.length; i++) {
        const [key, value] = sorted[i];
        const prev = i > 0 ? sorted[i - 1][1] : null;
        console.log(sorted[i - 1])
        const message = document.querySelector(`[data-id="${key}"]`);
        if (message === null) {
            const el = createMessage(value, key);
            const lastMessage = div.lastElementChild;
            const lastUser = lastMessage?.querySelector('.username')?.innerText;

            if (lastUser === value.user) {
                el.classList.add('grouped');
                lastMessage.classList.add('grouped-head')
            }
            div.appendChild(el);
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


function newChannel(channelName, callback) {
    const channelEl = document.createElement('div');
    channelEl.className = 'dm-item';
    undoAllActiveChannels();
    channelEl.classList.add('active');
    channelEl.dataset.channelData = `${encodeURIComponent(channelName)}`
    const channelNameEl = document.createElement('span');
    channelNameEl.textContent = channelName;
    channelEl.onclick = callback;
    const pfp = document.createElement('div')
    pfp.classList.add('avatar-sm');
    pfp.innerText = '#'
    channelEl.appendChild(pfp);
    channelEl.appendChild(channelNameEl);
    console.log(channelEl);
    document.querySelector('.sidebar').appendChild(channelEl);
}

function newDirectMessageChannel(user, callback) {
    const channelEl = document.createElement('div');
    channelEl.className = 'dm-item';
    channelEl.dataset.userData = encodeURIComponent('@'+ user)
    undoAllActiveChannels();
    channelEl.classList.add('active');
    const channelNameEl = document.createElement('span');
    channelNameEl.textContent = user;
    channelEl.onclick = callback;
    const pfp = document.createElement('div')
    pfp.classList.add('avatar-sm');
    const pfpImg = document.createElement('img');
    pfpImg.src = `/pfp/${user}`
    pfp.appendChild(pfpImg);
    channelEl.appendChild(pfp);
    channelEl.appendChild(channelNameEl);
    console.log(channelEl);
    document.querySelector('.sidebar').appendChild(channelEl);
}

function undoAllActiveChannels() {
    for (const channel of document.querySelectorAll('.sidebar .dm-item.active')) {
        channel.classList.remove('active');
    }
}

export {react, renderMessages, newChannel, newDirectMessageChannel, undoAllActiveChannels}