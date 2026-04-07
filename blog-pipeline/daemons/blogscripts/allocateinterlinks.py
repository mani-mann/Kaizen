import requests
from bs4 import BeautifulSoup
import copy
import json

PROMPTSUMMARIZEBLOG = 'give a crisp one paragraph summary: '

def fetchblogcontent(url: str) -> str:
    """
    Fetches a webpage and returns text under <div class="post-content">.
    """
    response = requests.get(url, timeout=10)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    post_div = soup.find("div", class_="post-content")
    if not post_div:
        return ""

    # Remove unwanted tags inside the div
    for element in post_div(["script", "style", "noscript"]):
        element.decompose()

    text = post_div.get_text(separator=" ")
    return " ".join(text.split())

def getblogsummary(url):
    content = fetchblogcontent(url)
    prompt = copy.deepcopy(PROMPTSUMMARIZEBLOG)
    prompt += content
    response = requests.post('http://127.0.0.1:2100/openai/gpt-4o-mini', json={'prompt':prompt})
    response = (response.json())['response']
    print('blog summary :',response)
    return response

def summarizeinterlinks(blog):
    for url in blog['interlinks'].keys():
        blog['interlinks'][url] = getblogsummary(url)
    return blog

# -----------------------------

PROMPTMATCH = """
blogs:
{blogsjson}

products:
{productsjson}

task: you are to match the blogs with products to that those blogs can be hyperlinked to product based on similar words and content. pick the best pairs, and respond in json as [[<blogs index>, <product index>]]. all blogs must be used atleast once and once only. now write out the json directly
"""

def getproductraws(blog):
    results = []
    for i in range(len(blog['main']['products'])):
        results.append({'index':i,'description':blog['main']['products'][i]['raw']})
    return results

def getinterlinksummaries(blog):
    results = []
    keys = list(blog['interlinks'].keys())
    for i in range(len(keys)):
        results.append({'index':i,'summary':blog['interlinks'][keys[i]]})
    return results

def matchinterlinks(blog):
    productsjson = json.dumps(getproductraws(blog))
    blogsjson = json.dumps(getinterlinksummaries(blog))
    response = requests.post('http://127.0.0.1:2100/openai/gpt-4o-mini', json={'prompt':PROMPTMATCH.replace('{blogsjson}',blogsjson).replace('{productsjson}',productsjson)})
    matches = (response.json())['response']
    matches = matches.replace('```json','').replace('```','').strip()
    print('matches :',matches)
    matchlist = json.loads(matches)
    keylinks = list(blog['interlinks'].keys())
    for match in matchlist:
        blog['main']['products'][match[1]]['description']['current']['interlink'] = keylinks[match[0]]
    return blog

# -----------------------------

def main(blog):
    blog = summarizeinterlinks(blog)
    blog = matchinterlinks(blog)
    return blog
