import json
import psycopg2
import time

con = psycopg2.connect(dbname='pipe', user='postgres', password='Rahul@143Modi', host='localhost', port='5432')
cur = con.cursor()

import blogscripts.docketfunctions as docketfunctions
import blogscripts.initializeblog as initializeblog
import blogscripts.enrichproducts as enrichproducts
import blogscripts.allocatealliedkeywords as allocatealliedkeywords
import blogscripts.allocateinterlinks as allocateinterlinks
import blogscripts.conclusiontitle as conclusiontitle
import blogscripts.writefirstblog as writefirstblog
import blogscripts.duplicate as duplicate

def save(blog,path):
    blogjson = json.dumps(blog,indent=4)
    with open(path,'w',encoding='utf-8') as f:
        f.write(blogjson)

def load(path):
    with open(path,'r',encoding='utf-8') as f:
        blogjson = f.read()
    blog = json.loads(blogjson)
    return blog

def insertblog(blog,con,cur):
    jobid = blog['jobid']
    blogjson = json.dumps(blog,indent=4)
    cur.execute('insert into blogs (jobs_id,blog) values (%s,%s);', (jobid,blogjson))
    con.commit()

def main(con,cur):
    while True:
        jobids = docketfunctions.getjobidswithfinaldocketwithoutblog(cur)
        print('while')
        for jobid in jobids:
            print('for')
            #time.sleep(10)
            if docketfunctions.countproducts(jobid,cur) == 1:
                continue  # NOTE one product logic. to be made later
            else:
                finaldocket = docketfunctions.parsefinaldocket(jobid,cur)
                blog = initializeblog.main(finaldocket)
                print(blog['keyword'])
                try:
                    blog = enrichproducts.main(blog,imagelimit=10)
                except Exception as e:
                    print('error occured: ', e)
                    print('continuing to next one')
                    continue
                #print('ENRICHPRODUCTS:\n',blog)
                save(blog,'saves/enriched.json')
                #exit()

                #blog = load('saves/enriched.json')
                blog = allocatealliedkeywords.main(blog)
                blog = allocateinterlinks.main(blog)
                blog = conclusiontitle.main(blog)
                save(blog,'saves/conclusiontitle.json')
                preference = dict()
                preference = {'intro':'tk','products':'hps','conclusion':'hk','faqs':'hk'}
                blog = writefirstblog.main(blog,preference)
                blog = duplicate.main(blog)
                print(json.dumps(blog,indent=4))
                insertblog(blog,con,cur)
                print('blog saved to db')
                #exit()
        n = 600
        print('sleeping',n,'seconds')
        time.sleep(n)

if __name__=='__main__':
    main(con,cur)
