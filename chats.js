const daata = {
    'uuid': {
        date: '2026-06-09T11:11:40.152Z',
        content: 'I like big butts and I cannot lie',
        user: 'khancri',
        reactions: {
            '🎉': ['khancri', 'l.', 'giitar_ruff'],
            '⛷': ['khancri']
        }
    },
    'uuid2': {
        date: '2026-06-09T11:11:53.518Z',
        content: 'I do not like big butts and I do not lie',
        user: 'giitar_ruff'
    }
}
console.log(new Date().toUTCString());
function renderMessages(data) {
    const div = document.createElement('div');
    div.classList.add('messages');
    for (const [key, value] of Object.entries(data)) {
        const message = document.createElement('div');
        message.classList.add('message');
        
        const pfp = document.createElement('div');
        pfp.classList.add('avatar');
        message.appendChild(pfp);

        const content = document.createElement('div');
        content.classList.add('content');
        message.appendChild(content);

        const metadata = document.createElement('div');
        metadata.classList.add('metadata');
        content.appendChild(metadata);

        const usernameEl = document.createElement('b');
        usernameEl.classList.add('username'); usernameEl.innerText = value.user;
        const dataEl = document.createElement('span');
        const date = new Date(value.date);
        console.log(date.valueOf());
        dataEl.classList.add('date'); dataEl.innerText =  date.toLocaleString();
        metadata.appendChild(usernameEl); metadata.appendChild(dataEl);

        const messageContent = document.createElement('span');
        messageContent.classList.add('messageContent'); messageContent.innerText = value.content;

        content.appendChild(messageContent);
        div.appendChild(message);
    }
    document.body.appendChild(div);
}
document.addEventListener('DOMContentLoaded', () => {

    renderMessages(daata);
})