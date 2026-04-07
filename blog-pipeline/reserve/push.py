import base64
import sqlite3
import psycopg2
from io import BytesIO
import convert
import json

con = psycopg2.connect(dbname='pipe', user='akshit', password='Akshit@DB2026', host='localhost', port='5432')
cur = con.cursor()

def getevaluators():
    with open('evaluators.txt','r') as f:
        evaltext = f.read()
    evals = evaltext.splitlines()
    return evals

def getinputs():
    scon = sqlite3.connect('sheet.db')
    scur = scon.cursor()
    scur.execute('select keyword,title,docketcreator,docketjson from sheet where iscomplete=1 and ismangal=0;')
    result = scur.fetchall()
    return result

def assignjobrole(cur,jobid,role,email):
    cur.execute('insert into jobroleassignments (jobs_id,roles_id,accounts_id) values (%s,(select id from roles where role=%s),(select id from accounts where email=%s));', (jobid,role,email))
    return

def setstatus(cur,jobid,status):
    cur.execute('insert into jobstatus (jobs_id,status_id) values (%s,(select id from status where code=%s));', (jobid,status))
    return

def main():
    inputs = getinputs()
    keywordcreator = 'ankit.vaid@slidetech.in'
    blogwriter = 'some.writer@slidetech.in'
    evaluators = getevaluators()
    for i in range(len(inputs)):
        keyword = inputs[i][0]
        title = inputs[i][1]
        docketcreator = inputs[i][2]
        docketjson = inputs[i][3]
        docketdict = json.loads(docketjson)
        cur.execute('insert into jobs (keyword,title) values (%s,%s) returning id;', (keyword,title))
        jobid = cur.fetchone()[0]
        docketbytes = convert.getdocketbytes(docketdict,jobid,keyword)
        cur.execute('insert into dockets (jobs_id,autodocket,finaldocket) values (%s,%s,%s);', (jobid,psycopg2.Binary(docketbytes),psycopg2.Binary(docketbytes)))
        evaluator = evaluators[i%len(evaluators)]
        setstatus(cur,jobid,'keyword created')
        assignjobrole(cur,jobid, 'keyword creator', keywordcreator)
        assignjobrole(cur,jobid, 'docket creator', docketcreator)
        assignjobrole(cur,jobid, 'blog writer', blogwriter)
        assignjobrole(cur,jobid, 'blog evaluator', evaluator)
        cur.execute('insert into surplus (jobs_id) values (%s);', (jobid,))
        print(i,keyword)
    con.commit()
    print('committed')

main()
