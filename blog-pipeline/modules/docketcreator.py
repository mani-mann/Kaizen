import psycopg2
import io
import pandas as pd


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
        if result == None:  # even autodocket isnt made, implying row does not exist
            mydocketdict['isexists_autodocket'] = False
            mydocketdict['isexists_finaldocket'] = False
        else:
            mydocketdict['isexists_autodocket'] = result[0]
            mydocketdict['isexists_finaldocket'] = result[1]
        mydocketdictlist.append(mydocketdict)
    mydocketdictlist = sorted(mydocketdictlist, key=lambda x:x['isexists_autodocket'])
    mydocketdictlist = sorted(mydocketdictlist, key=lambda x:x['isexists_finaldocket'])
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
    name = dockettype+'docket_' + (cur.fetchone()[0]).replace(' ','_').lower().strip() + '.xlsx'
    if dockettype == 'auto':
        cur.execute('select autodocket from dockets where jobs_id=%s;', (jobid,))
    if dockettype == 'final':
        cur.execute('select finaldocket from dockets where jobs_id=%s;', (jobid,))
    result = cur.fetchone()
    if result and result[0]:
        file = result[0]
        return file,name

def checkintegrity(cur,xlsxfile):
    #with io.BytesIO(xlsxfile) as f:
    #    xlsx = pd.ExcelFile(f)
    f = io.BytesIO(xlsxfile)
    xlsx = pd.ExcelFile(f)
    if set(['Products','Blogs','Allied Keywords','FAQs','Title','Metadata']) != set(list(xlsx.sheet_names)):
        return 'FALIURE: sheets dont match the convention'
    dfproducts = xlsx.parse('Products')
    if len(dfproducts) > 30:
        return 'FALIURE: too many products'
    if len(dfproducts) == 0:
        return 'FALIURE: no products in the sheet'
    if 'Product Name' not in list(dfproducts.columns) or 'Product Url' not in list(dfproducts.columns):
        return 'FALIURE: columns missing in products sheet'
    producturls = dfproducts[['Product Url']].values.tolist()
    producturls = [purl[0] for purl in producturls]
    for purl in producturls:
        if purl == None:
            return 'FALIURE: product sheet contains an empty row'
        if '/blog/' in purl:
            return 'FALIRE: product sheet contains blog url'
    dfblogs = xlsx.parse('Blogs')
    if len(dfblogs) > 10:
        return 'FALIURE: too many blogs'
    if len(dfblogs) == 0:
        return 'FALIURE: no blogs in the sheet'
    if 'Blog Name' not in list(dfblogs.columns) or 'Blog Url' not in list(dfblogs.columns):
        return 'FALIURE: columns missing in blog sheet'
    blogurls = dfblogs[['Blog Url']].values.tolist()
    blogurls = [burl[0] for burl in blogurls]
    for burl in blogurls:
        if burl == None:
            return 'FALIURE: blog sheet contains an empty row'
        if '/blog/' not in burl:
            return 'FALIURE: blog sheet contains non-blog url'
    dfalliedkeywords = xlsx.parse('Allied Keywords')
    if len(dfalliedkeywords) > 40:
        return 'FALIURE: too many allied keywords'
    if len(dfalliedkeywords) == 0:
        return 'FALIURE: no allied keywords found'
    dffaqs = xlsx.parse('FAQs')
    if len(dffaqs) > 30:
        return 'FALIURE: too many FAQs'
    if len(dffaqs) == 0:
        return 'FALIURE: no FAQs found'
    dftitle = xlsx.parse('Title')
    if pd.isna(dftitle['Title'].iloc[0]):
        return 'FALIURE: no title specified'
    dfmetadata = xlsx.parse('Metadata')
    if len(dfmetadata) != 1:
        return 'FALIURE: metadata corrupted. please report to admin'
    jobid = dfmetadata.loc[0,'Job ID']
    cur.execute('select count(*) from jobs where id=%s;', (jobid,))
    count = cur.fetchone()[0]
    if count != 1:
        return 'FALIURE: job not found. it might have been deleted.'
    return 'SUCCESS'

def post(docketcreator, file, con, cur):
    finaldocketfile = file.read()
    integrityresult = checkintegrity(cur,finaldocketfile)
    if integrityresult != 'SUCCESS':
        return integrityresult
    with io.BytesIO(finaldocketfile) as f:
        metadatadf = pd.read_excel(f, sheet_name='Metadata')
        metadatajobid = metadatadf.loc[0,'Job ID']
    cur.execute('select s.code from status as s inner join jobstatus as js on js.status_id=s.id where js.jobs_id=%s;', (metadatajobid,))
    statuscodes = [row[0] for row in cur.fetchall()]
    if len(statuscodes) > 3:  # means it has gone past 'final-docket uploaded' stage
        return 'FALIURE: blog was already generated. contact admin if this needs correction'
    cur.execute('insert into dockets (jobs_id,finaldocket) values (%s,%s) on conflict (jobs_id) do update set finaldocket=excluded.finaldocket;', (metadatajobid,psycopg2.Binary(finaldocketfile)))
    setstatus = 'final-docket uploaded'
    if setstatus not in statuscodes:
        cur.execute('insert into jobstatus (jobs_id,status_id) values (%s,(select id from status where code=%s));', (metadatajobid,setstatus))
    con.commit()
    return 'SUCCESS: final docket uploaded'
