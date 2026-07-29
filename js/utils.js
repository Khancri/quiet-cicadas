import { getUsername } from "./userInfo.js";

export function emitAsync(socket, event, data) {
  return new Promise((resolve) => {
    socket.emit(event, data, resolve)
  })
}

export function getUserFromChannel(channel) {
    const list = channel.replace('@', '').split('-')
        list.splice(list.indexOf(getUsername()), 1); const user = list[0];
        return user;
}


export function getDMChannelName(user) {
    if (user.localeCompare(getUsername()) < 0) {
        return `@${user}-${getUsername()}`
    } else {
        return`@${getUsername()}-${user}`
    }
}
