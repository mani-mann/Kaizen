import io
import pandas as pd

def parsefinaldocket(jobid,cur):
    cur.execute('select finaldocket from dockets where jobs_id=%s;', (jobid,))
    docketfile = io.BytesIO(cur.fetchone()[0])
    products = (pd.read_excel(docketfile, sheet_name='Products', usecols=['Product Name','Product Url'])).values.tolist()
    blogs = (pd.read_excel(docketfile, sheet_name='Blogs', usecols=['Blog Url'])).values.tolist()
    alliedkeywords = (pd.read_excel(docketfile, sheet_name='Allied Keywords', usecols=['Allied Keywords'])).values.tolist()
    faqs = (pd.read_excel(docketfile, sheet_name='FAQs', usecols=['Questions'])).values.tolist()
    title = (pd.read_excel(docketfile, sheet_name='Title', usecols=['Keyword','Title'])).values.tolist()
    metadata = (pd.read_excel(docketfile, sheet_name='Metadata', usecols=['Job ID'])).values.tolist()
    docket = dict()
    docket['jobid'] = metadata[0][0]
    docket['keyword'] = title[0][0]
    docket['title'] = title[0][1]
    docket['products'] = [{'title':p[0],'link':p[1]} for p in products]
    docket['blogs'] = [b[0] if b[0][:4]!='www.' else 'https://'+b[0] for b in blogs]
    docket['faqs'] = [q[0] for q in faqs]
    docket['alliedkeywords'] = [ak[0] for ak in alliedkeywords]
    return docket

def getnextjobidwithfinaldocketwithoutblog(con, cur):
    cur.execute('select j.id from jobs as j inner join dockets as d on j.id=d.jobs_id left join blogs as b on j.id=b.jobs_id where d.finaldocket is not null and b.blog is null limit 1;')
    result = cur.fetchone()
    if result != None:
        return result[0]
    else:
        return None

def getnextjobidwithfinaldocketwithoutblogwithenoughproducts(con, cur):
    cur.execute('select j.id from jobs as j inner join dockets as d on j.id=d.jobs_id left join blogs as b on j.id=b.jobs_id where d.finaldocket is not null and b.blog is null;')
    results = cur.fetchall()
    for result in results:
        jobid = result[0]
        finaldocketdict = parsefinaldocket(jobid, cur)
        if len(finaldocketdict['products']) >= 3:
            return jobid
    return None

def getjobidswithfinaldocketwithoutblog(cur):
    cur.execute('select j.id from jobs as j inner join dockets as d on j.id=d.jobs_id left join blogs as b on j.id=b.jobs_id where d.finaldocket is not null and b.blog is null;')
    jobids = [row[0] for row in cur.fetchall()]
    return jobids

def countproducts(jobid,cur):
    docket = parsefinaldocket(jobid,cur)
    return len(docket['products'])
