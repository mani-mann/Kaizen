import sqlite3
import json
import pandas as pd
from io import BytesIO

con = sqlite3.connect('sheet.db')
cur = con.cursor()

def getdfproducts(blog):
    data = {'Product Name': blog['productnames'], 'Product Url': blog['producturls']}
    df = pd.DataFrame(data=data)
    return df

def getdfblogs(blog):
    data = {'Blog Url': blog['blogurls']}
    df = pd.DataFrame(data=data)
    return df

def getdfalliedkeywords(blog):
    data = {'Allied Keywords': blog['alliedkeywords']}
    df = pd.DataFrame(data=data)
    return df

def getdffaqs(blog):
    data = {'Questions': blog['faqs']}
    df = pd.DataFrame(data=data)
    return df

def getdftitle(keyword,blog):
    data = {'Keyword': [keyword], 'Title':[blog['title']]}
    df = pd.DataFrame(data=data)
    return df

def getdfmetadata(blog, jobid):
    data = {'Job ID': [jobid]}
    df = pd.DataFrame(data=data)
    return df

#AI
def write(filepath, dfproducts, dfblogs, dfalliedkeywords, dffaqs, dftitle):
    with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
        dfproducts.to_excel(writer, sheet_name='Products', index=False)
        dfblogs.to_excel(writer, sheet_name='Blogs', index=False)
        dfalliedkeywords.to_excel(writer, sheet_name='Allied Keywords', index=False)
        dffaqs.to_excel(writer, sheet_name='FAQs', index=False)
        dftitle.to_excel(writer, sheet_name='Title', index=False)

def writexlsx(keyword,blog):
    filename = keyword.lower().replace(' ','_') + '.xlsx'
    filepath = 'xlsxdockets/' + filename
    dfproducts = getdfproducts(blog)
    dfblogs = getdfblogs(blog)
    dfalliedkeywords = getdfalliedkeywords(blog)
    dffaqs = getdffaqs(blog)
    dftitle = getdftitle(keyword,blog)
    write(filepath, dfproducts, dfblogs, dfalliedkeywords, dffaqs, dftitle)

def main():
    cur.execute('select keyword,docketjson from sheet where iscomplete=1;')
    result = cur.fetchall()
    for i,row in enumerate(result):
        keyword = row[0]
        blogjson = row[1]
        blog = json.loads(blogjson)
        writexlsx(keyword,blog)
        print(i,':',keyword)

def getbytes(dfproducts, dfblogs, dfalliedkeywords, dffaqs, dftitle, dfmetadata):
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        dfproducts.to_excel(writer, sheet_name='Products', index=False)
        dfblogs.to_excel(writer, sheet_name='Blogs', index=False)
        dfalliedkeywords.to_excel(writer, sheet_name='Allied Keywords', index=False)
        dffaqs.to_excel(writer, sheet_name='FAQs', index=False)
        dftitle.to_excel(writer, sheet_name='Title', index=False)
        dfmetadata.to_excel(writer, sheet_name='Metadata', index=False)
    output.seek(0)
    outputbytes = output.getvalue()
    return outputbytes

def getdocketbytes(blog,jobid,keyword):
    dfproducts = getdfproducts(blog)
    dfblogs = getdfblogs(blog)
    dfalliedkeywords = getdfalliedkeywords(blog)
    dffaqs = getdffaqs(blog)
    dftitle = getdftitle(keyword,blog)
    dfmetadata = getdfmetadata(blog,jobid)
    outputbytes = getbytes(dfproducts, dfblogs, dfalliedkeywords, dffaqs, dftitle, dfmetadata)
    return outputbytes

