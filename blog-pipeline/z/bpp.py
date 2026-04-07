import psycopg2
 
con = psycopg2.connect(dbname='bigdata', user='slideteam', password='slideteam2026', host='164.52.192.205', port='5432')
cur = con.cursor()

def
