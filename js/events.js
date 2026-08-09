import * as db from './db.js'
import * as states from './state.js'
import * as messagesLib from './messageLib.js'
import * as chats from './chats.js'
import { getUsername } from './userInfo.js';
import { open } from './emojiPicker.js';
import {socket} from './chats.js';
import { emitAsync, getDMChannelName, getUserFromChannel } from './utils.js';
import { changeMainPanel, createFriendRanking, createFriendRequest } from './ui.js';
export function linkDefaultEventListeners() {
    document.getElementById('logout').onclick = async () => {
        const thing = await fetch('logout', {method: 'POST'});
        await db.obliterate();
        alert('everything obliterated!')
    }
    document.querySelector('.overlay-label').onclick = () => {
        document.getElementById('pfp-file-input').click();
    }
    document.getElementById('profile-update').onclick = async () => {
        const pronouns = document.getElementById('pronouns').value;
        const bio = document.getElementById('bio').value;
        const displayName = document.getElementById('display-name').value;

        document.getElementById('edit-profile').style.display = 'none';
        socket.emit('profile-update', {bio, pronouns, displayName});
    }
    document.getElementById('cancel-changes').onclick = () => {
        document.getElementById('edit-profile').style.display = 'none';
    }
    
    document.getElementById('customize-profile').onclick = async () => {
        const data = await emitAsync(socket, 'view-profile', {user: getUsername()})
        document.getElementById('pronouns').value = data.pronouns ?? ''
        document.getElementById('bio').value = data.bio ?? ''
        document.getElementById('handle').value = getUsername();
        document.getElementById('display-name').value = data.displayName ?? getUsername();
        document.getElementById('edit-profile').hidden = false;
        document.querySelector('.pfp-edit-wrap img').src = '/pfp/'+getUsername();
    }

    
    document.getElementById('delete-account').onclick = async () => {
        const confirm = prompt('If you\'re SURE about this type in your username')
        if (confirm !== getUsername()) {
            return
        }
        const response = await fetch('/delete-account');
        if (!response.ok) {alert('something went wrong..?'); return;}
        await db.obliterate();

    }
    
    document.getElementById('change-pfp').onclick = async () => {
        document.getElementById('pfp-file-input').click();
    }

    document.getElementById('feedback').onclick = () => window.open('https://github.com/Khancri/quiet-cicadas/issues');

 

document.getElementById('current-user-username').onclick = async (e) => {
    e.stopPropagation();
    document.getElementById('account-dropdown').style.display = 'block';
    const listener = () => document.getElementById('account-dropdown').style.display = 'none';
    document.addEventListener('click', (e) => {
        if (e.target.closest('#account-dropdown')) return;
        listener();
        document.removeEventListener('click', listener)
    })
};
document.getElementById('add-new-dm').addEventListener('click', async () => {
    states.setChannel( prompt('what channel'))
    const channelname = states.channel;
    messagesLib.newChannel(channelname, async () => {
        await chats.changeMessageBox(channelname);
    });
    document.getElementById('channel-name').innerText = `#${states.channel}`
    await chats.regetKey();
    document.getElementById('messages').innerHTML = '';

    chats.getMessages1();
    socket.emit("join", { room: states.channel });
    console.log('hi?');
});


document.getElementById('direct-message').onclick = async () => {
    const user = prompt('who do you want to dm?')
    await messagesLib.newDirectMessageChannel(user, async () => {
            await chats.changeMessageBox(`@${user}`);
        });
    document.getElementById('channel-name').innerText = `@${user}`
    states.setChannel( getDMChannelName(user));
    console.log(states.channel);
    await chats.regetKey();
    document.getElementById('messages').innerHTML = '';
    
    chats.getMessages1();
}

document.querySelector('.header .dot.g').onclick = async () => {
    messagesLib.undoAllActiveChannels();
    changeMainPanel(document.getElementById('t-friendsList'), true);
    const entries = await emitAsync(socket, 'view_friends')
    console.log(entries)
    for (const friend of entries.friends) {
        createFriendRanking(friend);
    }
    for (const request of entries.requests) {
        createFriendRequest(request);
    }
}


document.addEventListener('keydown', (e) => {
    if (messageInput === undefined) return;
    if (!(e.altKey || e.ctrlKey || e.shiftKey || e.key === 'Enter') && 
    document.activeElement !== messageInput && 
    document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        messageInput.focus();
        return;
    }
})

document.querySelector('.header .dot.r').onclick = () => window.close()

document.querySelector('.hamburger').onclick = () => {
    document.querySelector('.sidebar').style.transform = 'none';
}

document.querySelector('.sidebar-disable').onclick = () => {
    document.querySelector('.sidebar').style.transform = 'translateX(-100%)';
}


}

var messageInput = undefined;

export function chatBox() {
     messageInput = document.getElementById('message-input');
var timeout;
    document.getElementById('allow-notifications').onclick = async () => {
        console.log('notificatins')
        const permission = await Notification.requestPermission();
        if (permission === 'granted' || Notification.permission === 'granted') {
            subscribeToPush();
        } else {
            console.log('user said no lol');
        }
    }


    
messageInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        if (messageInput.value.trim() == '') return;
        if (states.channel.startsWith('@')) {
            const user = getUserFromChannel(states.channel);
            console.log(states.channel)
            const data = await chats.encryptOpts['dm'](messageInput.value.trim(), user, socket);
            console.log(data)
            const obj = {[data.hash]: {'date': data.date, content: messageInput.value.trim(), user: getUsername()}}
            if (data.attachmentId !== undefined) {
                obj[data.hash].attachmentId = data.attachmentId
            }
            await messagesLib.renderMessages(obj, false, `@${user}`, socket)
            await db.saveMessages(obj, states.channel)
        } else {
            await chats.encryptOpts['group'](messageInput.value.trim(), states.channel);
        }
        messageInput.value = ''; 
        // console.log('no no ')
    }
    if (e.key === 'Escape') {
        messageInput.blur();
        return;
    }
    if (e.altKey || e.ctrlKey || e.shiftKey || e.key === 'Tab' || e.key === 'Backspace') {
        return;
    }
    clearTimeout(timeout);
    timeout = setTimeout(() => {
        console.log('oh no');
        socket.emit('typing', {channel: states.channel, prevEntered: true})
    }, 1500);
    socket.emit('typing', {channel: states.channel, prevEntered: false});
});

document.querySelector('#emoji-picker-btn').addEventListener('click', () => {
    open(document.querySelector('#emoji-picker-btn'), {targetInput: messageInput})
})

document.querySelector('.emoji-context').addEventListener('click', () => {
    console.log(states.channel);
    open(document.querySelector('.emoji-context'), {id: states.selectedMessageID, socket: socket, channel: states.channel})
    // socket.emit('react', {id: states.selectedMessageID, reaction: prompt('emoji? '), channel: states.channel})
})


document.getElementById('attach-btn').onclick = () => {
    document.getElementById('attachment-input').click();
};

document.getElementById('attachment-input').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    states.setPendingAttachments(file);

    const preview = document.getElementById('attachment-preview');
    preview.hidden = false;
    preview.textContent = '';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = file.name;

    const removeSpan = document.createElement('span');
    removeSpan.className = 'remove';
    removeSpan.textContent = '✕';

    preview.append(nameSpan, removeSpan);
    preview.querySelector('.remove').onclick = () => {
        states.setPendingAttachments(null);
        preview.hidden = true;
        document.getElementById('attachment-input').value = '';
    };
};
}

export function friendsList() {
    messageInput = undefined;
    document.getElementById('friend-request-button').onclick = () => {
        socket.emit('friend_request', {action: 'add', user: document.getElementById('friend-request-field').value.trim()})
    }
}