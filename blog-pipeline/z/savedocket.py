import psycopg2
import pandas as pd

con = psycopg2.connect(dbname='pipe', user='akshit', password='Akshit@DB2026', host='localhost', port='5432')
cur = con.cursor()


def download(jobid, dockettype, cur):
    cur.execute('select keyword from jobs where id=%s;', (jobid,))
    name = dockettype+'docket_' + (cur.fetchone()[0]).replace(' ','_').lower() + '.xlsx'
    #name = dockettype+'docket_' + (cur.fetchone()[0]).replace(' ','_').lower().strip() + '.xlsx'
    if dockettype == 'auto':
        cur.execute('select autodocket from dockets where jobs_id=%s;', (jobid,))
    if dockettype == 'final':
        cur.execute('select finaldocket from dockets where jobs_id=%s;', (jobid,))
    result = cur.fetchone()
    if result and result[0]:
        file = result[0]
        return file,name

def main():
    jobid = 'faff32fd-fae5-4e28-9479-19258ce88f00'
    file,name = download(jobid, 'auto', cur)
    print(file)
    print(name)
    exit()
    cur.execute('select autodocket from dockets where jobs_id=%s;', (jobid,))
    result = cur.fetchone()
    file = result[0]
    df = pd.read_excel(file)
    


main()
