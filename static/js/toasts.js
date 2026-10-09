export function createToast(message, status = "INFO") {
    const toast = document.createElement('div');
    toast.className = 'toast';
    document.getElementById('toast-zone').appendChild(toast);
    toast.innerText = message;
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}
setTimeout(() => {
    createToast('hi')
}, 3000);
