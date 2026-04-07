import psycopg2

con = psycopg2.connect(dbname='pipe', user='akshit', password='Akshit@DB2026', host='localhost', port='5432')
cur = con.cursor()

languages = ['Portuguese', 'Japanese', 'Spanish', 'Arabic', 'English', 'French', 'Korean', 'German']
langcodes = ['pt', 'ja', 'es', 'ar', 'fr', 'ko', 'de']

def main(con,cur):
    cur.execute('select j.id from jobs as j inner join blogs as b on j.id=b.jobs_id where ispublished=true;')
    result = cur.fetchall()
    for r in result:
        jobid = r[0]
        for lc in langcodes:
            cur.execute('insert into translations (jobs_id, langcode) values (%s,%s);', (jobid,lc))
    con.commit()

main(con,cur)
