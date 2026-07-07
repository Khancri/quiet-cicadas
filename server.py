from flask import Flask, jsonify, request, send_from_directory, session, send_file, redirect, abort
from datetime import datetime
from flask_cors import CORS
import flask_socketio
from flask_socketio import join_room, leave_room
import uuid
import emoji
import bcrypt
import json; import os;
PROFILE_FILE = 'profiles.json'

app = Flask(__name__, static_folder='.')
socketio = flask_socketio.SocketIO(app, cors_allowed_origins="*")
app.secret_key = 'R5m9SAXRxLwERafXLj5hqW4qru98NhWz'
CORS(app)

user_sockets = {}  # username → socket id

#region Utils
def getChannel(channel: str, username: str):
    if channel.startswith('@'):
        channel = channel[1:]
        if channel > username:
            return username + channel
        else:
            return channel+username
    return channel

def load(file):
    if not os.path.exists(file):
        return {}
    with open(file) as f:
        return json.load(f)

def save(file, todos):
    with open(file, 'w') as f:
        json.dump(todos, f, indent=4)
#endregion

#region HTML Endpoints
@app.route('/chat')
def chat():
    if not 'username' in session.keys():
        return abort(403);
    return send_from_directory('.', 'chat.html')

@app.route('/')
def main():
    if 'username' in session.keys():
        return redirect('/chat')
    return send_from_directory('.', 'client.html')
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

@app.route('/me')
def me():
    if 'username' not in session:
        return jsonify({'ok': False})
    return jsonify({'username': session['username']})

@app.route('/login', methods=['POST'])
def login():
    info = request.json
    username = info['username']; password = info['password'];
    oldPassword = load('profiles.json')[username]['password']
    if (bcrypt.checkpw(password.encode('utf-8'), oldPassword.encode())):
        session['username'] = username
        return jsonify({'ok': True})
    return jsonify({'ok': False})
#region ErrorHandler
@app.errorhandler(403)
def unauthorized(e):
    return send_from_directory('.', '403.html'), 403

@app.errorhandler(404)
def not_found(e):
    return send_from_directory('.', '404.html'), 404
#endregion
@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return '', 204

@app.route('/signup', methods=['POST'])
def signup():
    info = request.json
    print(info)
    username = info['username']
    password = info['password']

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
    key = info['publicKey']
    print(key)
    profileObj = {'username': username, 'password': hashed.decode(), 'key': key}
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

@socketio.on("join")
def on_join(data):
    print(session['username'])
    user_sockets[session['username']] = request.sid
    if data['room'].startswith('@'):
        join_room(getChannel(data['room'], session['username']))
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
    socketio.emit('new_message', {hash: message_obj}, to=data['channel'])

@socketio.on('react')
def react(message): #{channel: 'channel', id: 'id'}
    file = load(f'msg/{message['channel']}.json')
    
    if not emoji.is_emoji(message['reaction']): 
        return '', 400
    if not 'reactions' in file['messages'][message['id']].keys(): 
        file['messages'][message['id']]['reactions'] = {}
    if not message['reaction'] in file['messages'][message['id']]['reactions'].keys(): 
        file['messages'][message['id']]['reactions'][message['reaction']] = []
    if session['username'] in file['messages'][message['id']]['reactions'][message['reaction']]: return '', 304
    file['messages'][message['id']]['reactions'][message['reaction']].append(session['username'])
    save(f'msg/{message['channel']}.json', file)
    socketio.emit('message_reacted', {message['id']: file['messages'][message['id']]}, to=message['channel'])
    
@socketio.on('keyupdate')
def update_key_list(data):
    file = load(f'msg/{data['channel']}.json')
    if not 'metadata' in file.keys():
        file['metadata'] = {}
    if not 'users' in file['metadata'].keys():
        file['metadata']['users'] = [];
    file['metadata']['users'].append(session['username'])
    save(f'msg/{data['channel']}.json', file)

@socketio.on('unreact')
def unreact(message):
    file = load(f'msg/{message['channel']}.json')
    print(message['id'])
    file['messages'][message['id']]['reactions'][message['reaction']].pop(file['messages'][message['id']]['reactions'][message['reaction']].index(session['username']))
    if len(file['messages'][message['id']]['reactions'][message['reaction']]) == 0:
        del file['messages'][message['id']]['reactions'][message['reaction']]
    save(f'msg/{message['channel']}.json', file)
    socketio.emit('message_reacted', {message['id']: file['messages'][message['id']]}, to=message['channel'])

@socketio.on('direct_message')
def handle_direct_message(data):
    to_username = data['to']
    payload = data['payload']
    # print(payload)
    to_sid = user_sockets.get(to_username)
    if to_sid:
        socketio.emit('direct_message', payload, to=to_sid)


@socketio.on('dm')
def direct_message(data):
    to = data['to']
    payload = data['payload']
    to_sid = user_sockets.get(to)
    hash = str(uuid.uuid4())
    date = datetime.now().isoformat()
    message_obj = {
        'user': session['username'],
        'content': payload,
        'date': date,
    }
    if to_sid:
        socketio.emit('dm', {hash: message_obj}, to=to_sid)
        print('hi' + hash)
        return {'hash': hash, 'date': date}
    
@socketio.on('disconnect')
def handle_disconnect():
    # remove from user_sockets
    global user_sockets
    user_sockets = {k: v for k, v in user_sockets.items() if v != request.sid}

@socketio.on('public_key_request')
def key_request(data):
    user = data['user']
    return load('profiles.json')[user]['key']

@socketio.on('request_key')
def request_key(data): # data: user, channel
    print(data)
    to_sid = user_sockets.get(data['user'])
    if to_sid:
        socketio.emit('key_exchange', {'channel': data['channel'], 'user': session['username']}, to=to_sid)

@socketio.on('request_key_complete')
def request_key_complete(data):
    to_sid = user_sockets.get(data['user'])
    if to_sid:
        socketio.emit('request_key_complete', data['payload'], to=to_sid)

@socketio.on('channel_users')
def get_users_with_key(data):
    file = load(f'msg/{data['channel']}.json')
    print(file)
    if file == {}:
        return {'list': None}
    users: list  = file['metadata']['users'] 
    if users == None:
        return {'list': None}
    active = []
    for user in users:
        if user in user_sockets.keys():
            active.append(user)
            
    return {'list': list(active)}
typing = {}     
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

if __name__ == '__main__':  
    socketio.run(app, host  ='0.0.0.0', port=2994, ssl_context=('cert.pem', 'key.pem'))