import requests
import io
from PIL import Image
import time
import base64
from bs4 import BeautifulSoup

def isdummyimage(url):
    time.sleep(5)  # NOTE throttling
    response = requests.get(url)
    img = Image.open(io.BytesIO(response.content))
    width,height = img.size
    if (width,height) == (262,262):
        return True
    else:
        return False

#AI
def get_og_image(url: str) -> str | None:
    """
    Fetches the given URL and returns the og:image content link if found.
    """
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Find the meta tag with property="og:image"
        meta_tag = soup.find("meta", property="og:image")

        if meta_tag and meta_tag.get("content"):
            return meta_tag["content"]

        return None

    except requests.RequestException as e:
        print(f"Error fetching URL: {e}")
        return None

# new function to fetch images template that uses just the og image url
def getproductimageurltemplate(url):
    return (get_og_image(url)).replace('01','{index}')

# this function isnt perfect. the '#' at the end of url caused trouble for the system as # is now included inside the image url instead of acting as a frag character. this function is now deprecated. only og url will be used for now to test and see its resilience
def xgetproductimageurltemplate(url):
    # NOTE from experiment, two image urls have been noticed. one which ends with slide01.jpg and other which ends with Slide01.jpg
    productcode = url.replace('https://www.slideteam.net/','').replace('.html','').replace('-','_')
    imageurl0 = 'https://slideteam.net/media/catalog/product/cache/1280x720/' + productcode[0] + '/' + productcode[1] + '/' + productcode + '_slide{index}.jpg'
    imageurl1 = 'https://slideteam.net/media/catalog/product/cache/1280x720/' + productcode[0] + '/' + productcode[1] + '/' + productcode + '_Slide{index}.jpg'
    if not isdummyimage(imageurl0.replace('{index}','01')):
        return imageurl0
    elif not isdummyimage(imageurl1.replace('{index}','01')):
        return imageurl1
    else:
        return (get_og_image(url)).replace('01','{index}')

def getproductpagedescription(url):
    try:
        # Fetch page content
        time.sleep(5)
        response = requests.get(url, timeout=10)
        response.raise_for_status()  # raise exception for bad responses
        # Parse HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        # Find element with id='maintext'
        maintext_element = soup.find(id='maintext')
        if maintext_element:
            return maintext_element.get_text(strip=True)
        else:
            return "No element with id='maintext' found on this page."
    except requests.exceptions.RequestException as e:
        return f"Error fetching URL: {e}"

def combinedescriptions(descriptions):
    print('combine descriptions')
    descriptions = '\n\n'.join(descriptions)
    #prompt = 'read the descriptions of slides of a ppt template and write a brief on its best features under 50 words: \n\n' + descriptions
    prompt = 'read the descriptions of slides of a ppt template and write a brief on its best features under 50 words with a focus on what makes it unique: \n\n' + descriptions
    response = requests.post('http://127.0.0.1:2100/anthropic/claude-sonnet-4', json={'prompt':prompt})
    print(response.json())
    combineddescription = (response.json())['response']
    print('comb:', combineddescription)
    return combineddescription

def urllinktodesc(imageurls):
    time.sleep(10)
    descriptions = []
    for imageurl in imageurls:
        print('imageurl:',imageurl)
        #response = requests.post('http://127.0.0.1:2100/openai/gpt-5-nano/vision/url', json={'prompt':'Give title and brief about the features of this slide template','imageurl':imageurl})
        #response = requests.post('http://127.0.0.1:2100/openai/gpt-5-nano/vision/url', json={'prompt':'Give title and brief about the visual elements of this slide template','imageurl':imageurl})
        #response = requests.post('http://127.0.0.1:2100/openai/gpt-5-nano/vision/url', json={'prompt':'Give title and brief about the visual elements of this slide template. Do not mention colors.','imageurl':imageurl})
        print('response came')
        description = (response.json())['response']
        print('desc:',description)
        descriptions.append(description)
    return descriptions

def getbase64image(url):
    response = requests.get(url)
    base64image = base64.b64encode(response.content).decode("utf-8")
    return base64image

def getdescriptions(imageurls):
    print('OGRAW')
    descriptions = []
    for imageurl in imageurls:
        print('imageurl:',imageurl)
        base64image = getbase64image(imageurl)
        #response = requests.post('http://127.0.0.1:2100/openai/gpt-5-nano/vision/base', json={'prompt':'Give title and brief about the features of this slide template','imageurl':base64image})
        #response = requests.post('http://127.0.0.1:2100/openai/gpt-5-nano/vision/base', json={'prompt':'Give title and short description about the visual elements of this slide template.','imageurl':base64image})
        response = requests.post('http://127.0.0.1:2100/openai/gpt-5-nano/vision/base', json={'prompt':'Give title and short description about the unique visual elements of this slide template without mentioning colors.','imageurl':base64image})
        print('response came')
        description = (response.json())['response']
        print('desc:',description)
        descriptions.append(description)
    return descriptions

def tostr(index):
    if index<10:
        return '0' + str(index)
    else:
        return str(index)

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
    return imageurls

def main(blog,imagelimit):
    for i in range(len(blog['main']['products'])):
        plink = blog['main']['products'][i]['productlink']
        imageurltemplate = getproductimageurltemplate(plink)
        blog['main']['products'][i]['imagelink'] = imageurltemplate.replace('{index}','01')
        blog['main']['products'][i]['raw'] = combinedescriptions(getdescriptions(getimageurls(imageurltemplate,imagelimit)))
        print(blog['main']['products'][i])
    return blog

if __name__=='__main__':
    print(combinedescriptions(['this slide is about sales funnel','this slide is about profit and loss margins']))
