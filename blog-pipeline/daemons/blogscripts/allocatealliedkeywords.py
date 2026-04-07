import requests

OPENAIURL = 'http://127.0.0.1:2100/openai/gpt-4o-mini'

SPRINKLEINTROPROMPT = '''
blog title:
{title}

candidate allied keywords:
{alliedkeywords}

task - pick only the few, most suitable allied keywords to be included in blog intro from the list of candidates. answer as comma seperated list of selected keywords
'''

SPRINKLEPRODUCTDESCRIPTIONPROMPT = '''
product description:
{description}

candidate allied keywords:
{alliedkeywords}

task - pick up to 3 most suitable allied keywords to be included in the product description from the list of candidates. answer as comma seperated list of selected keywords
'''

SPRINKLECONCLUSIONPROMPT = '''
theme:
{theme}

candidate allied keywords:
{alliedkeywords}

task - pick up to 2 most suitable allied keywords to be included in the conclusion for a blog on given theme from the list of candidates. answer as comma seperated list of selected keywords
'''

SPRINKLEFAQPROMPT = '''
faq:
{question}

candidate allied keywords:
{alliedkeywords}

task - pick up to 3 most suitable allied keywords corresponding to the faq from the list of candidates. answer as comma seperated list of selected keywords
'''

def sprinkleintro(blog):
    prompt = SPRINKLEINTROPROMPT.replace('{title}',blog['keyword']).replace('{alliedkeywords}',str(blog['alliedkeywords']))
    response = requests.post(OPENAIURL, json={'prompt':prompt})
    ak = (response.json())['response']
    blog['main']['intro']['current']['alliedkeywords'] = ak
    print('intro ak',ak)
    return blog

def sprinklepd(blog,index):
    prompt = SPRINKLEPRODUCTDESCRIPTIONPROMPT.replace('{description}',blog['main']['products'][index]['raw']).replace('{alliedkeywords}',str(blog['alliedkeywords']))
    response = requests.post(OPENAIURL, json={'prompt':prompt})
    ak = (response.json())['response']
    blog['main']['products'][index]['description']['current']['alliedkeywords'] = ak
    print('product ',index,ak)
    return blog

def sprinkleallpd(blog):
    print('TOTAL PPRODUCST:', len(blog['main']['products']))
    for i in range(len(blog['main']['products'])):
        blog = sprinklepd(blog,i)
    return blog

def sprinkleconclusion(blog):
    prompt = SPRINKLECONCLUSIONPROMPT.replace('{theme}',blog['keyword']).replace('{alliedkeywords}',str(blog['alliedkeywords']))
    response = requests.post(OPENAIURL, json={'prompt':prompt})
    ak = (response.json())['response']
    blog['main']['conclusion']['content']['current']['alliedkeywords'] = ak
    print('conclusion ',ak)
    return blog

def sprinklefaq(blog,index):
    prompt = SPRINKLEFAQPROMPT.replace('{question}',blog['main']['faqs']['list'][index]['question']).replace('{alliedkeywords}',str(blog['alliedkeywords']))
    response = requests.post(OPENAIURL, json={'prompt':prompt})
    ak = (response.json())['response']
    blog['main']['faqs']['list'][index]['answer']['current']['alliedkeywords'] = ak
    print('faq ',index,ak)
    return blog

def sprinkleallfaq(blog):
    for i in range(len(blog['main']['faqs']['list'])):
        blog = sprinklefaq(blog,i)
    return blog

def main(blog):
    blog = sprinkleallpd(blog)
    blog = sprinkleconclusion(blog)
    blog = sprinkleallfaq(blog)
    blog = sprinkleintro(blog)
    return blog
