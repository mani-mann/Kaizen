def accounts_get(cur):
    cur.execute('select role from roles;')
    roleoptions = [row[0] for row in cur.fetchall()]
    cur.execute('select * from accounts;')
    accounts = [row for row in cur.fetchall()]
    accountrolesdict = {}
    for account in accounts:
        account_id = account[0]
        email = account[1]
        cur.execute('select r.role from roles as r inner join accountroles as ar on r.id=ar.roles_id where ar.accounts_id=%s;', (account_id,))
        accountrolesdict[email] = ', '.join([row[0] for row in cur.fetchall()])
    return roleoptions,accountrolesdict

def accounts_post(form, con, cur):
    mode = form.get('mode')
    if mode == 'upsert':
        email = form.get('email')
        roles = form.getlist('roles')
        cur.execute('select id from accounts where email=%s;', (email,))
        result = cur.fetchone()
        if result == None:
            cur.execute('insert into accounts (email) values (%s);', (email,))
            cur.execute('select id from accounts where email=%s;', (email,))
            accounts_id = cur.fetchone()[0]
            status = 'inserted'
        else:
            accounts_id = result[0]
            # old account roles cleanup
            cur.execute('delete from accountroles where accounts_id=%s;', (accounts_id,))
            status = 'updated'
        for role in roles:
            cur.execute('insert into accountroles (accounts_id,roles_id) values (%s,(select id from roles where role=%s));', (accounts_id, role))
        con.commit()
        return 'SUCCESS: account ' + status
    if mode == 'delete':
        email = form.get('email')
        cur.execute('delete from accounts where email=%s;', (email,))  # cascades into accountroles (and everything else!)
        con.commit()
        return 'SUCCESS: account deleted'

# ---------------------------------------

def impersonate_get(cur):
    cur.execute('select email from accounts;')
    emails = [row[0] for row in cur.fetchall()]
    return emails

def impersonate_post(user, actor, cur, con):
    cur.execute('select id from accounts where email=%s;', (user,))
    result = cur.fetchone()
    useremailuuid = result[0]
    cur.execute('select id from accounts where email=%s;', (actor,))
    result = cur.fetchone()
    actoremailuuid = result[0]
    cur.execute('delete from impersonate where userid=%s;', (useremailuuid,))
    cur.execute('insert into impersonate (userid,actorid) values (%s,%s);', (useremailuuid,actoremailuuid))
    con.commit()
    return 'SUCCESS: now impersonated as ' + actor

def currentactor(user, cur):
    cur.execute('select id from accounts where email=%s;', (user,))
    useruuid = cur.fetchone()[0]
    cur.execute('select email from accounts where id=(select actorid from impersonate where userid=%s);', (useruuid,))
    actor = cur.fetchone()[0]
    return actor
