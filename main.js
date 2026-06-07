var username;
document.getElementById('username-submit').onclick = async () => {
    username = document.getElementById('username-input').value;
    const exists = await (await fetch(`/profile/exists/${encodeURIComponent(username)}`)).json.ok
    if (exists === true) {
        document.getElementById('username-input').style.border = 'solid darkred 1px';
        return;
    }
    alert('done!');
    
    const done = await fetch(`/profile`, {method: 'POST', headers: {
        'Content-Type': 'application/json' // Tell the server you are sending JSON
      },
      body: JSON.stringify({'username': username})});
    if (done.status == 204) {
        alert('registered!');
    }
};