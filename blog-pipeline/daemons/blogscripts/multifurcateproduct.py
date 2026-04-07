import requests
import io
from PIL import Image
import time
import base64
import copy
import json

def isdummyimage(url):
    time.sleep(2)  # NOTE throttling
    response = requests.get(url)
    img = Image.open(io.BytesIO(response.content))
    width,height = img.size
    if (width,height) == (262,262):
        return True
    else:
        return False

def getimageurl(imageurltemplate, index):
    if index < 10:
        imageurl = imageurltemplate.replace('{index}','0'+str(index))
    else:
        imageurl = imageurltemplate.replace('{index}',str(index))
    return imageurl

def getlastslideindex(imageurltemplate,limit):
    index = 0
    for i in range(limit):
        index = i+1
        print(index)
        imageurl = getimageurl(imageurltemplate, index)
        if isdummyimage(imageurl):
            return index-1
    return index

def getbase64image(url):
    time.sleep(2)  # NOTE throttling
    response = requests.get(url)
    base64image = base64.b64encode(response.content).decode("utf-8")
    return base64image

def getraw(base64image):
    #response = requests.post('http://127.0.0.1:2100/openai/gpt-5-nano/vision/base', json={'prompt':'Give title and brief about the features of this slide template','imageurl':base64image})
    response = requests.post('http://127.0.0.1:2100/openai/gpt-5-nano/vision/base', json={'prompt':'Give title and brief about the visual elements of this slide template','imageurl':base64image})
    print('response came')
    raw = (response.json())['response']
    print('raw:',raw)
    return raw

def gettitle(raw):
    response = requests.post('http://127.0.0.1:2100/openai/gpt-4o-mini', json={'prompt':'Only give the main title from following text :\n'+raw})
    title = (response.json())['response']
    print('title:', title)
    return title

def getranks(rawlist):
    rawtext = ''
    for i in range(len(rawlist)):
        index = i+1
        rawtext = rawtext + 'INDEX: ' + str(index) + '\n'
        rawtext = rawtext + 'Description: ' + rawlist[i] + '\n\n\n'
    #prompt = 'Given the brief descriptions of slides above, you must rank their indices from most valuable to least valuable according to their uniqueness. Indices should be seperated by newlines. Now, only list the order of indices:\n'
    prompt = 'Given the brief descriptions of slides above, you must rank their indices such that slides with most visual elements are ranked highest. Indices should be seperated by newlines. Now, only list the order of indices:\n'
    fullprompt = rawtext + prompt
    print(fullprompt)
    response = requests.post('http://127.0.0.1:2100/openai/gpt-4o-mini', json={'prompt':fullprompt})
    rankstext = (response.json())['response']
    rankslist = rankstext.splitlines()
    rankslist = [int(r) for r in rankslist if r.strip()!=None]
    return rankslist

# ---

def tostr(index):
    if index<10:
        return '0' + str(index)
    else:
        return str(index)

# NOTE for single product enrichment, pick [1,n] products
def getimageurls(imageurltemplate,imagelimit):
    # NOTE binary search later for optimization
    imageurls = []
    for index in range(1,imagelimit+1):
        imageurl = imageurltemplate.replace('{index}',tostr(index))
        print(imageurl)
        if isdummyimage(imageurl):
            return imageurls
        else:
            imageurls.append(imageurl)
    imageurls = sorted(imageurls) # NOTE this should solve the ACP blog random sequence issue
    return imageurls

def getimagebaselist(imageurls):
    imagebaselist = list()
    for iu in imageurls:
        print(iu)
        imagebaselist.append(getbase64image(iu))
    return imagebaselist

def getimageranks(keyword,imagebaselist):
    prompt = f'These are the slide images of a PPT template on "{keyword}". You must rank them on basis of USP and functional utility they offer for purposes solved by this ppt, with a focus on visual elements of a slide. Rank them using their indexes seperated by newlines. Output only the ranks, nothing else.'
    response = requests.post('http://127.0.0.1:2100/anthropic/claude-opus-4-6/vision/base/list', json={'prompt':prompt,'imagebaselist':imagebaselist})
    ranks = (response.json())['response']
    ranks = ranks.splitlines()
    ranks = [int(r) for r in ranks]
    print('PRERANKS:',ranks)
    ranks = [r+1 for r in ranks]  # becayse first image was never there, and images are indexed from 1 in image list ai api
    ranks = [r+1 for r in ranks]  # NOTE added one more because llm may be 0 indexing
    return ranks

def getimageraws(keyword,imagebaselist):
    prompt = f'Given the images of a PPT template slides on "{keyword}", your task is to briefly describe its USP and functional utility it offers as a template in a list of index-description pairs as [[<index>,<description>]] in JSON'
    response = requests.post('http://127.0.0.1:2100/anthropic/claude-opus-4-6/vision/base/list', json={'prompt':prompt,'imagebaselist':imagebaselist})
    rawsjson = (response.json())['response']
    rawsjson = rawsjson.replace('```json','').replace('```','')
    print(rawsjson)
    raws = json.loads(rawsjson)
    raws = [r[1] for r in raws]
    return raws

def expand(blog, ranks, titlelist, rawlist, imagelinks):
    productlink = blog['main']['products'][0]['productlink']
    description = {'current': {'writer': None, 'text': None, 'detection': None, 'alliedkeywords': None, 'interlink': None}, 'previous': None}
    for i in range(len(ranks)):
        index = i + 2
        title = 'Template ' + str(index) + ': ' + titlelist[i]
        raw = rawlist[i]
        imagelink = imagelinks[i]
        preimagelinks = [p['imagelink'] for p in blog['main']['products']]
        print('LINX:')
        print(imagelink)
        print(preimagelinks)
        if imagelink in preimagelinks:
            print('LINK ALREADY EXISTS !')
            #exit()
        product = {'title':title,'raw':raw,'productlink':productlink,'imagelink':imagelink,'description':copy.deepcopy(description)}
        blog['main']['products'].append(product)
    return blog

def main(blog,slidelimit,ranklimit):
    imageurltemplate = (blog['main']['products'][0]['imagelink']).replace('01','{index}')
    keyword = blog['keyword']
    imagelinks = getimageurls(imageurltemplate, slidelimit+1)
    imagelinks = imagelinks[1:]  # ignoring the first slide NOTE something is serioyusly wrong
    imageb64list = getimagebaselist(imagelinks)
    imagerankindices = getimageranks(keyword,imageb64list)
    imagerankindices = imagerankindices[:ranklimit]
    imagerankindices = sorted(imagerankindices)
    print('RANKS:',imagerankindices)
    rankimagelinks = [getimageurl(imageurltemplate,index) for index in imagerankindices]
    print('LINKS:',rankimagelinks)
    imageraws = getimageraws(keyword,getimagebaselist(rankimagelinks))
    print('RAWS:',imageraws)
    #imagetitles = getimagetitles(imageraws)
    imagetitles = list(map(gettitle, imageraws))
    print('TITLES:',imagetitles)
    blog = expand(blog,imagerankindices,imagetitles,imageraws,rankimagelinks) 
    print(json.dumps(blog,indent=4))
    return blog
