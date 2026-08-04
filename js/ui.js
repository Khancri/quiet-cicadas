import { changeMessageBox } from "./chats.js";
import { addUnread } from "./db.js";
import * as events from './events.js';
import * as messagesLib from "./messageLib.js";
import * as states from "./state.js";
import { getDMChannelName, getUserFromChannel } from "./utils.js";

export function updateEncryptedInfo(message) {
    if (!document.getElementById('encryption-status')) return;
    document.getElementById('encryption-status').innerText = message;
}

export async function createNotificationBadge(channel) {
    addUnread(channel);
    if (channel.startsWith('@')) {
        const user = getUserFromChannel(channel);
        console.log(`notification from ${user}`, channel)
        console.log(`[data-user-data="${encodeURIComponent(user)}"]`)
        let el = document.querySelector(`[data-user-data="${encodeURIComponent(user)}"]`)
        if (!el) {
            await messagesLib.newDirectMessageChannel(user, async () => {
                await changeMessageBox(`@${user}`)
            })
            el = document.querySelector(`[data-user-data="${encodeURIComponent(user)}"]`)
        }
        el.classList.add('notify')
        return;
    }
    let el = document.querySelector(`[data-channel-data="${encodeURIComponent(channel)}"]`)
    if (!el) return
    el.classList.add('notify')
}
export function changeMainPanel(template) {
    const mainPanel = document.getElementById('mainPanel');
    if (mainPanel.dataset.name === template.id) return;
    mainPanel.dataset.name = template.id
    const id = template.id
    template = template.content.cloneNode(true);
    mainPanel.innerHTML = '';
    mainPanel.appendChild(template);
    console.log(Object.keys(events).includes(template.id) && typeof(events[template.id]) == 'function', Object.keys(events).includes())
    if (Object.keys(events).includes(id.slice(2)) && typeof(events[id.slice(2)]) == 'function') {
        events[id.slice(2)]();
    }
}

export function renderChannelHistory() {
    const history = messagesLib.getChannelHistory();
    if (history == null) return
    for (const [channel, status] of Object.entries(history)) {
        if (status === false) continue;
        if (channel.startsWith('@')) {
            console.log('channel history', `[data-user-data="${encodeURIComponent(channel.replace('@', ''))}"]`)
            let el = document.querySelector(`[data-user-data="${encodeURIComponent(channel.replace('@', ''))}"]`)
            if (el) continue;
            messagesLib.newDirectMessageChannel(channel.replace('@', ''), async () => {
                await changeMessageBox(channel)
            })
        } else {
            let el = document.querySelector(`[data-channel-data="${encodeURIComponent(channel)}"]`)
            if (el) continue;
            messagesLib.newChannel(channel, async () => {
                await changeMessageBox(channel)
            })
        }
    }
}


export function createFriendRanking(user) {
    if (document.querySelector(`[data-friend-data="${encodeURIComponent(`@${user}`)}"]`) !==null) {
        undoAllActiveChannels();
        document.querySelector(`[data-friend-data="${encodeURIComponent(user)}"]`).classList.add('active');
        return;
    }

    const channelRanking = document.querySelector('#t-friendRanking').content.cloneNode(true);
    channelRanking.querySelector('span').innerText = user;
    
    channelRanking.querySelector('.message-user').onclick = () => {
        changeMessageBox(`@${user}`)
    }

    channelRanking.querySelector('img').src = `/pfp/${user}`

    console.log(channelRanking);
    document.querySelector('#friendsList').appendChild(channelRanking);

    const list = document.querySelectorAll('#friendsList > .friendRanking');
    list[list.length-1].dataset.friendData = encodeURIComponent(user);
    list[list.length-1].addEventListener('mouseenter', (e) => {
        list[list.length-1].querySelector('.message-user').style.opacity = 1
    });
    list[list.length-1].addEventListener('mouseleave', (e) => {
        list[list.length-1].querySelector('.message-user').style.opacity = 0;
    });
    console.log(list[list.length-1]);
}