import json
import psycopg2
import time

#con = psycopg2.connect(dbname='pipe', user='postgres', password='Rahul@143Modi', host='localhost', port='5432')
#cur = con.cursor()
con = psycopg2.connect(dbname='pipe', user='akshit', password='Akshit@DB2026', host='localhost', port='5432')
cur = con.cursor()


import blogscripts.docketfunctions as docketfunctions
import blogscripts.initializeblog as initializeblog
import blogscripts.enrichproducts as enrichproducts
import blogscripts.allocatealliedkeywords as allocatealliedkeywords
import blogscripts.allocateinterlinks as allocateinterlinks
import blogscripts.conclusiontitle as conclusiontitle
import blogscripts.writefirstblog as writefirstblog
import blogscripts.duplicate as duplicate
import blogscripts.multifurcateproduct as multifurcateproduct
import blogscripts.titles as titles

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

def hasduplicateproducts(blog):
    imagelinks = list()
    for p in blog['main']['products']:
        imagelinks.append(p['imagelink'])
    if len(imagelinks) != len(list(set(imagelinks))):
        return True
    else:
        return False

def main(con,cur):
    while True:
        jobids = docketfunctions.getjobidswithfinaldocketwithoutblog(cur)
        print('while')
        jobids = jobids[500:]
        for jobid in jobids:
            print('for')
            #time.sleep(10)
            if docketfunctions.countproducts(jobid,cur) == 1:
                print('single product')
                #continue  # NOTE one product logic. to be made later
                #pass
            #else:
            if True:
                print(jobid)
                finaldocket = docketfunctions.parsefinaldocket(jobid,cur)
                blog = initializeblog.main(finaldocket)
                print(blog['keyword'])
                try:
                    imagelimit = 30
                    #imagelimit = 5
                    blog = enrichproducts.main(blog,imagelimit)
                except Exception as e:
                    print('error occured: ', e)
                    print('continuing to next one')
                    continue
                print('ENRICHPRODUCTS:\n',blog)
                save(blog,'saves/enriched.json')
                #blog = load('saves/enriched.json')
                #exit()

                if len(blog['main']['products']) == 1:
                    print('MULTIFURCATE')
                    slidelimit = 50
                    #slidelimit = 20
                    ranklimit = 9
                    try:
                        blog = multifurcateproduct.main(blog,slidelimit,ranklimit)
                    except:
                        print('multifurcate error. skipping...')
                        continue

                #blog = load('saves/enriched.json')
                if hasduplicateproducts(blog):
                    print('DUPLICATE PRODUCTS DETECTED ! SKIPPING...')
                    continue
                blog = allocatealliedkeywords.main(blog)
                blog = allocateinterlinks.main(blog)
                blog = conclusiontitle.main(blog)
                save(blog,'saves/conclusiontitle.json')
                preference = dict()
                preference = {'intro':'tk','products':'hps_hm','conclusion':'hk','faqs':'hk_hm'}
                blog = writefirstblog.main(blog,preference)
                blog = duplicate.main(blog)
                blog = titles.main(blog)
                print(json.dumps(blog,indent=4))
                insertblog(blog,con,cur)
                print('blog saved to db')
                #exit()
        n = 600
        print('sleeping',n,'seconds')
        time.sleep(n)

if __name__=='__main__':
    main(con,cur)
