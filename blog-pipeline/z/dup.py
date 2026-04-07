import psycopg2
import json
import requests

con = psycopg2.connect(dbname='pipe', user='akshit', password='Akshit@DB2026', host='localhost', port='5432')
cur = con.cursor()

def hasduplicateproducts(blog):
    imagelinks = list()
    for p in blog['main']['products']:
        imagelinks.append(p['imagelink'])
    if len(imagelinks) != len(list(set(imagelinks))):
        return True
    else:
        return False

def deleteblog(jobid):
    cur.execute('delete from blogs where jobs_id=%s;', (jobid,))
    con.commit()

def main(con,cur):
    cur.execute("select j.id,j.keyword,b.blog from jobs as j inner join blogs as b on j.id=b.jobs_id where b.ispublished=false;")
    result = cur.fetchall()
    print(len(result))
    for r in result:
        id_ = r[0]
        keyword = r[1]
        blogjson = r[2]
        blog = json.loads(blogjson)
        if hasduplicateproducts(blog):
            print(keyword)
            #deleteblog(id_)


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
