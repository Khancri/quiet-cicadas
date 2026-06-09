var username;
var password;
document.getElementById('username-submit').onclick = async () => {
    username = document.getElementById('username-input').value;
    const exists = await (await fetch(`/profile/exists/${encodeURIComponent(username)}`)).json()
    console.log(exists.ok);
    if (exists.ok == true) {
        document.getElementById('username-input').style.border = 'solid darkred 1px';
        return;
    }
    
    document.getElementById('username-slide').classList.add('dissolve-slide-out')
    document.getElementById('password-slide').classList.add('dissolve-slide-in')
};

document.getElementById('password-submit').onclick = async () => {
    password = document.getElementById('password-input').value;
    signUp()
}

async function signUp() {

    
    
    const done = await fetch(`/profile`, {method: 'POST', headers: {
        'Content-Type': 'application/json' // Tell the server you are sending JSON
      },
      body: JSON.stringify({'username': username, 'password': password})});
    if (done.status == 204) {
        alert('registered!');
        window.location.href = '/chat';
    }
}