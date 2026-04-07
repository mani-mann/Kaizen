import pandas as pd
import io
import numpy as np

def getroleemails(cur, role):
    cur.execute('select a.email from accounts as a inner join accountroles as ar on a.id=ar.accounts_id inner join roles as r on r.id=ar.roles_id where r.role=%s;', (role,))
    roleemails = [row[0] for row in cur.fetchall()]
    return roleemails

def accounts(cur):
    docketcreators = getroleemails(cur, 'docket creator')
    blogwriters = getroleemails(cur, 'blog writer')
    blogevaluators = getroleemails(cur, 'blog evaluator')
    dfdocketcreators = pd.DataFrame(docketcreators, columns=['email'])
    dfblogwriters = pd.DataFrame(blogwriters, columns=['email'])
    dfblogevaluators = pd.DataFrame(blogevaluators, columns=['email'])
    outfile = io.BytesIO()
    with pd.ExcelWriter(outfile, engine='openpyxl') as writer:
        dfdocketcreators.to_excel(writer, index=False, sheet_name='docket creators')
        dfblogwriters.to_excel(writer, index=False, sheet_name='blog writers')
        dfblogevaluators.to_excel(writer, index=False, sheet_name='blog evaluators')
    outfile.seek(0)
    return outfile

def format():
    outfile = io.BytesIO()
    df = pd.DataFrame([], columns=['keyword','title','docket creator','blog writer','blog evaluator'])
    with pd.ExcelWriter(outfile, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='format')
    outfile.seek(0)
    return outfile

def assignjobrole(cur,jobid,role,email):
    cur.execute('insert into jobroleassignments (jobs_id,roles_id,accounts_id) values (%s,(select id from roles where role=%s),(select id from accounts where email=%s));', (jobid,role,email))
    return

def setstatus(cur,jobid,status):
    cur.execute('insert into jobstatus (jobs_id,status_id) values (%s,(select id from status where code=%s));', (jobid,status))
    return

def nanfix(li):
    return li
    return [x if x is not np.nan else None for x in li]

def isaccountinvalid(accountlist, role, cur):
    for account in accountlist:
        if account == None:
            continue
        cur.execute('select r.role from roles as r inner join accountroles as ar on ar.roles_id=r.id inner join accounts as a on a.id=ar.accounts_id where a.email=%s;', (account,))
        roles = [row[0] for row in cur.fetchall()]
        if role not in roles:
            return True
    return False

def getkeywordcount(keyword, allkeywords):
    count = 0
    for ak in allkeywords:
        if keyword.lower().strip() == ak.lower().strip():
            count += 1
    return count

def insert(keywordcreator, file, con, cur):
    if file.filename.endswith('.csv'):
        df = pd.read_csv(file)
    elif file.filename.endswith('.xlsx'):
        df = pd.read_excel(file)
    else:
        return 'FALIURE: upload a csv or xlsx sheet'

    if set(['keyword','title','docket creator','blog writer','blog evaluator']) != set(list(df.columns)):
        return "FALIURE: sheet must exactly contain columns - 'keyword','docket creator','blog writer','blog evaluator'"

    df = df.replace({np.nan: None})

    keywords = nanfix(df['keyword'].tolist())
    titles = nanfix(df['title'].tolist())
    docketcreators = nanfix(df['docket creator'].tolist())
    blogwriters = nanfix(df['blog writer'].tolist())
    blogevaluators = nanfix(df['blog evaluator'].tolist())

    if isaccountinvalid(docketcreators, 'docket creator', cur):
        return 'FALIURE: docket creators have an invalid email in them'
    if isaccountinvalid(blogwriters, 'blog writer', cur):
        return 'FALIURE: blog writers have an invalid email in them'
    if isaccountinvalid(blogevaluators, 'blog evaluator', cur):
        return 'FALIURE: blog evaluator have an invalid email in them'

    if None in keywords:
        return 'FALIURE: keyword can not be blank'
    if None in titles:
        return 'FALIURE: title can not be blank'
    if None in docketcreators:
        return 'FALIURE: docket creator can not be blank'

    # NOTE EMAIL NOT IN DB ERROR LOGIC HERE

    # must be stripped to avoid a nasty range odf errors
    keywords = [k.strip() for k in keywords]
    titles = [t.strip() for t in titles]

    cur.execute('select keyword from jobs;')
    result = cur.fetchall()
    allkeywords = [r[0] for r in result]

    nkeywords = len(keywords)
    nduplicates = 0
    for i in range(len(keywords)):
        if getkeywordcount(keywords[i], allkeywords) > 0:
            nduplicates += 1
        cur.execute('insert into jobs (keyword,title) values (%s,%s) returning id;', (keywords[i],titles[i]))
        jobid = cur.fetchone()[0]
        setstatus(cur,jobid,'keyword created')
        assignjobrole(cur,jobid, 'keyword creator', keywordcreator)
        assignjobrole(cur,jobid, 'docket creator', docketcreators[i]) if docketcreators[i]!=None else None
        assignjobrole(cur,jobid, 'blog writer', blogwriters[i]) if blogwriters[i]!=None else None
        assignjobrole(cur,jobid, 'blog evaluator', blogevaluators[i]) if blogevaluators[i]!=None else None
    con.commit()
    return f'SUCCESS: {nkeywords} keywords inserted. {nduplicates} duplicates found.'
    #return 'SUCCESS: sheet inserted'

# DEPRECATED - ITS A PAIN
def insertone(keyword, title, keywordcreator, docketcreator, blogwriter, blogevaluator, con, cur):
    keyword = keyword.strip()
    if keyword == '':
        return 'FALIURE: keyword is empty'
    title = title.strip()
    if title == '':
        return 'FALIURE: title is empty'
    docketcreator = docketcreator.strip()
    if docketcreator == '':
        return 'FALIURE: docket creator is empty'
    cur.execute('insert into jobs (keyword) values (%s) returning id;', (keyword,))
    jobid = cur.fetchone()[0]
    setstatus(cur,jobid,'keyword created')
    assignjobrole(cur,jobid, 'keyword creator', keywordcreator)
    assignjobrole(cur,jobid, 'docket creator', docketcreator) if docketcreator!=None else None
    assignjobrole(cur,jobid, 'blog writer', blogwriter) if blogwriter!=None else None
    assignjobrole(cur,jobid, 'blog evaluator', blogevaluator) if blogevaluator!=None else None
    con.commit()
    return 'SUCCESS: keyword inserted'

def delete(jobid, con, cur):
    cur.execute('delete from jobs where id=%s;', (jobid,))
    con.commit()
    return 'SUCCESS: keyword deleted'

def main_post(keywordcreator, request, con, cur):
    form = request.form
    mode = form.get('mode')
    if mode == 'insert':
        return insert(keywordcreator, request.files['file'], con, cur)
    #elif mode == 'insertone':
    #    return insertone(form.get('keyword'), form.get('title'), keywordcreator, form.get('docket creator'), form.get('blog writer'), form.get('blog evaluator'), con, cur)
    elif mode == 'delete':
        return delete(form.get('jobid'), con, cur)


def getjobroleemail(jobid, role, cur):
    cur.execute('select a.email from accounts as a inner join jobroleassignments as jra on a.id=jra.accounts_id inner join roles as r on r.id=jra.roles_id where jra.jobs_id=%s and r.role=%s;', (jobid,role))
    result = cur.fetchone()
    return result[0] if result!=None else None

def main_get(keywordcreator, cur):
    jobdictlist = []
    cur.execute('select j.id,j.keyword,j.title from jobs as j inner join jobroleassignments as jra on j.id=jra.jobs_id inner join roles as r on r.id=jra.roles_id inner join accounts as a on a.id=jra.accounts_id where r.role=%s and a.email=%s;', ('keyword creator',keywordcreator))  # get all keywords inserted by later on, filter according to status, preferably sorted by time of keyword insertion
    results = cur.fetchall()
    for row in results:
        jobdict = dict()
        jobid = row[0]
        jobdict['jobid'] = jobid
        jobdict['keyword'] = row[1]
        jobdict['title'] = row[2]
        jobdict['keywordcreator'] = getjobroleemail(jobid, 'keyword creator', cur)  # sanity check
        jobdict['docketcreator'] = getjobroleemail(jobid, 'docket creator', cur)
        jobdict['blogwriter'] = getjobroleemail(jobid, 'blog writer', cur)
        jobdict['blogevaluator'] = getjobroleemail(jobid, 'blog evaluator', cur)
        jobdictlist.append(jobdict)
    return jobdictlist

def dropdowns(cur):
    dropdowns = dict()
    dropdowns['docketcreators'] = getroleemails(cur, 'docket creator')
    dropdowns['blogwriters'] = getroleemails(cur, 'blog writer')
    dropdowns['blogevaluators'] = getroleemails(cur, 'blog evaluator')
    return dropdowns

# --------------------------------------

def getjobdictlist(cur):
    jobdictlist = []
    cur.execute('select j.id,j.keyword,j.title from jobs as j;')
    results = cur.fetchall()
    for row in results:
        jobdict = dict()
        jobid = row[0]
        jobdict['jobid'] = jobid
        jobdict['keyword'] = row[1]
        jobdict['title'] = row[2]
        jobdict['keywordcreator'] = getjobroleemail(jobid, 'keyword creator', cur)  # sanity check
        jobdict['docketcreator'] = getjobroleemail(jobid, 'docket creator', cur)
        jobdict['blogwriter'] = getjobroleemail(jobid, 'blog writer', cur)
        jobdict['blogevaluator'] = getjobroleemail(jobid, 'blog evaluator', cur)
        jobdictlist.append(jobdict)
    return jobdictlist

# --------------------------------------

def getdocketcreators(cur):
    docketcreators = getroleemails(cur, 'docket creator')
    return docketcreators

def getstatusdictlist(email,cur):
    cur.execute('select j.keyword,d.autodocket is not NULL,d.finaldocket is not NULL from jobs as j inner join dockets as d on j.id=d.jobs_id inner join jobroleassignments as jra on j.id=jra.jobs_id where jra.accounts_id=(select id from accounts where email=%s) and jra.roles_id=(select id from roles where role=%s);', (email,'docket creator'))
    result = cur.fetchall()
    result = sorted(result, key=lambda x:x[1])
    result = sorted(result, key=lambda x:x[2])
    statusdictlist = list()
    for row in result:
        autodocket = 'generated' if row[1]==True else 'generating'
        finaldocket = 'uploaded' if row[2]==True else 'pending'
        statusdict = {'keyword':row[0], 'autodocket':autodocket, 'finaldocket':finaldocket}
        statusdictlist.append(statusdict)
    return statusdictlist
