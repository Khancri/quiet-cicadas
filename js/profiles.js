function emitAsync(socket, event, data) {
  return new Promise((resolve) => {
    socket.emit(event, data, resolve)
  })
}

export async function showProfileModal(username, clickEvent, position, socket) {
    const data = await emitAsync(socket, 'view-profile', {user: username})
    console.log(data);
    const prof = document.getElementById('profile');
    prof.style.top = `${position.y}px`
    prof.style.left = `${position.x}px`
    prof.querySelector('#modal-username').style.textTransform = 'capitalize';
    prof.querySelector('#modal-username').innerText = data.displayName;
    prof.querySelector('.handle').innerText = username;
    const valid = await pfpValid(username)
    const glowWrap = prof.querySelector('.pfp-glow-wrap');
    const oldAvatar = glowWrap.querySelector('.ascii-avatar');
    if (oldAvatar) oldAvatar.remove();
    if (!valid[0]) {
        glowWrap.appendChild(valid[1])
        prof.querySelector('.modal-pfp').style.display = 'none';
        glowWrap.style.removeProperty('--glow-pfp');
    } else {
        prof.querySelector('.modal-pfp').src = `/pfp/${username}?q=${encodeURIComponent(new Date().getTime())}`
        prof.querySelector('.modal-pfp').style.display = 'block';
        glowWrap.style.setProperty('--glow-pfp', `url(/pfp/${username})`);
    }
        
    prof.style.display = 'flex';
    console.log(Object.keys(data).includes('pronouns'))
    if (Object.keys(data).includes('pronouns')) {
        prof.querySelector('.pronouns').style.display = 'block';
        prof.querySelector('.pronouns').innerText = data.pronouns;
    } else {
        prof.querySelector('.pronouns').style.display = 'none';
    }
    if (Object.keys(data).includes('bio')) {
        prof.querySelector('.bio').style.display = 'block';
        prof.querySelector('.bio').innerText = data.bio;
    } else {
        prof.querySelector('.bio').style.display = 'none';
    }
    if (Object.keys(data).includes('dateCreated')) {
        prof.querySelector('.date-created').style.display = 'flex';
        prof.querySelector('.date-created .date-created-info').innerText = new Date(data.dateCreated).toLocaleDateString();
    } else {
        prof.querySelector('.date-created').style.display = 'none';
    }
}

const POOL = ["#","@","%","&","*","+","=","~","^","?","!","$","<",">","|","/"];
const PALETTE = ["#8fae7e","#c9a267","#7e9e8f","#b8896a","#94a878","#a67c52"];

async function generateAvatar(username) {
const bytes = new Uint8Array(
await crypto.subtle.digest("SHA-256", new TextEncoder().encode(username.toLowerCase().trim()))
);
const grid = document.createElement("div");
grid.className = "ascii-avatar";

for (let i = 0; i < 16; i++) {
  const cell = document.createElement("div");
  cell.textContent = POOL[bytes[i] % POOL.length];
  cell.style.color = PALETTE[bytes[i + 16] % PALETTE.length];
  grid.appendChild(cell);
}

return grid;
}

export async function pfpValid(username) {
    const res = await fetch('/pfp/'+username);
    if (!res.ok) {
        return [false, await generateAvatar(username)];
    }
    return [true]
}


export async function generateAvatarCanvas(username, size = 200) {
    const bytes = new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(username.toLowerCase().trim()))
    );

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#141814';
    ctx.fillRect(0, 0, size, size);

    const cell = size / 4;
    ctx.font = `${cell * 0.6}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fontWeight = 'bold';

    for (let i = 0; i < 16; i++) {
        const row = Math.floor(i / 4);
        const col = i % 4;
        ctx.fillStyle = PALETTE[bytes[i + 16] % PALETTE.length];
        ctx.fillText(POOL[bytes[i] % POOL.length], col * cell + cell / 2, row * cell + cell / 2);
    }

    return canvas;
}