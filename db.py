import sqlite3
while True:
    prompt = input('(db.js) sql: ')
    with sqlite3.connect('.db') as conn:
        conn.execute('PRAGMA foreign_keys = ON')
        curs = conn.cursor()
        curs.execute(prompt)
        curs.connection.commit()