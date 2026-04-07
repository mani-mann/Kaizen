import psycopg2
import json

# --------------------------------------------------------------

xcon = psycopg2.connect(dbname='pipe', user='postgres', password='Rahul@143Modi', host='localhost', port='5432')
xcur = xcon.cursor()

pcon = psycopg2.connect(dbname='publish', user='ashutosh', password='qazwsx01', host='localhost', port='5432')
pcur = pcon.cursor()


def createptables():
    pcur.execute("create table publish (jobid uuid primary key, blogurl varchar(2048) unique not null, blogjson text not null, writeremail varchar(256) not null, writername varchar(256) not null, writerpictureurl varchar(2048) not null, status varchar(128) not null default 'unuploaded');")
    pcon.commit()

def getnecessaryblogjson(blogjson):
    blog = json.loads(blogjson)
    nb = dict()
    nb['title'] = blog['main']['title']
    nb['intro'] = blog['main']['intro']['current']['text']
    nb['products'] = list()
    for i in range(len(blog['main']['products'])):
        nb['products'].append({'title':blog['main']['products'][i]['title'],'imagelink':blog['main']['products'][i]['imagelink'],'productlink':blog['main']['products'][i]['productlink'],'description':blog['main']['products'][i]['description']['current']['text']})
    nb['conclusion'] = {'title':blog['main']['conclusion']['title'],'content':blog['main']['conclusion']['content']['current']['text']}
    nb['faqs'] = {'title':blog['main']['faqs']['title'],'list':list()}
    for i in range(len(blog['main']['faqs']['list'])):
        nb['faqs']['list'].append({'question':blog['main']['faqs']['list'][i]['question'],'answer':blog['main']['faqs']['list'][i]['answer']['current']['text']})
    necessaryblogjson = json.dumps(nb,indent=4)
    return necessaryblogjson

def getblogurl(blogtitle):
    blogurl = 'https://www.slideteam.net/blog/' + (blogtitle.lower()).replace(' ','-')
    return blogurl

def insertpublish(keyword):
    xcur.execute('select jobs_id,blog from blogs where jobs_id=(select id from jobs where keyword=%s);', (keyword,))
    result = xcur.fetchone()
    jobid = str(result[0])
    blogjson = result[1]
    necessaryblogjson = getnecessaryblogjson(blogjson)
    print(necessaryblogjson)
    #blogurl = 'https://www.slideteam.net/blog/top-10-webinar-slide-templates-with-examples-and-samples'
    #blogurl = 'https://www.slideteam.net/blog/top-10-anatomy-slide-templates-with-examples-and-samples'
    blogurl = getblogurl((json.loads(necessaryblogjson))['title'])
    print(blogurl)
    writeremail = 'hanisha.kapoor@slidetech.in'
    writername = 'Hanisha Kapoor'
    writerpictureurl = 'https://www.slideteam.net/wp/wp-content/uploads/userphoto/32.thumbnail.jpeg'
    pcur.execute('insert into publish (jobid,blogurl,blogjson,writeremail,writername,writerpictureurl) values (%s,%s,%s,%s,%s,%s);', (jobid,blogurl,necessaryblogjson,writeremail,writername,writerpictureurl))
    pcon.commit()

def main():
    #createptables()
    #exit()
    import sys
    keyword = sys.argv[1]
    insertpublish(keyword)
    exit()
    #xcur.execute('select blog from blogs where jobs_id=(select id from jobs where keyword=%s);', ('business contigency plan',))
    xcur.execute('select blog from blogs where jobs_id=(select id from jobs where keyword=%s);', ('',))
    blogjson = xcur.fetchone()[0]
    print(blogjson)

if __name__=='__main__':
    main()
