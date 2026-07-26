# import eventlet
# eventlet.monkey_patch() 
from pywebpush import webpush, WebPushException
from flask import Flask, jsonify, request, send_from_directory, session, send_file, redirect, abort
from datetime import datetime
from flask_cors import CORS
import flask_socketio
import hashlib
import base64
from flask_socketio import join_room, leave_room
import uuid
import emoji
from secrets import token_urlsafe
import bcrypt
import json; import os;
PROFILE_FILE = 'profiles.json'

app = Flask(__name__, static_folder='.')
socketio = flask_socketio.SocketIO(app, cors_allowed_origins="*")
app.secret_key = 'R5m9SAXRxLwERafXLj5hqW4qru98NhWz'
CORS(app)

tokens = {}
user_sockets = {}  # username → socket id
rooms = {}

os.makedirs('pfps', exist_ok=True)
os.makedirs('data', exist_ok=True)
os.makedirs('data/attachments', exist_ok=True)
os.makedirs('data/bin', exist_ok=True)


#region Utils
def getChannel(channel: str, username: str):
    if channel.startswith('@'):
        channel = channel[1:]
        if channel > username:
            return f'@{username}-{channel}'
        else:
            return  f'@{channel}-{username}'
    return channel

def load(file: str):
    file = 'data/' + file; file = file.replace('//', '/')
    if not os.path.exists(file):
        return {}
    with open(file) as f:
        return json.load(f)

def save(file, todos):
    file = 'data/' + file; file = file.replace('//', '/')
    with open(file, 'w') as f:
        json.dump(todos, f, indent=4)

def save_attachment(data):
    path = f'data/attachments/{data['id']}'
    with open(path, 'wb') as f:
        f.write(data['content'])
    meta = load('attachments.json')
    meta[data['id']] = {
        'pending': data['users'],
        'fileName': data['fileName'],
        'mime_type': data['mimeType'],
        'iv': data['iv']
    }
    if 'key' in data.keys():
        print(data['key'])
        meta[data['id']]['key'] = data['key']
    print(meta[data['id']])
    save('attachments.json', meta)

def claim_attachment(id, username):
    meta = load('attachments.json')
    if id not in meta or username not in meta[id]['pending']:
        return None
    path = f'data/attachments/{id}'
    with open(path, 'rb') as f:
        data = f.read()
    meta[id]['pending'].remove(username)
    if not meta[id]['pending']:
        os.remove(path)
        del meta[id]
    save('attachments.json', meta)
    return data

def saveToCache(type, data, person, id, channel):
    if type == 'reaction':
        store = load(f'store_{person}.json')
        if 'reactions' not in store.keys():
            store['reactions'] = {}
        data['channel'] = channel
        store['reactions'][id] = data
        save(f'store_{person}.json', store)
        return
    if type == 'msg':
        iv: bytes = data['iv']
        ivHash = hashlib.sha1(iv).hexdigest()
        data['iv'] = ivHash
        with open(f'data/bin/{ivHash}', 'wb+') as f:
            f.write(iv)
            f.close()
    content: bytes = data['content']
    
    contentHash = hashlib.sha256(content).hexdigest()
    
    with open(f'data/bin/{contentHash}', 'wb+') as f:
        f.write(content)
        f.close()
    
    store = load(f'store_{person}.json')
    data['content'] = contentHash
    data['channel'] = channel
    store[id] = data
    save(f'store_{person}.json', store)
        

def loadWholeCache(person):
    store = load(f'store_{person}.json')
    if store == {}: return {}
    end = {}
    for key, value in store.items():
        iv_bytes = None
        if 'iv' in value.keys():
            iv_path = f"data/bin/{value['iv']}"
            with open(iv_path, 'rb') as f:
                iv_bytes = f.read()
            os.remove(iv_path)
        content_path = f"data/bin/{value['content']}"

        with open(content_path, 'rb') as f:
            content_bytes = f.read()

        os.remove(content_path)

        end[key] = {**value, 'iv': iv_bytes, 'content': content_bytes}
    os.remove(f'data/store_{person}.json')
    return end


#endregion

#region HTML Endpoints
@app.route('/chat')
def chat():
    if not 'username' in session.keys():
        return abort(403);
    return send_from_directory('html', 'chat.html')

@app.route('/')
def main():
    if 'username' in session.keys():
        return redirect('/chat')
    return send_from_directory('html', 'client.html')
#endregion

@app.route('/file/<path:name>')
def get_file(name):
    folders = name.split('/')
    print(folders)
    if len(folders) == 1:
        return send_from_directory('.', folders[0])
    return send_from_directory(f'./{'/'.join(folders[:-1])}', folders[-1])

@app.route('/pfp/<string:username>')
def get_pfp(username):
    path = f'pfps/{username}'
    if os.path.exists(path):
        return send_file(path);
    return '', 404

@app.route('/pfp', methods=['POST'])
def upload_pfp():
    file = request.files['pfp']
    os.makedirs('pfps', exist_ok=True)
    file.save(f'pfps/{session['username']}')
    return '', 204

@app.route('/api/upload', methods=['POST'])
def upload_file():
    file = request.files['file']
    key = None
    if 'key' in request.form.keys():
        key = request.form['key']
    iv = request.form['iv']
    mime_type = request.form['mimeType']
    filename = request.form['fileName']
    channel:str = request.form['channel']
    if channel.startswith('@'):
        users = [channel.replace('@', '').replace('-', '').replace(session['username'], '')]
    else:
        users = load('keys.json')[channel]['users']
        users.pop(users.index(session['username']))
    content = file.read()
    hash = hashlib.sha256(content).hexdigest()
    attachmentData = {
        'content': content,
        'users': users,
        'id': hash,
        'fileName': filename,
        'mimeType': mime_type,
        'iv': iv
    }
    if key != None:
        print(key)
        attachmentData['key'] = key
    save_attachment(attachmentData)
    print(f'iv is {iv}')

    return jsonify({'id': hash})

@app.route('/api/attachment/<string:hash>')
def get_attachment(hash):
    data = claim_attachment(hash, session['username'])
    if data is None:
        return '', 404
    return data, 200, {'Content-Type': 'application/octet-stream'}

@app.route('/api/attachment-metadata/<string:hash>')
def get_attachment_metadata(hash):
    file = load('attachments.json')
    if hash in file.keys():
        return jsonify(file[hash]), 200
    return '', 404

@app.route('/me')
def me():
    if 'username' not in session:
        return jsonify({'ok': False})
    return jsonify({'username': session['username']})

VAPID_PRIVATE_KEY = "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQggBwlZDnZ2/91ru+/nTfm4TNYGzud9hpmc+zy110ET6mhRANCAARR59e12eymk1nCl1lJmzNt90xdhv4wXCxORL65jgFY55MX6Q/0bDlo247I2mSs+HYG3lhD0jg2UU3w2T9sfH39"
VAPID_CLAIMS = {
    "sub": "mailto:joeykhan0106@gmail.com"
}

@app.route('/login', methods=['POST'])
def login():
    info = request.json
    username = info['username']; password = info['password'];
    oldPassword = load('profiles.json')[username]['password']
    if (bcrypt.checkpw(password.encode('utf-8'), oldPassword.encode())):
        session['username'] = username
        return jsonify({'ok': True})
    return jsonify({'ok': False})

def send_push(username, title, body, url="/"):
    if not username in load('subscriptions.json').keys():
        return
    subscription_info = load('subscriptions.json')[username]
    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps({
                "title": title,
                "body": body,
                "url": url,
            }),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS
        )
        print('hi')
    except WebPushException as e:
        print("push failed:", repr(e))

def save_subscription(handle, data):
    meow = load('subscriptions.json')
    meow[handle] = data
    save('subscriptions.json', meow)

@app.route('/api/notificationKey')
def notification_key():
    der_key = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEUefXtdnsppNZwpdZSZszbfdMXYb+MFwsTkS+uY4BWOeTF+kP9Gw5aNuOyNpkrPh2Bt5YQ9I4NlFN8Nk/bHx9/Q=='
    padded = der_key + '=' * (-len(der_key) % 4)
    der_bytes = base64.urlsafe_b64decode(padded)

    raw_point = der_bytes[-65:]  # strip DER header, keep raw point

    raw_b64url = base64.urlsafe_b64encode(raw_point).rstrip(b'=').decode()
    print(raw_b64url)
    return jsonify({'key': raw_b64url})

@app.route('/api/subscribe', methods=['POST'])
def subscribe():
    # return redirect('https://scrollx.org')
    sub_data = request.get_json()
    user_id = session.get('username')  # however you track the user
        
    # store sub_data as json, keyed to user_id
    save_subscription(user_id, sub_data)
    
    return '', 201

#region ErrorHandler
@app.errorhandler(403)
def forbidden(e):
    if request.accept_mimetypes.accept_html and not request.accept_mimetypes.accept_json:
        return redirect('/403')
    return '', 403

@app.errorhandler(404)
def not_found(e):
    if request.accept_mimetypes.accept_html and not request.accept_mimetypes.accept_json:
        return redirect('/404')
    return '', 404

@app.errorhandler(401)
def unauthorized(e):
    if request.accept_mimetypes.accept_html and not request.accept_mimetypes.accept_json:
        return redirect('/401')
    return '', 401    

@app.route('/404')
def route404():
    return send_from_directory('html', '404.html')

@app.route('/403')
def route403():
    return send_from_directory('html', '403.html')

@app.route('/401')
def route401():
    return send_from_directory('html', '401.html')
#endregion
@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return '', 204

@app.route('/delete-account')
def delete_account():
    profiles = load('profiles.json')
    del profiles[session['username']]
    save('profiles.json', profiles)
    session.clear()
    return '', 200

@app.route('/signup', methods=['POST'])
def signup():
    info = request.json
    print(info)
    username = info['username']
    password = info['password']

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
    key = info['publicKey']
    print(key)
    profileObj = {'username': username, 'password': hashed.decode(), 'key': key, 'displayName': username, 'dateCreated': datetime.now().isoformat()}
    file = load('profiles.json')
    file[username] = profileObj
    save('profiles.json' , file)
    session['username'] = username
    return '', 204



@app.route('/profile/exists/<string:username>', methods=['GET'])
def exising_username(username: str):
    if username in load('profiles.json').keys():
        return jsonify({'ok': True})
    return jsonify({'ok': False})
    
@app.route('/profile/view/<string:userName>')
def view_profile(userName: str):
    file = load('profiles.json')
    if not file[userName]:
        return '', 404
    return jsonify(file[userName])

@socketio.on('connect')
def connectedUser():
    global user_sockets
    user_sockets[session['username']] = request.sid

@socketio.on('disconnect')
def disconnecteduser(socket):
    global user_sockets
    del user_sockets[session['username']]

@socketio.on('join')
def on_join(data):
    print(session['username'], data['room'])
    if data['room'].startswith('@'):
        join_room(data['room'])
        return
    join_room(data["room"])

@socketio.on('message')
def post_message(data):
    print(data)
    hash = str(uuid.uuid4())
    message_obj = {
        'user': session['username'],
        'content': data['content'],  # will be arraybuffer
        'iv': data['iv'],
        'date': datetime.now().isoformat(),
    }
    if 'attachments' in data.keys():
        message_obj['attachmentId'] = data['attachments'][0]
    
    people = load('keys.json')[data['channel']]['users']
    for person in people:
        if person in user_sockets.keys():
            socketio.emit('new_message', {hash: message_obj}, to=user_sockets[person])
            continue
        saveToCache('msg', message_obj, person, hash, data['channel'])
        
@socketio.on('react')
def react(data): # {channel, id, reaction}
    if not emoji.is_emoji(data['reaction']):
        return '', 400
    print(data['channel'], data['id'])
    socketio.emit('message_reacted', {
        'id': data['id'],
        'reaction': data['reaction'],
        'user': session['username'],
        'action': 'add'
    }, to=data['channel'])
    print(data['channel'])

@socketio.on('fweh')
def fweh(data):
    print(data)
    socketio.emit('trump please save us', to=data['channel'])

@socketio.on('unreact')
def unreact(data):
    people = load('keys.json')[data['channel']]['users']
    reaction_obj = {
        'id': data['id'],
        'reaction': data['reaction'],
        'user': session['username'],
        'action': 'remove'
    }
    for person in people:
        if person in user_sockets.keys():
            socketio.emit('message_reacted', reaction_obj, to=user_sockets[person]);
            continue
        saveToCache('reaction', reaction_obj, person, hash, data['channel'])
    socketio.emit('message_reacted', {
        'id': data['id'],
        'reaction': data['reaction'],
        'user': session['username'],
        'action': 'remove'
    }, to=data['channel']);

@socketio.on('forgetkey')
def forget_key(data):
    file = load('keys.json')
    if not data['channel'] in file.keys(): return
    if not 'users' in file[data['channel']].keys(): return
    l: list = file[data['channel']]['users']
    file[data['channel']]['users'].pop(l.index(session['username']))
    save('keys.json', file)
    return {'ok': True}

@socketio.on('keyupdate')
def update_key_list(data):
    file = load('keys.json')
    if not data['channel'] in file.keys():
        file[data['channel']] = {}
    if not 'users' in file[data['channel']].keys():
        file[data['channel']]['users'] = [];
    if session['username'] in file[data['channel']]['users']: return
    file[data['channel']]['users'].append(session['username'])
    save('keys.json', file)

@socketio.on('cachegrab')
def cacheGrab(a):
    return loadWholeCache(session['username'])

@socketio.on('direct_message')
def handle_direct_message(data):
    to_username = data['to']
    payload = data['payload']
    # print(payload)
    to_sid = user_sockets.get(to_username)
    if to_sid:
        socketio.emit('direct_message', payload, to=to_sid)
        return

def findSID(handle):
    if handle in user_sockets.keys():
        return user_sockets[handle]
    return None

@socketio.on('dm')
def direct_message(data):
    to = data['to']
    payload = data['payload']
    hash = str(uuid.uuid4())
    date = datetime.now().isoformat()
    message_obj = {
        'user': session['username'],
        'content': payload,
        'date': date,
    }
    if 'attachments' in data.keys():
            message_obj['attachmentId'] = data['attachments'][0]
    to_sid = findSID(to)
    # print(message_obj)
    if to_sid == None:
        saveToCache('dmsg', message_obj, to, hash, getChannel(f'@{to}', session['username']))
        send_push(to, f'Message from {session['username']}', 'Tap to read notification')
    if to_sid:
        socketio.emit('dm', {hash: message_obj}, to=to_sid)
        print('hi' + hash)
    del message_obj['content']
    message_obj['hash'] = hash
    return message_obj

@socketio.on('public_key_request')
def key_request(data):
    user = data['user']
    if user in load('profiles.json').keys():
        return load('profiles.json')[user]['key']
    return None

@socketio.on('request_key')
def request_key(data): # data: user, channel
    print(data)
    if 'user' in data.keys():
        to_sid = user_sockets.get(data['user'], None)
        if to_sid == None: 
            print('no user man sorry')
        if to_sid:
            socketio.emit('key_exchange', {'channel': data['channel'], 'user': session['username']}, to=to_sid)
        

@socketio.on('request_key_complete')
def request_key_complete(data):
    to_sid = user_sockets.get(data['user'])
    if to_sid:
        socketio.emit('request_key_complete', data['payload'], to=to_sid)

@socketio.on('channel_users')
def get_users_with_key(data):
    file = load('keys.json')
    print(file)
    if file == {}:
        return {'list': None}
    if not data['channel'] in file.keys():
        return {'list': None}
    users: list  = file[data['channel']]['users'] 
    if users == None:
        return {'list': None}
    active = []
    for user in users:
        if user in user_sockets.keys():
            active.append(user)
    
    if len(list(active)) == 0:
        for user in users:
            current_token = token_urlsafe(24)
            tokens[current_token] = {'hit': False, 'type': 'keypass', 'metadata': {'user': session['username'], 'channel': data['channel']}}
            send_push(user, 'help out a fellow cicada?', 'share your key so they can chat!', f'/keypass?t={current_token}')

    return {'list': list(active)}
typing = {}

@app.route('/keypass')
def keypass():
    return send_from_directory('html', 'keypass.html')

@app.route('/api/token/<string:token>')
def process_token(token):
    if (not token in tokens.keys()) or (tokens[token]['hit'] == True):
        return '', 403
    res = jsonify({'channel': tokens[token]['metadata']['channel'], 'user': tokens[token]['metadata']['user']})
    del tokens[token]
    return res

@socketio.on('typing')
def vhange_typing(data):
    global typing
    channel = getChannel(data['channel'], session['username'])
    if data['prevEntered']:
        if not channel in typing.keys() or not session['username'] in typing[channel]:
            return
        typing[channel].pop(typing[channel].index(session['username']))
        socketio.emit('typing', typing[channel])
        return
    if not channel in typing.keys():
        typing[channel] = []
    if session['username'] in typing[channel]:
        return;
    typing[channel].append(session['username'])
    socketio.emit('typing', typing[channel], to=channel)

@socketio.on('rsa-key-regen')
def updatePublicKey(data):
    publicKey = data['publicKey']
    dw = load('profiles.json')
    dw[session['username']]['key'] = publicKey
    save('profiles.json', dw)

@socketio.on('profile-update')
def updateProfile(data):
    profiles = load('profiles.json')
    profile = profiles[session['username']]
    if 'bio' in data.keys():
        profile['bio'] = data['bio']
    if 'pronouns' in data.keys():
        profile['pronouns'] = data['pronouns']
    if 'displayName' in data.keys():
        profile['displayName'] = data['displayName']
    profiles[session['username']] = profile
    save('profiles.json', profiles)

@socketio.on('view-profile')
def viewProfile(data):
    profile = load('profiles.json')[data['user']]
    del profile['key']; del profile['password']; del profile['username']
    return profile  
        

if __name__ == '__main__':  
    socketio.run(app, host  ='0.0.0.0', port=443, ssl_context=('cert.pem', 'key.pem'))