function main(socket) {
    socket.on('key_exchange', async (data, callback) => {
        const requestedKey = await db.getKey(data['channel']);
        const key = await emitAsync(socket,'public_key_request', {user: data['user']})
        const keyBuffer = Uint8Array.from(atob(key), c => c.charCodeAt(0));
        const publicKey = await crypto.subtle.importKey('spki', keyBuffer, {name: 'RSA-OAEP', hash: 'SHA-256'}, true, ['wrapKey']);
        const wrappedKey = await crypto.subtle.wrapKey('raw', requestedKey, publicKey, {name: 'RSA-OAEP'});
        console.log(callback)
        socket.emit('request_key_complete', {user: data['user'], payload: btoa(String.fromCharCode(...new Uint8Array(wrappedKey)))});
    });    
    
    socket.on('request_key_complete', async (key_) => {
        const keyBuffer = Uint8Array.from(atob(key_), c => c.charCodeAt(0)).buffer;
        const privKey = await db.retrievePrivateKey();
        key_ = await window.crypto.subtle.unwrapKey('raw', keyBuffer, privKey, {name: 'RSA-OAEP'}, {name: 'AES-GCM', length: 256}, true, ['encrypt', 'decrypt'])
        keySearching = false;
        db.saveKey(channel, key_);
        socket.emit('keyupdate', {channel});
        key=key_;
        updateEncryptedInfo('end-to-end encrypted (AES-GCM)')
    });
    
    socket.on('typing', async (data) => {
        const indicator = document.getElementById('typing-indicator');
        if (data.length === 0) {
            indicator.style.display = 'none';
            return; 
        } 
        
        indicator.style.display = 'block';
        const span = indicator.querySelector('.user');
        span.innerText = data.join(', ');
    })
    
    socket.on('new_message', async (message) => {
        message[Object.keys(message)[0]].content = new TextDecoder().decode(await cryptoAPI.decryptMessage(message[Object.keys(message)[0]].content, message[Object.keys(message)[0]].iv, key))
        await messagesLib.renderMessages(message, false, channel, socket); 
        const messages = document.getElementById('messages');
        await db.saveMessages(message, channel);
        
        messages.scrollTop = messages.scrollHeight;
    });
    
    socket.on('dm', async (message) => {
        console.log(message)
        const obj = message[Object.keys(message)[0]];
        const privKey = await db.retrievePrivateKey();
        obj.content = new TextDecoder().decode(await RSA.receiveMessage(obj.content, privKey))
        if (channel === getDMChannelName(obj['user'])){
            await messagesLib.renderMessages(message, false, channel, socket); 
        }
        await db.saveMessages(message, `${channel}`);
        
        const messages = document.getElementById('messages');
        messages.scrollTop = messages.scrollHeight;
    });
    
    socket.on('message_reacted', (data) => {
        console.log(data)
        messagesLib.react(data['id'], channel, data['reaction'], data['user'], data['action'], socket);
        db.updateReactions(data['id'], data['reaction'], data['user'], channel)
    })
    
    socket.on('direct_message', async (data) => {
        const privKey = await db.retrievePrivateKey();
        if (privKey === null) {alert('NOOOO TRUMP'); return;}
        const decrypted = await RSA.receiveMessage(data, privKey);
        alert(new TextDecoder().decode(decrypted));
    })
}