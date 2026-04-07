def getkeywords(cur):
    cur.execute('select keyword from jobs;')
    result = cur.fetchall()
    keywords = [r[0] for r in result]
    return keywords

def isduplicate(keyword, keywords):
    nmatch = 0
    for k in keywords:
        if k.lower().strip() == keyword.lower().strip():
            nmatch += 1
    if nmatch > 1:
        return True
    else:
        return False

def getjoblist(blogevaluatorid,cur):
    cur.execute('select j.id,j.keyword,b.isapproved,b.isdiscarded from jobs as j inner join jobroleassignments as jra on j.id=jra.jobs_id inner join blogs as b on b.jobs_id=j.id where jra.roles_id=(select id from roles where role=%s) and jra.accounts_id=(select id from accounts where email=%s);', ('blog evaluator',blogevaluatorid))
    results = cur.fetchall()
    joblist = []
    for r in results:
        if r[2] == True:
            status = 'Approved'
        elif r[3] == True:
            status = 'Discarded'
        else:
            status = 'Pending'
        joblist.append({'id':r[0],'keyword':r[1],'status':status})
    #joblist = sorted(joblist, key=lambda x:x['isapproved'])
    joblist = sorted(joblist, key=lambda x:x['status']=='Discarded')
    joblist = sorted(joblist, key=lambda x:x['status']=='Pending')
    joblist.reverse()
    # ------------
    for i in range(len(joblist)):
        keywords = getkeywords(cur)
        joblist[i]['duplicate'] = isduplicate(joblist[i]['keyword'], keywords)
    return joblist

def getjobroleemail(jobid, role, cur):
    cur.execute('select a.email from accounts as a inner join jobroleassignments as jra on a.id=jra.accounts_id inner join roles as r on r.id=jra.roles_id where jra.jobs_id=%s and r.role=%s;', (jobid,role))
    result = cur.fetchone()
    return result[0] if result!=None else None


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
        #jobdict['keywordcreator'] = getjobroleemail(jobid, 'keyword creator', cur)  # sanity check
        #jobdict['docketcreator'] = getjobroleemail(jobid, 'docket creator', cur)
        #jobdict['blogwriter'] = getjobroleemail(jobid, 'blog writer', cur)
        jobdict['blogevaluator'] = getjobroleemail(jobid, 'blog evaluator', cur)
        jobdictlist.append(jobdict)
    return jobdictlist

def getduplicates(keyword,cur):
    jobdictlist = getjobdictlist(cur)
    duplicatejobdictlist = list()
    for jd in jobdictlist:
        if keyword.lower().strip() == jd['keyword'].lower().strip():
            duplicatejobdictlist.append(jd)
    return duplicatejobdictlist
