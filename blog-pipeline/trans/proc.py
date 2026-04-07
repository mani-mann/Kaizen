import json
import copy
import requests
import psycopg2

con = psycopg2.connect(dbname='pipe', user='akshit', password='Akshit@DB2026', host='localhost', port='5432')
cur = con.cursor()

langs = {'pt':'Portuguese',
             'ja':'Japanese',
             'es':'Spanish',
             'ar':'Arabic',
             'fr':'French',
             'ko':'Korean',
             'de':'German'
             }

def getnecessaryblog(blogjson):
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
    #necessaryblogjson = json.dumps(nb,indent=4)
    #return necessaryblogjson
    return nb

def getnextblog(con,cur):
    cur.execute('select t.id,b.blog,t.langcode from translations as t inner join blogs as b on t.jobs_id=b.jobs_id where b.ispublished=true and t.blogjson is null limit 1;')
    result = cur.fetchone()
    tid = result[0]
    blog = getnecessaryblog(result[1])
    langcode = result[2]
    return tid,blog,langcode

def infer(prompt, model='translategemma:4b'):
    url = 'http://localhost:11434/api/generate'
    headers = {
            'Content-Type': 'application/json',
            }
    data = {
            'model': model,
            'prompt': prompt,
            'think': False,
            'stream': False,
            'options': {
                'num_thread': 3,
                }
            }
    response = requests.post(url, headers=headers, data=json.dumps(data))
    responsedict = response.json()
    airesponsetext = responsedict['response']
    airesponsetext = airesponsetext.replace('*','')
    airesponsetext = airesponsetext.strip()
    return airesponsetext

def getprompt(text, tolang, tolangcode):
    prompt = f"""Translate the following text from English (en) to {tolang} ({tolangcode}) : {text}"""
    prompt = f"""You are a professional English (en) to {tolang} ({tolangcode}) translator. Your goal is to accurately convey the meaning and nuances of the original English text while adhering to {tolang} grammar, vocabulary, and cultural sensitivities.
Produce only the {tolang} translation, without any additional explanations or commentary. Please translate the following English text into {tolang}:


{text}"""
    return prompt

def getproductprompt(text, tolang, tolangcode):
    prompt = f"""Translate the following text from English (en) to {tolang} ({tolangcode}). You must preserve the <a> HTML tags in the translated text.:


{text}"""
    return prompt

def translateblog(blog,langcode):
    lc = langcode
    trans = copy.deepcopy(blog)
    trans['title'] = infer(getprompt(trans['title'],langs[lc],lc))
    print(trans['title'])
    trans['intro'] = infer(getprompt(trans['intro'],langs[lc],lc))
    print(trans['intro'])
    for i in range(len(trans['products'])):
        trans['products'][i]['title'] = infer(getprompt(trans['products'][i]['title'], langs[lc], lc))
        print(trans['products'][i]['title'])
        trans['products'][i]['description'] = infer(getproductprompt(trans['products'][i]['description'], langs[lc], lc))
        print(trans['products'][i]['description'])
    trans['conclusion']['title'] = infer(getprompt(trans['conclusion']['title'],langs[lc],lc))
    print(trans['conclusion']['title'])
    trans['conclusion']['content'] = infer(getprompt(trans['conclusion']['content'],langs[lc],lc))
    print(trans['conclusion']['content'])
    trans['faqs']['title'] = infer(getprompt(trans['faqs']['title'],langs[lc],lc))
    print(trans['faqs']['title'])
    for i in range(len(trans['faqs']['list'])):
        trans['faqs']['list'][i]['question'] = infer(getprompt(trans['faqs']['list'][i]['question'], langs[lc], lc))
        print(trans['faqs']['list'][i]['question'])
        trans['faqs']['list'][i]['answer'] = infer(getprompt(trans['faqs']['list'][i]['answer'], langs[lc], lc))
        print(trans['faqs']['list'][i]['answer'])
    return trans

def savetranslation(tid,translatedblogjson,con,cur):
    cur.execute('update translations set blogjson=%s where id=%s;', (translatedblogjson,tid))
    con.commit()
    print('committed')

def main():
    tid,blog,langcode = getnextblog(con,cur)
    print(tid,'-',langcode)
    translatedblog = translateblog(blog,langcode)
    translatedblogjson = json.dumps(translatedblog, indent=4)
    savetranslation(tid,translatedblogjson, con, cur)

if __name__=='__main__':
    while True:
        main()
    #print(infer('hello','qwen2.5:0.5b'))
