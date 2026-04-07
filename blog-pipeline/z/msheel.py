import psycopg2
import json
import requests

con = psycopg2.connect(dbname='pipe', user='akshit', password='Akshit@DB2026', host='localhost', port='5432')
cur = con.cursor()

def regenerate(blog):
    url = "http://127.0.0.1:2300/"
    for i in range(len(blog['main']['products'])):
        if blog['main']['products'][i]['description']['current']['writer'] != 'hps_hm':
            print('pd',i)
            response = requests.post(url,json={'blog':blog, 'request':{'task':'generate','part':'productdescription','index':i,'writer':'hps_hm'}})
            blog = response.json()
    for i in range(len(blog['main']['faqs']['list'])):
        if blog['main']['faqs']['list'][i]['answer']['current']['writer'] != 'hk_hm':
            print('faq',i)
            response = requests.post(url,json={'blog':blog, 'request':{'task':'generate','part':'faqanswer','index':i,'writer':'hk_hm'}})
            blog = response.json()
    return blog

def main(con,cur):
    cur.execute("select b.jobs_id from blogs as b inner join jobroleassignments as jra on b.jobs_id=jra.jobs_id where isapproved is false and jra.roles_id=(select id from roles where role='blog evaluator') and jra.accounts_id=(select id from accounts where email='madhusheel.arora@slidetech.in');")
    result = cur.fetchall()
    jobids = [r[0] for r in result]
    #print(len(jobids))
    with open('log.out','w') as f:
        f.write('')
    for i,jid in enumerate(jobids):
        cur.execute('select blog from blogs where jobs_id=%s;', (jid,))
        blogjson = cur.fetchone()[0]
        blog = json.loads(blogjson)
        #print(blog)
        blog = regenerate(blog)
        #print(blog)
        blogjson = json.dumps(blog)
        #exit()
        cur.execute('update blogs set blog=%s where jobs_id=%s;', (blogjson,jid))
        con.commit()
        out = str(i+1)+'/'+str(len(jobids))+'\n'
        with open('log.out','a') as f:
            f.write(out)
    con.close()


# if request.method=='POST':
#        #jobid = request.form.get('jobid')  # something seems off with html template
#        print('POST!')
#        req = json.loads(request.form.get('request'))
#        cur.execute('select blog from blogs where jobs_id=%s;', (jobid,))
#        blog = cur.fetchone()[0]
#        blog = json.loads(blog)
#        url = "http://127.0.0.1:2300/"
#        data = {'blog':blog,'request':req}
#        response = requests.post(url, json=data)
#        blog = response.json()
#        blogjson = json.dumps(blog)
#        cur.execute('update blogs set blog=%s where jobs_id=%s;', (blogjson,jobid))
#        print('saved')
#        con.commit()



main(con,cur)
