import copy

def dup(a):
    return copy.deepcopy(a),copy.deepcopy(a)

# NOTE only generative fields are undo-able
def main(blog):
    blog['main']['intro']['current'],blog['main']['intro']['previous'] = dup(blog['main']['intro']['current'])
    for index in range(len(blog['main']['products'])):
        blog['main']['products'][index]['description']['current'],blog['main']['products'][index]['description']['previous'] = dup(blog['main']['products'][index]['description']['current'])
    blog['main']['conclusion']['content']['current'],blog['main']['conclusion']['content']['previous'] = dup(blog['main']['conclusion']['content']['current'])
    for index in range(len(blog['main']['faqs']['list'])):
        blog['main']['faqs']['list'][index]['answer']['current'],blog['main']['faqs']['list'][index]['answer']['previous'] = dup(blog['main']['faqs']['list'][index]['answer']['current'])
    return blog
