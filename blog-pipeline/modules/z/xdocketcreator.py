# NOTE THIS WAS REJECTED BECAUSE LATER SELECTION OF DOCKETS BY DOCKET TEAM WAS NOT THE REQUIREMENT

import psycopg2

def mydocketdictlist(docketcreator, cur):
    cur.execute('select j.id,j.keyword from jobs as j inner join jobroleassignments as jra on j.id=jra.jobs_id where jra.roles_id=(select id from roles where role=%s) and jra.accounts_id=(select id from accounts where email=%s);', ('docket creator',docketcreator))
    results = cur.fetchall()
    mydocketdictlist = []
    for row in results:
        mydocketdict = dict()
        mydocketdict['jobid'] = row[0]
        mydocketdict['keyword'] = row[1]
        cur.execute('select autodocket is not null as isexists_autodocket, finaldocket is not null as isexists_finaldocket from dockets where jobs_id=%s;', (mydocketdict['jobid'],))
        result = cur.fetchone()
        mydocketdict['isexists_autodocket'] = result[0]
        mydocketdict['isexists_finaldocket'] = result[1]
        mydocketdictlist.append(mydocketdict)
    return mydocketdictlist

def selectdocketdictlist(cur):
    cur.execute('select j.id,j.keyword from jobs as j where j.id not in (select j.id from jobs as j inner join jobroleassignments as jra on j.id=jra.jobs_id where jra.roles_id=(select id from roles where role=%s));', ('docket creator',))  # select all jobs for which docket creator is not assigned yet
    results = cur.fetchall()
    selectdocketdictlist = []
    for row in results:
        selectdocketdict = dict()
        selectdocketdict['jobid'] = row[0]
        selectdocketdict['keyword'] = row[1]
        cur.execute('select autodocket is not null as isexists_autodocket from dockets where jobs_id=%s;', (selectdocketdict['jobid'],))
        selectdocketdict['isexists_autodocket'] = cur.fetchone()[0]
        selectdocketdictlist.append(selectdocketdict)
    return selectdocketdictlist

def download(jobid, dockettype, cur):
    cur.execute('select keyword from jobs where id=%s;', (jobid,))
    name = dockettype+'docket_' + (cur.fetchone()[0]).replace(' ','_').lower() + '.xlsx'
    if dockettype == 'auto':
        cur.execute('select autodocket from dockets where jobs_id=%s;', (jobid,))
    if dockettype == 'final':
        cur.execute('select finaldocket from dockets where jobs_id=%s;', (jobid,))
    result = cur.fetchone()
    if result and result[0]:
        file = result[0]
        return file,name

def post(docketcreator, form, con, cur):
    if form.get['type'] == 'select':
        jobid = form.get['jobid']
        cur.execute('select * from jobroleassignments as jra inner join roles as r on r.id=jra.roles_id where r.role=%s;', ('docket creator',))
        if cur.fetchone() != None:
            return 'FAILED: keyword already taken'
        cur.execute('insert into jobroleassignments (jobs_id,roles_id,accounts_id) values (%s,(select id from roles where role=%s),(select id from accounts where email=%s));', (jobid,'docket creator',docketcreator))
        con.commit()
        return 'SUCCESS: keyword selected'
    elif form.get['type'] == 'upload':
        finaldocketfile = (form.files['file']).read()
        with io.BytesIO(finaldocketfile) as f:
            metadatadf = pd.read_excel(f, sheet_name='Metadata')
            metadatajobid = metadatadf.loc[0,'Job ID']
        cur.execute('select s.code from status as s inner join jobstatus as js on j.id=js.status_id where js.jobs_id=%s;', (metadatajobid,))
        statuscodes = [row[0] for row in cur.fetchall()]
        if len(statuscodes) > 3:  # means it has gone past 'final-docket uploaded' stage
            return 'FALIURE: blog was already generated. contact admin if this needs correction'
        cur.execute('insert into dockets (jobs_id,finaldocket) values (%s,%s) on conflict (jobs_id) do update set finaldocket=excluded.finaldocket;', (metadatajobid,psycopg2.Binary(finaldocket)))
        setstatus = 'final-docket uploaded'
        if setstatus not in statuscodes:
            cur.execute('insert into jobstatus (jobs_id,status_id) values (%s,(select id from status where code=%s));', (metadatajobid,setstatus))
        con.commit()
        return 'SUCCESS: final docket uploaded'
