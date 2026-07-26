# Cicadas

*A privacy-focused, self-hosted alternative to Discord.*

Cicadas is a small, self-hosted chat app built for people who'd rather run their own server than trust someone else's.

---

## Part where I convince you to use it

- **End-to-end encrypted.** DMs use [RSA](https://en.wikipedia.org/wiki/Optimal_asymmetric_encryption_padding), group channels use [AES-GCM](https://en.wikipedia.org/wiki/Galois/Counter_Mode). The server never sees your messages.
- **No message storage on the server.** Messages live on your device (IndexedDB), not in the server.
- **Self-hosted.** Run it on a spare laptop, a Raspberry Pi, whatever you've got lying around.
- **Lightweight.** Flask-SocketIO backend, vanilla JS frontend.

---

## Features

- Hybrid AES/RSA end-to-end encryption for DMs and group channels
- Encrypted image transfer
- User profiles: pronouns, join date, status, custom avatars
- Web push notifications (from message notifications to key requests)
- Offline message queueing
- Twemoji!
- Mobile-friendly, collapsible sidebar
- Fully themeable via CSS custom properties

---

## Self-Hosting

### Requirements
- Python 3.11+ (note: eventlet has known issues on 3.13)
- A machine that can stay on — a Raspberry Pi works great
- A reverse proxy for HTTPS (Caddy recommended — it handles certs automatically)

### Quick Start

```bash
git clone https://github.com/yourusername/cicadas.git
cd cicadas
pip install -r requirements.txt
python app.py
```

By default it'll run locally on [port 443](https://www.google.com/search?q=port+443). For real use, put it behind a reverse proxy with TLS — see [Deployment](#deployment) below.

### Deployment

Cicadas is designed to run happily on something as small as a Raspberry Pi.

1. Set up [Caddy](https://caddyserver.com/) as a reverse proxy for automatic HTTPS
2. Run Cicadas as a `systemd` service so it survives reboots
3. (Optional) Configure VAPID keys for web push notifications — needed for key delivery requests to reach offline users

---

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Flask, Flask-SocketIO |
| Frontend | Vanilla JS, Web Crypto API |
| Storage | IndexedDB (client), no server-side message storage |
| Encryption | RSA (DMs), AES-GCM (channels) 
---

## Roadmap

A `todo.txt` and `done.txt` is available in the repo's files.

---