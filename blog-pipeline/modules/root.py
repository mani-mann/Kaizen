def main_get(useremail, actoremail, cur):
    cur.execute('select r.role from roles as r inner join accountroles as ar on r.id=ar.roles_id inner join accounts as a on a.id=ar.accounts_id where a.email=%s;', (useremail,))
    userroles = [row[0] for row in cur.fetchall()]
    cur.execute('select r.role from roles as r inner join accountroles as ar on r.id=ar.roles_id inner join accounts as a on a.id=ar.accounts_id where a.email=%s;', (actoremail,))
    actorroles = [row[0] for row in cur.fetchall() if row[0] != 'admin']  # avoid repitition
    buttons = []
    if 'admin' in userroles:
        buttons.append(['admin','/admin'])
    for role in actorroles:
        buttons.append([role,'/'+role.replace(' ','')])
    return buttons
