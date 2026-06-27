import { savePrivateKey } from "./db.js";
import { createKey, encryptMessage, decryptMessage } from "./crypto-rsa.js";

var username;
var password;
var pfp;
document.getElementById('username-submit').onclick = async () => {
    username = document.getElementById('username-input').value;
    pfp = document.getElementById('pfp-input').files;
    const exists = await (await fetch(`/profile/exists/${encodeURIComponent(username)}`)).json()
    console.log(exists.ok);
    if (exists.ok == true) {
        alert('omg')
        document.getElementById('password-submit').onclick = async () => {
            password = document.getElementById('password-input').value;
            logIn()
        }
    } else {
        document.getElementById('password-submit').onclick = async () => {
            password = document.getElementById('password-input').value;
            signUp()
        }
    }
    
    document.getElementById('username-slide').classList.add('dissolve-slide-out')
    document.getElementById('password-slide').classList.add('dissolve-slide-in')
};

async function logIn() {
    const done = await fetch('/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({'username': username, 'password': password})});
    if (done.status !== 200) {
        alert("we don't know if the passwords correct the shit crashed on us");
        return;
    }
    const json = await done.json()
    if (json.ok === true) {
        alert('yahoo!');
    } else {
        alert('false');
        return;
    }
    const formData = new FormData();
    formData.append('pfp', pfp[0]);
    const pfpUpload = await fetch('/pfp', {method: 'POST', body: formData});
    if (pfpUpload.status == 204) {
        alert('uploaded!');
    }
    window.location.href = '/chat';
}

async function signUp() {
    const keys = await createKey();
    const key = await window.crypto.subtle.exportKey('spki', keys.publicKey )
    const b64 = btoa(String.fromCharCode(...new Uint8Array(key)))
    console.log(new TextDecoder().decode(key))
    await savePrivateKey(keys.privateKey)
    const done = await fetch(`/signup`, {method: 'POST', headers: {
        'Content-Type': 'application/json' // Tell the server you are sending JSON
      },
      body: JSON.stringify({'username': username, 'password': password, 'publicKey': b64})});
    if (done.status == 204) {
        alert('registered!');
    } else {
        alert('?? sum broke sorry bro');
        return;
    }
    const formData = new FormData();
    formData.append('pfp', pfp[0]);
    const pfpUpload = await fetch('/pfp', {method: 'POST', body: formData});
    if (pfpUpload.status == 204) {
        alert('uploaded!');
    }
    window.location.href = '/chat';
}