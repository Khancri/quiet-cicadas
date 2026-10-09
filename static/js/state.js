// state.js
export let channel = null;
export let key = null;
export let keySearching = false;
export let selectedMessageID = null;
export let pendingAttachments = null;

export function setChannel(c) { channel = c; }
export function setKey(k) { key = k; }
export function setKeySearching(v) { keySearching = v; }
export function setSelectedMessageID(id) { selectedMessageID = id; }
export function setPendingAttachments(a) { pendingAttachments = a; }
