import requests

def postwriter(blog,request):
    url = "http://127.0.0.1:2300/"
    data = {'blog':blog,'request':request}
    response = requests.post(url, json=data)
    print(response)
    return response.json()

def main(blog, preference):
    # PRODUCTS
    for i in range(len(blog['main']['products'])):
        print('writing pd ',i)
        blog = postwriter(blog, {'task':'generate','part':'productdescription','index':i,'writer':preference['products'],'alliedkeywords':blog['main']['products'][i]['description']['current']['alliedkeywords'],'interlink':blog['main']['products'][i]['description']['current']['interlink']})
    # INTRO
    print('writing intro')
    blog = postwriter(blog, {'task':'generate','part':'intro','writer':preference['intro'],'alliedkeywords':blog['main']['intro']['current']['alliedkeywords'],'interlink':blog['main']['intro']['current']['interlink']})
    # CONCLUSION
    print('writing conclusion')
    blog = postwriter(blog, {'task':'generate','part':'conclusioncontent','writer':preference['conclusion'],'alliedkeywords':blog['main']['conclusion']['content']['current']['alliedkeywords'],'interlink':blog['main']['conclusion']['content']['current']['interlink']})
    # FAQS
    for i in range(len(blog['main']['faqs']['list'])):
        print('writing faq ',i)
        blog = postwriter(blog, {'task':'generate','part':'faqanswer','index':i,'writer':preference['faqs'],'alliedkeywords':blog['main']['faqs']['list'][i]['answer']['current']['alliedkeywords'],'interlink':blog['main']['faqs']['list'][i]['answer']['current']['interlink']})
    return blog
