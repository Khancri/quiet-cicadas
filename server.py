from flask import Flask, jsonify, request, send_from_directory, session
from datetime import datetime
from flask_cors import CORS
import flask_socketio
import uuid
import bcrypt
import json; import os;
PROFILE_FILE = 'profiles.json'

app = Flask(__name__, static_folder='.')
socketio = flask_socketio.SocketIO(app, cors_allowed_origins="*")
app.secret_key = 'R5m9SAXRxLwERafXLj5hqW4qru98NhWz'
CORS(app)
#region JSON
def load(file):
    if not os.path.exists(file):
        return {}
    with open(file) as f:
        return json.load(f)

def save(file, todos):
    with open(file, 'w') as f:
        json.dump(todos, f, indent=4)
#endregion

@app.route('/chat')
def chat():
    return send_from_directory('.', 'chat.html')

@app.route('/')
def main():
    return send_from_directory('.', 'client.html')

@app.route('/file/<string:fileName>')
def get_file(fileName):
    return send_from_directory('.', fileName)

@app.route('/me')
def me():
    if 'username' not in session:
        return jsonify({'ok': False})
    return jsonify({'username': session['username']})

@app.route('/profile', methods=['POST'])
def profile():
    info = request.json
    print(info)
    username = info['username']
    password = info['password']

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())

    profileObj = {'username': username, 'password': hashed.decode()}
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
    
@app.route('/message', methods=['POST'])
def post_message():
    info = request.json
    message_obj = {
        'user': session['username'],
        'content': info['message'],
        'date': datetime.now().isoformat()
    }    
    file = load('messages.json'); 
    hash = str(uuid.uuid4())
    file[hash] = message_obj
    save('messages.json', file)
    socketio.emit('new_message', {hash: message_obj})
    return '', 204

@app.route('/messages', methods=['GET'])
def get_messages():
    data = load('messages.json')
    sorted_msgs = sorted(data.items(), key=lambda x: x[1]['date'], reverse=True)
    recent = dict(sorted_msgs[:10])
    return jsonify(recent)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=2994)
