var username;
var password;
document.getElementById('username-submit').onclick = async () => {
    username = document.getElementById('username-input').value;
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
        window.location.href = '/chat';
    }
}

async function signUp() {
    const done = await fetch(`/signup`, {method: 'POST', headers: {
        'Content-Type': 'application/json' // Tell the server you are sending JSON
      },
      body: JSON.stringify({'username': username, 'password': password})});
    if (done.status == 204) {
        alert('registered!');
        window.location.href = '/chat';
    }
}