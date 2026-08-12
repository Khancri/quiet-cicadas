import eventlet
eventlet.monkey_patch() 
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
import sqlite3

app = Flask(__name__, static_folder='.')
socketio = flask_socketio.SocketIO(app, cors_allowed_origins="*")
app.secret_key = 'R5m9SAXRxLwERafXLj5hqW4qru98NhWz'
CORS(app)

conn = sqlite3.connect('.db', check_same_thread=False)
curs = conn.cursor()

curs.executescript("""
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        username VARCHAR(30) UNIQUE,
        password TEXT,
        public_key TEXT,
        bio TEXT,
        pronouns VARCHAR(25),
        display_name VARCHAR(35),
        status VARCHAR(100)
    );

    CREATE TABLE IF NOT EXISTS channel_keys (
        channel_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        username VARCHAR(30),
        FOREIGN KEY (username) REFERENCES profiles(username)
    );

    CREATE TABLE IF NOT EXISTS cache (
        id TEXT,
        contents BLOB,
        iv BLOB,
        time TIMESTAMP,
        channel TEXT,
        sender VARCHAR(30),
        destination VARCHAR(30),
        type TEXT,
        metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS friend_request (
        sender VARCHAR(30),
        receiver VARCHAR(30),
        FOREIGN KEY (sender) REFERENCES profiles(username),
        FOREIGN KEY (receiver) REFERENCES profiles(username)
    );
    CREATE TABLE IF NOT EXISTS friends (
        person1 VARCHAR(30),
        person2 VARCHAR(30),
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (person1) REFERENCES profiles(username),
        FOREIGN KEY (person2) REFERENCES profiles(username)
    );
""")

tokens = {}
user_sockets = {}
rooms = {}

os.makedirs('./pfps/', exist_ok=True)
os.makedirs('./data/', exist_ok=True)
os.makedirs('./data/attachments/', exist_ok=True)
os.makedirs('./data/bin/', exist_ok=True)


#region Utils

def db_execute(query, params=(), fetch=None, commit=False):
    with sqlite3.connect('.db') as conn:
        conn.execute('PRAGMA foreign_keys = ON')
        curs = conn.cursor()
        curs.execute(query, params)
        if commit:
            conn.commit()
        if fetch == 'one':
            return curs.fetchone()
        if fetch == 'all':
            return curs.fetchall()

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
        print(data, id)
        data['channel'] = channel
        
        db_execute('INSERT INTO cache (id, contents, channel, sender, destination, type, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    (data['id'], data['reaction'].encode(), channel, data['user'], person, type, data['action']), commit=True)
        return
    if type == 'msg':
        db_execute('INSERT INTO cache (id, contents, iv, time, channel, sender, destination, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    (id, data['content'], data['iv'], data['date'], channel, data['user'], person, type), commit=True)
    else:
        db_execute('INSERT INTO cache (id, contents, time, sender, destination, type) VALUES (?, ?, ?, ?, ?, ?)',
                    (id, data['content'], data['date'], data['user'], person, type), commit=True)
        

def loadWholeCache(person):
    store = db_execute('SELECT * FROM cache WHERE destination = ?', (person,), fetch='all')
    if store == None:
        return {}
    
    print(store)

    cache = []

    for row in store:
        if row[7] == 'msg':
            cache.append({
                'id': row[0],
                'content': row[1],
                'iv': row[2],
                'date': row[3],
                'channel': row[4],
                'user': row[5],
            })
        if row[7] == 'dmsg':
            cache.append({
                'id': row[0],
                'content': row[1],
                'date': row[3],
                'user': row[5],
            })
        if row[7] == 'reaction':
            cache.append({
                'id': row[0],
                'content': row[1].decode(),
                'user': row[5],
                'channel': row[4],
                'action': row[-1]
            })
    print(cache)
    db_execute('DELETE FROM cache WHERE destination = ?', (person,), commit=True)
    return cache
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
    oldPassword = db_execute('SELECT password FROM profiles WHERE username = ?', (username,), fetch='one')
    if oldPassword == None:
        return jsonify({'ok': False})
    if (bcrypt.checkpw(password.encode('utf-8'), oldPassword[0].encode())):
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
    db_execute('DELETE FROM channel_keys WHERE username = ?', (session['username'],), commit=True)
    db_execute('DELETE FROM profiles WHERE username = ?', (session['username'],), commit=True)
    session.clear()
    return '', 200

@app.route('/signup', methods=['POST'])
def signup():
    info = request.json
    username = info['username']
    password = info['password']
    key = info['publicKey']

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())

    try:
        db_execute(
            'INSERT INTO profiles (username, password, display_name, public_key) VALUES (?, ?, ?, ?)',
            (username, hashed.decode(), username, key), commit=True
        )
    except sqlite3.IntegrityError:
        return {'error': 'username taken'}, 409

    session['username'] = username
    return '', 204



@app.route('/profile/exists/<string:username>', methods=['GET'])
def exising_username(username: str):
    exists = db_execute("SELECT 1 FROM profiles WHERE username = ?", (username,), fetch='one') is not None
    return jsonify({'ok': exists})
    
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
        'channel': data['channel']
    }
    if 'attachments' in data.keys():
        message_obj['attachmentId'] = data['attachments'][0]
    print(message_obj)
    people = db_execute('SELECT username FROM channel_keys WHERE name = ?', (data['channel'],), fetch='all')
    if people == None:
        raise LookupError('how is this possible')
    print(user_sockets)
    for person in people:
        if person[0] in user_sockets.keys():
            print(f'sent to {person}')
            socketio.emit('new_message', {hash: message_obj}, to=user_sockets[person[0]])
            continue
        saveToCache('msg', message_obj, person[0], hash, data['channel'])
        
@socketio.on('react')
def react(data): # {channel, id, reaction}
    if not emoji.is_emoji(data['reaction']):
        return '', 400
    reaction_obj = {
        'id': data['id'],
        'reaction': data['reaction'],
        'user': session['username'],
        'action': 'add',
        'channel': data['channel']
    }
    print(reaction_obj, data)
    people = db_execute('SELECT username FROM channel_keys WHERE name = ?', (data['channel'],), fetch='all')
    if people == None: return
    for person in people:
        if person[0] in user_sockets.keys():
            socketio.emit('message_reacted', reaction_obj, to=user_sockets[person[0]]);
            continue
        saveToCache('reaction', reaction_obj, person[0], hash, data['channel'])
    # socketio.emit('message_reacted', {
    #     'id': data['id'],
    #     'reaction': data['reaction'],
    #     'user': session['username'],
    #     'action': 'remove'
    # }, to=data['channel']);

@socketio.on('unreact')
def unreact(data):
    people = db_execute('SELECT username FROM channel_keys WHERE name = ?', (data['channel'],), fetch='all')
    if people == None: return
    reaction_obj = {
        'id': data['id'],
        'reaction': data['reaction'],
        'user': session['username'],
        'channel': data['channel'],
        'action': 'remove'
    }
    for person in people:
        if person[0] in user_sockets.keys():
            socketio.emit('message_reacted', reaction_obj, to=user_sockets[person[0]]);
            continue
        saveToCache('reaction', reaction_obj, person[0], hash, data['channel'])
    socketio.emit('message_reacted', {
        'id': data['id'],
        'reaction': data['reaction'],
        'user': session['username'],
        'action': 'remove'
    }, to=data['channel']);

@socketio.on('forgetkey')
def forget_key(data):
    channel = data['channel']
    db_execute('DELETE FROM channel_keys WHERE name = ? AND username = ?', 
                     (channel, session['username']), commit=True)

@socketio.on('keyupdate')
def update_key_list(data):
    channel = data['channel']
    db_execute('INSERT INTO channel_keys (name, username) VALUES (?, ?)', (channel, session['username']), commit=True)

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
    key = db_execute('SELECT public_key FROM profiles WHERE username = ?', (data['user'],), fetch='one')
    if key == None:
        return None
    return key[0]

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
    users = db_execute('SELECT username FROM channel_keys WHERE name = ?', (data['channel'],), fetch='all')
    if users == None:
        return {'list': None}
    active = []
    for user in users:
        if user[0] in user_sockets.keys():
            active.append(user[0])
    
    # if len(list(active)) == 0:
    #     for user in users:
    #         current_token = token_urlsafe(24)
    #         tokens[current_token] = {'hit': False, 'type': 'keypass', 'metadata': {'user': session['username'], 'channel': data['channel']}}
    #         send_push(user, 'help out a fellow cicada?', 'share your key so they can chat!', f'/keypass?t={current_token}')

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
    db_execute('UPDATE profiles SET public_key = ? WHERE username = ?', (publicKey, session['username']), commit=True)

@socketio.on('profile-update')
def updateProfile(data):
    if data == {}: return
    if 'bio' in data.keys():
        db_execute('UPDATE profiles SET bio = ? WHERE username = ?', (data['bio'], session['username']), commit=True)
    if 'pronouns' in data.keys():
        db_execute('UPDATE profiles SET pronouns = ? WHERE username = ?', (data['pronouns'], session['username']), commit=True)
    if 'displayName' in data.keys():
        db_execute('UPDATE profiles SET display_name = ? WHERE username = ?', (data['displayName'], session['username']), commit=True)

@socketio.on('view-profile')
def viewProfile(data):
    profile = db_execute('SELECT join_date, bio, pronouns, display_name, status FROM profiles WHERE username = ?', (data['user'],), fetch='one')
    if profile == None: return None
    returnVal = {'dateCreated': profile[0], 'pronouns': profile[2], 'bio': profile[1], 'displayName': profile[3], 'status': profile[4]}
    friend = db_execute('SELECT 1 FROM friends WHERE person1 = ? AND person2 = ?', (session['username'], data['user']), fetch='one') != None
    if friend:
        returnVal['friend'] = True
    return returnVal

@socketio.on('friend_request')
def friend_request(data):
    match data['action']:
        case 'add':
            if db_execute('SELECT 1 FROM friend_request WHERE sender = ? AND receiver = ?', (session['username'], data['user']), fetch='one') != None: return
            db_execute('INSERT INTO friend_request (sender, receiver) VALUES (?, ?)', (session['username'], data['user']), commit=True)
        case 'decline':
            db_execute('DELETE FROM friend_request WHERE sender = ? AND receiver = ?', (data['user'], session['username']), commit=True)
        case 'accept':
            db_execute('DELETE FROM friend_request WHERE sender = ? AND receiver = ?', (data['user'], session['username']), commit=True)
            db_execute('INSERT INTO friends (person1, person2) VALUES (?, ?)', (session['username'], data['user']), commit=True)
            db_execute('INSERT INTO friends (person1, person2) VALUES (?, ?)', (data['user'], session['username']), commit=True)
        case 'remove':
            db_execute('DELETE FROM friends WHERE person1 = ? AND person2 = ?', (session['username'], data['user']))
            db_execute('DELETE FROM friends WHERE person2 = ? AND person1 = ?', (session['username'], data['user']))

@socketio.on('view_friends')
def view_friends(none):
    friends = db_execute('SELECT person2 FROM friends WHERE person1 = ?', (session['username'],), fetch='all')
    if friends == None:
        friends = []
    requests = db_execute('SELECT sender FROM friend_request WHERE receiver = ?', (session['username'],), fetch='all')
    if requests == None:
            requests = []
    returnVal = {'friends': [], 'requests': []}
    for friend in friends:
        returnVal['friends'].append(friend[0])
    for request in requests:
            returnVal['requests'].append(request[0])
    return returnVal


if __name__ == '__main__':  
    socketio.run(app, host  ='0.0.0.0', port=5000)