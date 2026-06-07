from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import json; import os;
PROFILE_FILE = 'profiles.json'


app = Flask(__name__, static_folder='.')
CORS(app)

def load():
    if not os.path.exists(PROFILE_FILE):
        return {}
    with open(PROFILE_FILE) as f:
        return json.load(f)

def save(todos):
    with open(PROFILE_FILE, 'w') as f:
        json.dump(todos, f)


@app.route('/')
def main():
    return send_from_directory('.', 'client.html')

@app.route('/file/<string:fileName>')
def get_file(fileName):
    return send_from_directory('.', fileName)

@app.route('/profile', methods=['POST'])
def profile():
    info = request.json
    print(info)
    username = info['username']
    profileObj = {'username': username}
    file = load()
    file[username] = profileObj
    save(file)
    return '', 204

@app.route('/profile/exists/<string:username>', methods=['GET'])
def exising_username(username: str):
    if username in load().keys():
        return jsonify({'ok': True})
    return jsonify({'ok': False})
    

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=2994)
