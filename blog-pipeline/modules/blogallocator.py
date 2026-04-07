def post(form, con, cur):
    cur.execute('select * from jobroleassignments where jobs_id=%s and roles_id=(select id from roles where role=%s);', (form.get('jobid'),form.get('role')))
    result = cur.fetchone()
    if result == None:
        cur.execute('insert into jobroleassignments (jobs_id,roles_id,accounts_id) values (%s,(select id from roles where role=%s),(select id from accounts where email=%s));', (form.get('jobid'),form.get('role'),form.get('email')))
    else:
        cur.execute('update jobroleassignments set accounts_id=(select id from accounts where email=%s) where roles_id=(select id from roles where role=%s) and jobs_id=%s;', (form.get('email'), form.get('role'), form.get('jobid')))
    con.commit()
    return 'SUCCESS: job updated'

def getrowdictlist(cur):
    cur.execute('select j.id,j.keyword from jobs as j inner join dockets as d on j.id=d.jobs_id where d.finaldocket is not null;')
    results = cur.fetchall()
    rowdictlist = list()
    for row in results:
        rowdict = dict()
        rowdict['jobid'] = row[0]
        rowdict['keyword'] = row[1]
        cur.execute('select email from accounts where id=(select accounts_id from jobroleassignments where jobs_id=%s and roles_id=(select id from roles where role=%s))', (rowdict['jobid'], 'blog writer'));
        result = cur.fetchone()
        rowdict['blogwriter'] = result[0] if result!= None else None
        cur.execute('select email from accounts where id=(select accounts_id from jobroleassignments where jobs_id=%s and roles_id=(select id from roles where role=%s))', (rowdict['jobid'], 'blog evaluator'));
        result = cur.fetchone()
        rowdict['blogevaluator'] = result[0] if result!= None else None
        rowdictlist.append(rowdict)
    return rowdictlist

def getroleaccounts(role, cur):
    cur.execute('select a.email from accounts as a inner join accountroles as ar on ar.accounts_id=a.id where ar.roles_id=(select id from roles where role=%s);', (role,))
    results = cur.fetchall()
    emails = [row[0] for row in results]
    return emails
