import requests
import base64
import json

def getbase64image(url):
    response = requests.get(url)
    base64image = base64.b64encode(response.content).decode("utf-8")
    return base64image

def extractslidetitle(base64image):
    response = requests.post('http://127.0.0.1:2100/openai/gpt-5-nano/vision/base', json={'prompt':'Give only the title of this slide image.','imagebase':base64image})
    raw = (response.json())['response']
    return raw

def main(blog):
    for i in range(len(blog['main']['products'])):
        title = blog['main']['products'][i]['title']
        ilink = blog['main']['products'][i]['imagelink']
        if '01' in ilink:
            blog['main']['products'][i]['title'] = 'Template ' + str(i+1) + ': ' + extractslidetitle(getbase64image(blog['main']['products'][i]['imagelink']))
            print(ilink,'>',title,'>',blog['main']['products'][i]['title'])
    return blog

def test():
    import psycopg2
    import json
    con = psycopg2.connect(dbname='pipe', user='akshit', password='Akshit@DB2026', host='localhost', port='5432')
    cur = con.cursor()
    cur.execute('select blog from blogs where jobs_id=(select id from jobs where keyword=%s);', ('action agenda',))
    result = cur.fetchone()
    blog = json.loads(result[0])
    blog = main(blog)

if __name__=='__main__':
    test()
