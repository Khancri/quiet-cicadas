from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='.')
CORS(app)

@app.route('/')
def main():
    return send_from_directory('.', 'client.html')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=2994)
