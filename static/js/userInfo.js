import * as db from './db.js'
function getUsername() {
    return localStorage.getItem('username');
}

function updateInfo(username) {
    localStorage.setItem('username', username);
}

export {getUsername, updateInfo}