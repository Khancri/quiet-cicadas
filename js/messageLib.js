import { getUsername } from "./userInfo.js";
import { twemoji } from "./twemoji.js";

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

export {react}