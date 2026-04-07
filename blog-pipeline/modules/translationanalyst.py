import json
import zipfile
import requests
import io
from PIL import Image
import time
import psycopg2
import imagehash


con = psycopg2.connect(dbname='pipe', user='akshit', password='Akshit@DB2026', host='localhost', port='5432')
cur = con.cursor()


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

def getpureblog(jobid,cur):
    cur.execute('select blogjson from translations where id=%s;', (jobid,))
    blogjson = cur.fetchone()[0]
    #necessaryblogjson = getnecessaryblogjson(blogjson)
    necessaryblog = json.loads(blogjson)
    return necessaryblog

def fetchimagebytes(imagelink):
    time.sleep(1)
    response = requests.get(imagelink)
    imagebytes = io.BytesIO(response.content)
    return imagebytes

def jpgtopng(jpgbytes):
    jpgimage = Image.open(jpgbytes)
    pngbytes = io.BytesIO()
    jpgimage.save(pngbytes, format='PNG')
    pngbytes.seek(0)
    return pngbytes

def createpngzip(pngimagenames, pngimagebyteslist):
    pngzip = io.BytesIO()
    with zipfile.ZipFile(pngzip, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name, img_buffer in zip(pngimagenames, pngimagebyteslist):
            img_buffer.seek(0)
            zf.writestr(name, img_buffer.read())
    pngzip.seek(0)
    return pngzip

def getpngzip(jobid,cur):
    blog = getpureblog(jobid,cur)
    jpgimagelinks = list()
    for p in blog['products']:
        jpgimagelinks.append(p['imagelink'])
    jpgimagebyteslist = list(map(fetchimagebytes, jpgimagelinks))
    pngimagebyteslist = list(map(jpgtopng, jpgimagebyteslist))
    pngimagenames = list()
    for p in blog['products']:
        pngimagenames.append(((p['title']).lower()).replace(' ','_').replace(':','') + '.png')
    pngzip = createpngzip(pngimagenames, pngimagebyteslist)
    pngzipfilename = ((blog['title']).lower()).replace(' ','_') + '.zip'
    return pngzipfilename,pngzip

# HTML CONVERT
# --------------------------------

def isdummyimage(url):
    response = requests.get(url)
    img = Image.open(io.BytesIO(response.content))
    width,height = img.size
    if (width,height) == (262,262):
        return True
    else:
        return False

def getimagedimensions(url):
    response = requests.get(url)
    img = Image.open(io.BytesIO(response.content))
    width,height = img.size
    return (width,height)

def isstub(url):
    response = requests.get(url)
    img = Image.open(io.BytesIO(response.content))
    width,height = img.size
    if (width,height) == (262,262):
        return True
    stubhashdict = {
            # https://www.slideteam.net/developing-marketing-technology-stack-diagram-l1817-ppt-powerpoint-templates.html
            'ee2cb169ec336434':'https://www.slideteam.net/media/catalog/product/cache/1280x720/d/e/developing_marketing_technology_stack_diagram_l1817_ppt_powerpoint_templates_slide02.jpg',
            # https://www.slideteam.net/software-technology-stack-editable-3d-diagram.html
            'bfb0c4e4311bd0e5':'https://www.slideteam.net/media/catalog/product/cache/1280x720/s/o/software_technology_stack_editable_3d_diagram_Slide02.jpg',
            '9f62e01c1ee0b5b5':'https://www.slideteam.net/media/catalog/product/cache/1280x720/s/o/software_technology_stack_editable_3d_diagram_Slide03.jpg',
            '9a1ba5e15a1eb5e0':'https://www.slideteam.net/media/catalog/product/cache/1280x720/s/o/software_technology_stack_editable_3d_diagram_Slide04.jpg',
            'a43bfe2abb062874':'https://www.slideteam.net/media/catalog/product/cache/1280x720/s/o/software_technology_stack_editable_3d_diagram_Slide05.jpg',
            # https://www.slideteam.net/product-feasibility-and-review-ppt-sample-download.html
            'bfb0c0e4313bd0e5':'https://www.slideteam.net/media/catalog/product/cache/1280x720/p/r/product_feasibility_and_review_ppt_sample_download_Slide02.jpg',
            'fa1ea5e1c21e9435':'https://www.slideteam.net/media/catalog/product/cache/1280x720/p/r/product_feasibility_and_review_ppt_sample_download_Slide03.jpg',
            'fa0ba5e05a1eb5e0':'https://www.slideteam.net/media/catalog/product/cache/1280x720/p/r/product_feasibility_and_review_ppt_sample_download_Slide04.jpg',
            'a43bfe2abb062874':'https://www.slideteam.net/media/catalog/product/cache/1280x720/p/r/product_feasibility_and_review_ppt_sample_download_Slide05.jpg',
            # https://www.slideteam.net/amazon-swot-analysis-reveals-its-strengths-ppt-structure-at.html
            'ff20701d88da9787':'https://www.slideteam.net/media/catalog/product/cache/1280x720/a/m/amazon_swot_analysis_reveals_its_strengths_ppt_structure_at_slide28.jpg',
            'a2f4c922b6cb9d32':'https://www.slideteam.net/media/catalog/product/cache/1280x720/i/n/instruction_1.jpg',
            'c9bdb4c234d23b29':'https://www.slideteam.net/media/catalog/product/cache/1280x720/i/n/instruction_2.jpg',
            '949f37e04b983b4a':'https://www.slideteam.net/media/catalog/product/cache/1280x720/i/n/instruction_3.jpg',
            'dafbc49425ca2d94':'https://www.slideteam.net/media/catalog/product/cache/1280x720/i/n/instruction_4.jpg',
            '9376349f48c94fe0':'https://www.slideteam.net/media/catalog/product/cache/1280x720/i/n/instruction_5.jpg',
            '8ff0600ff0831ff4':'https://www.slideteam.net/media/catalog/product/cache/1280x720/i/n/instruction_6.jpg',
            '9d7332dc41dc4369':'https://www.slideteam.net/media/catalog/product/cache/1280x720/i/n/instruction_7.jpg',
            'a0fb1bc91df032f0':'https://www.slideteam.net/media/catalog/product/cache/1280x720/i/n/instruction_8.jpg',
            # https://www.slideteam.net/one-pager-material-safety-data-sheet-presentation-report-infographic-ppt-pdf-document.html
            'ed2cb232b2b26c2d':'https://www.slideteam.net/media/catalog/product/cache/1280x720/o/n/one_pager_material_safety_data_sheet_presentation_report_infographic_ppt_pdf_document_slide02.jpg',
            # https://www.slideteam.net/consulting-project-management-and-assessment-checklist.html
            'af78a169e1646467':'https://www.slideteam.net/media/catalog/product/cache/1280x720/c/o/consulting_project_management_and_assessment_checklist_slide02.jpg',
            }
    imghash = imagehash.phash(img)
    print(imghash)
    for k,v in stubhashdict.items():
        khash = imagehash.hex_to_hash(k)
        #if imghash == khash:
        if (imghash - khash) < 10:
            print(v)
            return True
    return False

def modifyinterlinktags(blog):
    for i in range(len(blog['products'])):
        d = blog['products'][i]['description']
        d = d.replace('<a', '</span><a target="_blank" rel="noopener"', 1)
        d = d.replace("'>", '\'><span style="font-weight: 400;">', 1)
        d = d.replace('</a>', '</span></a><span style="font-weight: 400;">', 1)
        blog['products'][i]['description'] = d
    return blog

def getproductid(productlink):
    response = requests.get(productlink)
    html = response.text
    print(html)
    htmllines = html.splitlines()
    for hl in htmllines:
        if 'get-Product' in hl:
            productidtag = hl.strip()
            break
    productid = productidtag.split('value="')[1]
    productid = productid.split('"')[0]
    return productid

def gethtml(blog):
    blog = modifyinterlinktags(blog)
    html = ''
    html += '<div class="post-content">'
    # INTRO
    introlines = blog['intro'].splitlines()
    for il in introlines:
        html += '<p><span style="font-weight: 400;">' + il + '</span></p>'
        #html += '<p>&nbsp;</p>'
    #html += '<p><span style="font-weight: 400;">' + blog['intro'] + '</span></p>'
    html += '<p>&nbsp;</p>'
    # PRODUCTS
    products = blog['products']
    for p in products:
        html += '<h3><b>' + p['title'] + '</b></h3>'
        html += '<p><span style="font-weight: 400;">' + p['description'] + '</span></p>'
        html += '<p>&nbsp;</p>'
        #if '01.jpg' in p['imagelink']:
        #if '01.jpg' in p['imagelink'] and isdummyimage((p['imagelink']).replace('01','02')) != True and ismatchedfingerprint((p['imagelink']).replace('01','02')) != True:
        if '01.jpg' in p['imagelink'] and isstub((p['imagelink']).replace('01','02')) != True:
            productid = getproductid(p['productlink'])
            html += '<p>' + f'[product_image id={productid}]' + '</p>'
        else:
            title = p['title']
            alt = ((title.split(':'))[1]).strip()  # get name only
            productlink = p['productlink']
            imagelink = p['imagelink']
            width,height = getimagedimensions(imagelink)  # NOTE need for this arose because of A4 (long) slides difference in dimensions, which rendered in same way
            productimagetag = f'<p><a href="{productlink}" target="_blank" rel="noopener"><img class="aligncenter size-full" title="{alt}" src="{imagelink}" alt="{alt}" width="{width}" height="{height}"/></a></p>'  # NOTE class isnt provided as its speculated that its given by wordpress itself
            html += productimagetag
            html += '<p>&nbsp;</p>'
            downloadbuttontag = f'<p style="text-align: center;"><a href="{productlink}" target="_blank" rel="noopener"><b>Download this PowerPoint Template</b></a></p>'
            html += downloadbuttontag
        html += '<p>&nbsp;</p>'
    # CONCLUSION
    html += '<h2><b>' + blog['conclusion']['title'] + '</b></h2>'
    html += '<p>&nbsp;</p>'
    html += '<p><span style="font-weight: 400;">' + blog['conclusion']['content'] + '</span></p>'
    html += '<p>&nbsp;</p>'
    # FAQ
    html += '<h2 style="text-align: center;"><b>' + blog['faqs']['title'] + '</b></h2>'
    html += '<p>&nbsp;</p>'
    for f in blog['faqs']['list']:
        html += '<h3><b>' + f['question'] + '</b></h3>'
        html += '<p>&nbsp;</p>'
        html += '<p><span style="font-weight: 400;">' + f['answer'] + '</span></p>'
        html += '<p>&nbsp;</p>'
    html += '</div>'
    return html

# TEST
# --------------------------------

def main():
    jobid = 'fcf7b32e-e231-4112-81c3-baac755b5894'
    jobid = '44c233ff-d897-40b3-a211-59e187b920c7'
    jobid = 'f824a24a-91c6-4f5a-8c5c-1c72aba1ddf0'
    jobid = 'f8261cff-6f7c-4081-8858-ae19c8e22d8e'
    jobid = 'f8a3ee53-d880-4940-a65e-929ba6f4552d'
    jobid = '2553ddb5-a579-44d4-ac17-f75a5f3db8f8'
    blog = getpureblog(jobid,cur)
    #print(json.dumps(blog,indent=4))
    html = gethtml(blog)
    print(html)

if __name__=='__main__':
    main()
    #import sys
    #isstub(sys.argv[1])
