const daata = {
    'uuid': {
        date: '2026-06-09T11:11:40.152Z',
        content: 'I like big butts and I cannot lie',
        user: 'khancri',
        reactions: {
            '🎉': ['khancri', 'l.', 'giitar_ruff'],
            '⛷': ['khancri']
        }
    }
}
function createMessage(data, id) {
    const message = document.createElement('div');
        message.classList.add('message');

        message.dataset.id = id;
        
        const pfp = document.createElement('div');
        pfp.classList.add('avatar');
        message.appendChild(pfp);
        pfp.style.backgroundImage = `url('/pfp/${data.user}')`;
        pfp.style.backgroundSize = 'cover';

        const content = document.createElement('div');
        content.classList.add('content');
        message.appendChild(content);

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
                const reactionEl = document.createElement('div'); reactionEl.className = 'reaction';
                reactionEl.innerHTML = `<span class="emoji">${emoji}</span>:<span class="counter">${array.length}</span>`
                reactionRow.appendChild(reactionEl);
            }
        }
        return message;

}
console.log(new Date().toUTCString());
function renderMessages(data) {
const sorted = Object.entries(data).sort((a, b) => new Date(a[1].date) - new Date(b[1].date));
    const div = document.getElementById('messages')
    for (const [key, value] of sorted) {
        const message = document.querySelector(`[data-id=\"${key}\"]`)
        if (message === null) {
            div.appendChild(createMessage(value, key));
        }
    }
    
}

document.addEventListener('DOMContentLoaded', () => {
    
const messageInput = document.getElementById('message-input');
messageInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        if (messageInput.value.trim() == '') return;
        const res = await fetch('/message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({message: messageInput.value.trim()})
        });
        messageInput.value = ''; 
    }
});
    checkUser();
    renderMessages(daata);
    getMessages();
});
async function checkUser() {
    const username = (await (await fetch('/me')).json()).username
    document.getElementById('current-user-username').innerText = username;
}
async function getMessages() {
    const data = await (await fetch('/messages')).json();
    renderMessages(data);
}
