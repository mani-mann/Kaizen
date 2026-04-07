import psycopg2
 
#con = psycopg2.connect(dbname='bigdata', user='slideteam', password='slideteam@server2026#bigdata!', host='localhost', port='5432')
con = psycopg2.connect(dbname='bigdata', user='slideteam', password='slideteam@server2026#bigdata!', host='164.52.192.205', port='5432')
cur = con.cursor()
