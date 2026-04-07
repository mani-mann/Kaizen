import psycopg2

#con = psycopg2.connect(dbname='pipe', user='postgres', password='Rahul@143Modi', host='localhost', port='5432')
#cur = con.cursor()
con = psycopg2.connect(dbname='pipe', user='akshit', password='Akshit@DB2026', host='localhost', port='5432')
cur = con.cursor()

import time
import requests

import pandas as pd
from io import BytesIO

import base64

DOCKETAPI = 'http://127.0.0.1:2200/'

def addtitlesheet(docketfile, keyword, title):
    dfdict = pd.read_excel(docketfile, sheet_name=None)  # gather all sheets as dict
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        for sheetname,df in dfdict.items():
            df.to_excel(writer, index=False, sheet_name=sheetname)
        metadatadf.to_excel(writer, index=False, sheet_name='Title')
    output.seek(0)
    completedocket = output.getvalue()
    return completedocket

def addsheets(docketfile, jobid, keyword, title):
    dfdict = pd.read_excel(docketfile, sheet_name=None)  # gather all sheets as dict
    titledf = pd.DataFrame({'Keyword':[keyword],'Title':[title]})
    metadatadf = pd.DataFrame({'Job ID': [jobid]})
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        for sheetname,df in dfdict.items():
            df.to_excel(writer, index=False, sheet_name=sheetname)
        titledf.to_excel(writer, index=False, sheet_name='Title')
        metadatadf.to_excel(writer, index=False, sheet_name='Metadata')
    output.seek(0)
    completedocket = output.getvalue()
    return completedocket

while True:
    sleeptimer = 100
    cur.execute('select j.id,j.keyword,j.title,d.autodocket is not null as isexists_autodocket from jobs as j left join dockets as d on j.id=d.jobs_id;')
    results = cur.fetchall()
    for row in results:
        jobid = row[0]
        keyword = row[1]
        title = row[2]
        isexists_autodocket = row[3]
        if isexists_autodocket == False:
            print('generating for :',keyword)
            #try:
            response = requests.post(DOCKETAPI, json={'inputkeyword':keyword,'outputfilterkeywords':''})
            autodocketfile = (response.json()).get('base64xlsx')
            autodocketfile = BytesIO(base64.b64decode(autodocketfile))
                #autodocketfile = addtitlesheet(autodocketfile, keyword, title)
                #autodocketfile = addmetadatasheet(autodocketfile, jobid)
            autodocketfile = addsheets(autodocketfile, jobid, keyword, title)
            cur.execute('insert into dockets (jobs_id,autodocket) values (%s,%s);', (jobid,psycopg2.Binary(autodocketfile)))
            con.commit()
            try:
                print('done')
            except Exception as e:
                print(f'exception occured for jobid {jobid}, keyword {keyword}:',e)
                print(f'sleeping {sleeptimer} seconds...')
                time.sleep(sleeptimer)
            print('sleeping 10 seconds...')
            time.sleep(10)  # let it breath
    print('no more null autodockets. sleeping...')
    time.sleep(sleeptimer)
