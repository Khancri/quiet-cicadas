import { changeMessageBox, socket } from "./chats.js";
import { addUnread } from "./db.js";
import * as events from './events.js';
import * as messagesLib from "./messageLib.js";
import { showProfileModal } from "./profiles.js";
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
export function changeMainPanel(template, clean = false) {
    const mainPanel = document.getElementById('mainPanel');
    if (mainPanel.dataset.name === template.id && clean === false) return;
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

export function createFriendRequest(user) {
    if (document.querySelector(`.friendRequest [data-friend-data="${encodeURIComponent(`@${user}`)}"]`) !==null) {
        return;
    }
    const friendRequestEl = document.querySelector('#t-friendRequest').content.cloneNode(true).childNodes[1]
    console.log(friendRequestEl)
    friendRequestEl.querySelector('span').innerText = user;

    friendRequestEl.querySelector('img').src = `/pfp/${user}`

    friendRequestEl.querySelector('button[data-action="accept"]').onclick = () => {
        socket.emit('friend_request', {user: user, action: 'accept'})
        friendRequestEl.remove();
        createFriendRanking(user)
    }
    friendRequestEl.querySelector('button[data-action="decline"]').onclick = () => {
        socket.emit('friend_request', {user: user, action: 'decline'})
    }
    friendRequestEl.onclick = (e) => showProfileModal(user, e, {x: e.pageX, y:e.pageY})
    friendRequestEl.dataset.friendData = encodeURIComponent(user);
    friendRequestEl.addEventListener('mouseenter', (e) => {
        friendRequestEl.querySelector('[data-action="accept"]').style.opacity = 1
        friendRequestEl.querySelector('[data-action="decline"]').style.opacity = 1
    });
    friendRequestEl.addEventListener('mouseleave', (e) => {
        friendRequestEl.querySelector('[data-action="accept"]').style.opacity = 0;
        friendRequestEl.querySelector('[data-action="decline"]').style.opacity = 0;
    });
    document.querySelector('#requests').appendChild(friendRequestEl);
    document.querySelector('#requests').hidden = false;
}

export function createFriendRanking(user) {
    if (document.querySelector(`.friendRanking [data-friend-data="${encodeURIComponent(`@${user}`)}"]`) !==null) {
        return;
    }

    const channelRanking = document.querySelector('#t-friendRanking').content.cloneNode(true).childNodes[1];
    channelRanking.querySelector('span').innerText = user;
    channelRanking.onclick = async (e) => {
        const { pageX: x, pageY: y } = e;
        e.stopPropagation();
        const prof = document.getElementById('profile')
        const clickEvent = (e) => {
            if (e.target.closest('#profile')) return;
            prof.style.display = 'none';
            document.removeEventListener('click', clickEvent);
        };
        await showProfileModal(user, clickEvent, {x, y})
        document.addEventListener('click', clickEvent);
    };
    
    channelRanking.querySelector('.message-user').onclick = () => {
        changeMessageBox(`@${user}`)
    }

    channelRanking.querySelector('img').src = `/pfp/${user}`
    
    channelRanking.dataset.friendData = encodeURIComponent(user);
    channelRanking.addEventListener('mouseenter', (e) => {
        channelRanking.querySelector('.message-user').style.opacity = 1
    });
    channelRanking.addEventListener('mouseleave', (e) => {
        channelRanking.querySelector('.message-user').style.opacity = 0;
    });
    console.log(channelRanking);
    document.querySelector('#friendsList').appendChild(channelRanking);
    document.querySelector('#friendsList').hidden = false;
}