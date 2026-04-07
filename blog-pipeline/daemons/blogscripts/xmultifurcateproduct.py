import requests
import io
from PIL import Image
import time
import base64
import copy


def isdummyimage(url):
    time.sleep(5)  # NOTE throttling
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
    response = requests.get(url)
    content = response.content
    base64image = base64.b64encode(content).decode("utf-8")
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

def expand(blog, ranks, titlelist, rawlist, imagelinks):
    productlink = blog['main']['products'][0]['productlink']
    description = {'current': {'writer': None, 'text': None, 'detection': None, 'alliedkeywords': None, 'interlink': None}, 'previous': None}
    for i in range(len(ranks)):
        index = i + 2
        ri = ranks[i] - 1
        print(i,index,ri)
        title = 'Template ' + str(index) + ': ' + titlelist[ri]
        raw = rawlist[ri]
        imagelink = imagelinks[ri]
        product = {'title':title,'raw':raw,'productlink':productlink,'imagelink':imagelink,'description':copy.deepcopy(description)}
        blog['main']['products'].append(product)
    return blog

def main(blog,slidelimit,ranklimit):
    imageurltemplate = (blog['main']['products'][0]['imagelink']).replace('01','{index}')
    lastslideindex = getlastslideindex(imageurltemplate,slidelimit)
    slideindices = [i for i in range(2,lastslideindex+1)]  # NOTE starting from second slide, ignoring first one already done
    imagelinks = [getimageurl(imageurltemplate,index) for index in slideindices]
    print(imagelinks)
    imageb64list = list(map(getbase64image, imagelinks))
    #imageb64list = [getbase64image(il) for il in imagelinks]
    rawlist = list(map(getraw, imageb64list))
    print(rawlist)
    #rawlist = [getraw(b64) for b64 in imageb64list]
    titlelist = list(map(gettitle, rawlist))
    print(titlelist)
    ranks = getranks(rawlist)
    print(ranks)
    ranks = ranks[:ranklimit]
    print('RANKS:',ranks)
    blog = expand(blog, ranks, titlelist, rawlist, imagelinks)
    print(blog)
    return blog

