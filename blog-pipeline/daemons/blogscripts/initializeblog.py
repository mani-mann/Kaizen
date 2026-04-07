import copy

GEN = {
        'writer': None,
        'text': None,
        'detection': None,
        'alliedkeywords': None,
        'interlink': None,
        }

TWIN = {
        'current': copy.deepcopy(GEN),
        'previous': None,  # NOTE becoming same as current at some point is its ultimate fate
        }

PD = {
        'title': None,
        'raw': None,
        'productlink': None,
        'imagelink': None,
        'description': copy.deepcopy(TWIN),
        }

CONC = {
        'title': None,
        'content': copy.deepcopy(TWIN)
        }

FAQ = {
        'question': None,
        'answer': copy.deepcopy(TWIN),
        }

FAQS = {
        'title': None,
        'list': list()
        }

MAIN = {
        'title': None,
        'intro': copy.deepcopy(TWIN),
        'products': list(),
        'conclusion': copy.deepcopy(CONC),
        'faqs': copy.deepcopy(FAQS),
        }

BLOG = {
        'jobid': None,
        'keyword': None,
        'alliedkeywords': list(),
        'interlinks': dict(),
        'main': copy.deepcopy(MAIN),
        }

def main(docket):
    blog = copy.deepcopy(BLOG)
    blog['jobid'] = docket['jobid']
    blog['keyword'] = docket['keyword']
    blog['main']['title'] = docket['title']
    for i,p in enumerate(docket['products']):
        pd = copy.deepcopy(PD)
        pd['title'] = 'Template ' + str(i+1) + ': ' + p['title']
        pd['productlink'] = p['link']
        blog['main']['products'].append(pd)
    blog['main']['faqs']['title'] = 'FAQs on ' + (blog['keyword']).capitalize()
    for f in docket['faqs']:
        faq = copy.deepcopy(FAQ)
        faq['question'] = f
        blog['main']['faqs']['list'].append(faq)
    blog['alliedkeywords'] = docket['alliedkeywords']
    for bloglink in docket['blogs']:
        blog['interlinks'][bloglink] = None
    return blog
