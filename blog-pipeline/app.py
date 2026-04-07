import psycopg2

from flask import (
        Flask,
        Response,
        render_template,
        url_for,
        redirect,
        session,
        g,
        request,
        render_template_string,
        send_file,
        abort,
        make_response,
        )

import secrets

from authlib.integrations.flask_client import OAuth

import io

import copy
import os

# --------------------------------------------------------------

con = psycopg2.connect(
    dbname=os.environ.get('DB_NAME', 'pipe'),
    user=os.environ.get('DB_USER', 'akshit'),
    password=os.environ.get('DB_PASSWORD', ''),
    host=os.environ.get('DB_HOST', 'localhost'),
    port=os.environ.get('DB_PORT', '5432')
)
cur = con.cursor()

app = Flask(__name__, static_folder='static')

# AUTH
# --------------------------------------------------------------

# NOTE for google auth to work correctly, go to google console and configure the returning redirect path to the address of the app
# https://console.cloud.google.com/

app.secret_key = secrets.token_hex()

app.config['GOOGLE_CLIENT_ID'] = os.environ.get("GOOGLE_CLIENT_ID", "")
app.config['GOOGLE_CLIENT_SECRET'] = os.environ.get("GOOGLE_CLIENT_SECRET", "")
oauth = OAuth(app)
oauth.register(
        name='google',
        server_metadata_url = 'https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs = {
            #'scope':'openid email profile'
            'scope':'openid email'
            }
        )

def enrichsession(token):
    session['user'] = dict(token['userinfo'])
    cur.execute('select id from accounts where email=%s;', (session['user']['email'],))
    result = cur.fetchone()
    if result is None:
        return abort(403)
    useremailuuid = result[0]
    cur.execute('delete from impersonate where userid=%s;', (useremailuuid,))
    cur.execute('insert into impersonate (userid,actorid) values (%s,%s);', (useremailuuid,useremailuuid))
    con.commit()

# called by requirelogin()
@app.route('/auth')
def auth():
    try:
        token = oauth.google.authorize_access_token()
    except:
        return redirect(url_for('login'))
    if 'user' not in session:
        enrichsession(token)
    return redirect(session['url'])

# called by requirelogin()
@app.route('/login')
def login():
    redirecturi = url_for('auth', _external=True)
    return oauth.google.authorize_redirect(redirecturi)

# NOTE 'before_request' function will always run before any routes, unless excluded
# so the decorator works like ~
# <before_request code>
# <requsted route code>
@app.before_request
def requirelogin():
    allowedpaths = ['/login','/auth']
    if request.path not in allowedpaths:
        if 'user' not in session:  # gmail authentication
            session['url'] = request.url  # global dict ~ to take user back to where he originally requested at the end of authentication
            return redirect(url_for('login'))

def userauthorize(role):
    cur.execute('select r.role from roles as r inner join accountroles as ar on r.id=ar.roles_id inner join accounts as a on a.id=ar.accounts_id where a.email=%s;', (session['user']['email'],))
    roles = [row[0] for row in cur.fetchall()]
    if role not in roles:
        return abort(403)

def actorauthorize(role):
    user = session['user']['email']
    cur.execute('select r.role from roles as r inner join accountroles as ar on r.id=ar.roles_id where ar.accounts_id=(select i.actorid from accounts as a inner join impersonate as i on a.id=i.userid where a.email=%s);', (user,))
    result = cur.fetchall()
    roles = [row[0] for row in result]
    if len(roles)==0 or role not in roles:
        return abort(403)

# ROUTES
# --------------------------------------------------------------

import modules.root

@app.get('/')
def root():
    useremail = session['user']['email']
    actoremail = modules.admin.currentactor(useremail, cur)
    buttons = modules.root.main_get(useremail, actoremail, cur)
    return render_template('root.html', buttons=buttons)

# ADMIN
# --------------------------------------------------------------

import modules.admin

@app.get('/admin')
@app.get('/admin/')  # because chrome goes schizophrenic when it sees '/admin' in its address
def admin():
    userauthorize('admin')
    return render_template('admin.html')

@app.route('/admin/accounts', methods=['GET','POST'])
def admin_accounts():
    userauthorize('admin')
    message = None
    if request.method == 'POST':
        message = modules.admin.accounts_post(request.form, con, cur)
    roleoptions,accountrolesdict = modules.admin.accounts_get(cur)
    return render_template('admin_accounts.html', message=message, roleoptions=roleoptions, accountrolesdict=accountrolesdict)

@app.get('/admin/jobs')
def admin_jobs():
    userauthorize('admin')
    # NOTE WORK IN PROGRESS - use - keyword, status, timestamp start, timestamp last status - also has button that allows looking at full history
    return render_template('admin_jobs.html')

@app.route('/admin/impersonate', methods=['GET','POST'])
def admin_impersonate():
    userauthorize('admin')
    message = None
    if request.method == 'POST':
        actor = request.form.get('email')
        message = modules.admin.impersonate_post(session['user']['email'], actor, cur, con)
    emails = modules.admin.impersonate_get(cur)
    user = session['user']['email']
    actor = modules.admin.currentactor(user,cur)
    return render_template('admin_impersonate.html', message=message, emails=emails, user=user, actor=actor)

# KEYWORD CREATOR
# --------------------------------------------------------------

import modules.keywordcreator

@app.route('/keywordcreator', methods=['GET','POST'])
def keywordcreator():
    actorauthorize('keyword creator')
    keywordcreator = modules.admin.currentactor(session['user']['email'], cur)
    message = None
    if request.method == 'POST':
        message = modules.keywordcreator.main_post(keywordcreator, request, con, cur)
    jobdictlist = modules.keywordcreator.main_get(keywordcreator, cur)
    dropdowns = modules.keywordcreator.dropdowns(cur)
    keywords = [j['keyword'].lower().strip() for j in jobdictlist]
    nkeywords = len(keywords)
    nunique = len(list(set(keywords)))
    nduplicates = nkeywords - nunique
    return render_template('keywordcreator.html', message=message, jobdictlist=jobdictlist, dropdowns=dropdowns, nkeywords=nkeywords, nunique=nunique, nduplicates=nduplicates)

@app.route('/keywordcreator/duplicates', methods=['GET','POST'])
def keywordcreator_duplicates():
    actorauthorize('keyword creator')
    keywordcreator = modules.admin.currentactor(session['user']['email'], cur)
    message = None
    if request.method == 'POST':
        message = modules.keywordcreator.main_post(keywordcreator, request, con, cur)

    jobdictlist = modules.keywordcreator.getjobdictlist(cur)
    keywords = [j['keyword'].lower().strip() for j in jobdictlist]
    uniqlist = list(set(keywords))
    leftoutkeywords = copy.deepcopy(keywords)
    for uk in uniqlist:
        for lok in leftoutkeywords:
            if uk.lower().strip() == lok.lower().strip():
                leftoutkeywords.remove(lok)
    lokuniq = list(set(leftoutkeywords))
    jdluniq = list()
    for lu in lokuniq:
        for jd in jobdictlist:
            if lu.lower().strip() == jd['keyword'].lower().strip():
                jdluniq.append(jd)

    jdluniq = list()
    keywords = [j['keyword'] for j in jobdictlist]
    lskeywords = [j['keyword'].lower().strip() for j in jobdictlist]
    for j in jobdictlist:
        temp = [lsk for lsk in lskeywords if lsk==j['keyword'].strip().lower()]
        if len(temp) > 1:
            jdluniq.append(j)

    return render_template('keywordcreator_duplicates.html', jobdictlist=jdluniq, message=message)

@app.get('/keywordcreator/docketstatus')
def keywordcreator_docketstatus():
    actorauthorize('keyword creator')
    docketcreators = modules.keywordcreator.getdocketcreators(cur)
    return render_template('keywordcreator_docketstatus.html', docketcreators=docketcreators)

@app.post('/keywordcreator/docketstatus/docketcreator')
def keywordcreator_docketstatus_docketcreator():
    actorauthorize('keyword creator')
    email = request.form.get('email')
    statusdictlist = modules.keywordcreator.getstatusdictlist(email,cur)
    return render_template('keywordcreator_docketstatus_docketcreator.html', email=email, statusdictlist=statusdictlist)

@app.get('/keywordcreator/accounts')
def keywordcreator_accounts():
    actorauthorize('keyword creator')
    accountsxlsx = modules.keywordcreator.accounts(cur)
    return send_file(
            accountsxlsx,
            as_attachment=True,
            download_name='accounts.xlsx',
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            )

@app.get('/keywordcreator/format')
def keywordcreator_format():
    actorauthorize('keyword creator')
    formatxlsx = modules.keywordcreator.format()
    return send_file(
            formatxlsx,
            as_attachment=True,
            download_name='format.xlsx',
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            )

# DOCKET CREATOR
# --------------------------------------------------------------

import modules.docketcreator

@app.route('/docketcreator', methods=['GET','POST'])
def docketcreator():
    actorauthorize('docket creator')
    docketcreator = modules.admin.currentactor(session['user']['email'], cur)
    message = None
    if request.method == 'POST':
        message = modules.docketcreator.post(docketcreator, request.files['file'], con, cur)
    mydocketdictlist = modules.docketcreator.mydocketdictlist(docketcreator, cur)
    #selectdocketlist = modules.docketcreator.selectdocketlist(cur)  # deprecated
    return render_template('docketcreator.html', message=message, mydocketdictlist=mydocketdictlist)

@app.post('/docketcreator/download')
def docketcreator_download():
    actorauthorize('docket creator')
    file,name = modules.docketcreator.download(request.form.get('jobid'), request.form.get('type'), cur)
    return send_file(
            io.BytesIO(file),
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=name,
            )

# BLOG ALLOCATOR
# --------------------------------------------------------------

# NOTE update ~ move jobs for which blog is already made to another table with just blog evaluator option. hide ones which are out for publish

import modules.blogallocator

@app.route('/blogallocator', methods=['GET','POST'])
def blogallocator():
    message = ''
    actorauthorize('blog allocator')
    if request.method == 'POST':
        message = modules.blogallocator.post(request.form, con, cur)
    rowdictlist = modules.blogallocator.getrowdictlist(cur)
    blogwriters = modules.blogallocator.getroleaccounts('blog writer',cur)
    blogevaluators = modules.blogallocator.getroleaccounts('blog evaluator',cur)
    return render_template('blogallocator.html', message=message, rowdictlist=rowdictlist, blogwriters=blogwriters, blogevaluators=blogevaluators)

@app.post('/blogallocator/download')
def blogallocator_download():
    actorauthorize('blog allocator')
    # leveraging docket creator function for download
    file,name = modules.docketcreator.download(request.form.get('jobid'), 'final', cur)
    return send_file(
            io.BytesIO(file),
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=name,
            )

# BLOG EVALUATOR
# --------------------------------------------------------------

import modules.blogevaluator

import requests
import json

@app.get('/blogevaluator')
def blogevaluator():
    actorauthorize('blog evaluator')
    return redirect(url_for('blogevaluator_list'))

@app.get('/blogevaluator/list')
def blogevaluator_list():
    actorauthorize('blog evaluator')
    blogevaluatorid = modules.admin.currentactor(session['user']['email'], cur)
    joblist = modules.blogevaluator.getjoblist(blogevaluatorid,cur)
    return render_template('blogevaluator_list.html', joblist=joblist)

@app.get('/blogevaluator/duplicates/<keyword>')
def blogevaluator_duplicates(keyword):
    actorauthorize('blog evaluator')
    joblist = modules.blogevaluator.getduplicates(keyword,cur)
    return render_template('blogevaluator_duplicates.html', jobdictlist=joblist)


@app.route('/blogevaluator/blog/<uuid:jobid>', methods=['GET','POST'])
def blogevaluator_blog(jobid):
    actorauthorize('blog evaluator')
    jobid = str(jobid)
    if request.method=='POST':
        #jobid = request.form.get('jobid')  # something seems off with html template
        print('POST!')
        req = json.loads(request.form.get('request'))
        cur.execute('select blog from blogs where jobs_id=%s;', (jobid,))
        blog = cur.fetchone()[0]
        blog = json.loads(blog)
        url = "http://127.0.0.1:2300/"
        data = {'blog':blog,'request':req}
        response = requests.post(url, json=data)
        blog = response.json()
        blogjson = json.dumps(blog)
        cur.execute('update blogs set blog=%s where jobs_id=%s;', (blogjson,jobid))
        print('saved')
        con.commit()
    print('JOBID :',jobid)
    cur.execute('select blog from blogs where jobs_id=%s;', (jobid,))
    blog = cur.fetchone()[0]
    blog = json.loads(blog)
    jobid = blog['jobid']
    writers = {'intro':['tk','hps','hk','hk_brandintro','hk_brandintro_short'],'productdescription':['hps','hps_mm','hps_hm','tk'],'conclusioncontent':['hk'],'faqanswer':['hk','hk_hm','hps','tk']}
    return render_template('blogevaluator_blog.html', jobid=jobid, blog=blog, writers=writers)

@app.get('/blogevaluator/blog/approve/<uuid:jobid>')
def blogevaluator_blog_approve(jobid):
    actorauthorize('blog evaluator')
    jobid = str(jobid)
    cur.execute('update blogs set isapproved=true where jobs_id=%s;', (jobid,))
    cur.execute('update blogs set isdiscarded=false where jobs_id=%s;', (jobid,))
    con.commit()
    return redirect(url_for('blogevaluator_list'))

@app.post('/blogevaluator/blog/discard/<uuid:jobid>')
def blogevaluator_blog_discard(jobid):
    actorauthorize('blog evaluator')
    jobid = str(jobid)
    reason = request.form.get('discardreason')
    cur.execute('update blogs set isapproved=false where jobs_id=%s;', (jobid,))
    cur.execute('update blogs set isdiscarded=true where jobs_id=%s;', (jobid,))
    #print(reason)
    if reason.strip() not in [None,'']:
        cur.execute('update blogs set discardreason=%s where jobs_id=%s;', (reason,jobid))
    con.commit()
    return redirect(url_for('blogevaluator_list'))


# TRANSLATION ANALYST
# --------------------------------------------------------------

import modules.translationanalyst

@app.get('/translationanalyst')
def translation():
    actorauthorize('translation analyst')
    cur.execute('select t.id,j.keyword,t.langcode from jobs as j inner join translations as t on t.jobs_id=j.id where t.blogjson is not null')
    result = cur.fetchall()
    jobidkeyworddictlist = list()
    for row in result:
        jobidkeyworddictlist.append({'tid':row[0],'keyword':row[1],'langcode':row[2]})
    print('jobidkeyworddictlist:',jobidkeyworddictlist)
    return render_template('translationanalyst.html', jobidkeyworddictlist=jobidkeyworddictlist)

@app.get('/translationanalyst/blog/<uuid:tid>')
def translationanalyst_blog(tid):
    actorauthorize('translation analyst')
    tid = str(tid)
    blog = modules.translationanalyst.getpureblog(tid,cur)
    return render_template('translationanalyst_blog.html', blog=blog)


# BLOG ANALYZER
# --------------------------------------------------------------

import modules.bloganalyzer

@app.get('/bloganalyzer')
def bloganalyzer():
    actorauthorize('blog analyzer')
    #cur.execute('select j.id,j.keyword from jobs as j inner join blogs as b on j.id=b.jobs_id where b.ispublished=false and b.isapproved=true;')
    cur.execute('select j.id,j.keyword from jobs as j inner join blogs as b on j.id=b.jobs_id where b.ispublished=false and b.isapproved=true and b.html is not null;')
    result = cur.fetchall()
    jobidkeyworddictlist = list()
    for row in result:
        jobidkeyworddictlist.append({'jobid':row[0],'keyword':row[1]})
    print('jobidkeyworddictlist:',jobidkeyworddictlist)
    return render_template('bloganalyzer.html', jobidkeyworddictlist=jobidkeyworddictlist)

@app.get('/bloganalyzer/published')
def bloganalyzer_published():
    actorauthorize('blog analyzer')
    cur.execute('select j.id,j.keyword from jobs as j inner join blogs as b on j.id=b.jobs_id where b.ispublished=true and b.isapproved=true;')
    result = cur.fetchall()
    jobidkeyworddictlist = list()
    for row in result:
        jobidkeyworddictlist.append({'jobid':row[0],'keyword':row[1]})
    print('jobidkeyworddictlist:',jobidkeyworddictlist)
    return render_template('bloganalyzer_published.html', jobidkeyworddictlist=jobidkeyworddictlist)

@app.get('/bloganalyzer/blog/<uuid:jobid>')
def bloganalyzer_blog(jobid):
    actorauthorize('blog analyzer')
    jobid = str(jobid)
    blog = modules.bloganalyzer.getpureblog(jobid,cur)
    return render_template('bloganalyzer_blog.html', blog=blog)

@app.get('/bloganalyzer/zip/<uuid:jobid>')
def bloganalyzer_zip(jobid):
    actorauthorize('blog analyzer')
    jobid = str(jobid)
    zipfilename,zipfile = modules.bloganalyzer.getpngzip(jobid,cur)
    return send_file(
            zipfile,
            as_attachment=True,
            download_name=zipfilename,
            mimetype='application/zip',
            )

@app.get('/bloganalyzer/markpublished/<uuid:jobid>')
def bloganalyzer_markpublished(jobid):
    actorauthorize('blog analyzer')
    jobid = str(jobid)
    cur.execute('update blogs set ispublished=true where jobs_id=%s;', (jobid,))
    con.commit()
    return redirect(url_for('bloganalyzer'))

@app.get('/bloganalyzer/gethtml/<uuid:jobid>')
def bloganalyzer_gethtml(jobid):
    actorauthorize('blog analyzer')
    jobid = str(jobid)
    #html = modules.bloganalyzer.gethtml(modules.bloganalyzer.getpureblog(jobid,cur))
    html = modules.bloganalyzer.workaround_gethtml(jobid,cur)
    response = make_response(html,200)
    response.mimetype = 'text/plain'
    return response
    return 'work in progress...'


# APP RUN
# --------------------------------------------------------------

app.run(debug=False, host='0.0.0.0', port='3000')
#app.run(debug=True, host='0.0.0.0', port='3000')

