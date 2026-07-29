import { changeMessageBox } from "./chats.js";
import { addUnread } from "./db.js";
import { newDirectMessageChannel } from "./messageLib.js";
import { getUserFromChannel } from "./utils.js";

export function updateEncryptedInfo(message) {
    document.getElementById('encryption-status').innerText = message;
}

export async function createNotificationBadge(channel) {
    addUnread(channel);
    if (channel.startsWith('@')) {
        const user = getUserFromChannel(channel);
        console.log(`notification from ${user}`, channel)
        let el = document.querySelector(`[data-user-data="${encodeURIComponent(user)}"]`)
        if (!el) {
            await newDirectMessageChannel(user, async () => {
                await changeMessageBox(`@${user}`)
            })
        }
        el = document.querySelector(`[data-user-data="${encodeURIComponent(user)}"]`)
        el.classList.add('notify')
        return;
    }
    let el = document.querySelector(`[data-channel-data="${encodeURIComponent(channel)}"]`)
    if (!el) return
    el.classList.add('notify')
}