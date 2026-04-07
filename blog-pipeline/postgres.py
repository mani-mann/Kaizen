import psycopg2

# create database pipe;

dbname='pipe'
user='postgres'
password='Rahul@143Modi'
host='localhost'
port='5432'

con = psycopg2.connect(dbname=dbname, user=user, password=password, host=host, port=port)
cur = con.cursor()


def createtables():
    cur.execute('create table accounts (id uuid primary key default gen_random_uuid(), email varchar(256) unique not null);')
    cur.execute('create table autowriters (accounts_id uuid primary key references accounts(id) on delete cascade, preference text not null);')  # preference - json comprising presets for blog writer api
    cur.execute('create table roles (id uuid primary key default gen_random_uuid(), role varchar(256) unique not null);')
    cur.execute('create table accountroles (accounts_id uuid references accounts(id) on delete cascade, roles_id uuid references roles(id) on delete cascade, primary key (accounts_id,roles_id));')  # primary key declaration makes it not null by default
    cur.execute('create table jobs (id uuid primary key default gen_random_uuid(), keyword varchar(256) not null, title varchar(256) not null);')
    cur.execute('create table jobroleassignments (jobs_id uuid references jobs(id) on delete cascade, roles_id uuid references roles(id) on delete cascade, accounts_id uuid references accounts(id) on delete cascade, primary key (jobs_id,roles_id));')
    cur.execute('create table dockets (jobs_id uuid primary key references jobs(id) on delete cascade, autodocket bytea, finaldocket bytea);')
    cur.execute('create table blogs (jobs_id uuid primary key references jobs(id) on delete cascade, blog text not null, status boolean not null default false);')  # blog json
    cur.execute('create table status (id uuid primary key default gen_random_uuid(), code varchar(256) unique not null);')
    cur.execute('create table jobstatus (jobs_id uuid references jobs(id) on delete cascade, status_id uuid references status(id) on delete cascade, timestamp timestamp default now(), primary key (jobs_id,status_id));')
    cur.execute('create table impersonate (userid uuid primary key, actorid uuid not null);')
    #cur.execute('create table messages (message text, timestamp timestamp default now());')
    #cur.execute('create table errors (errors text, timestamp timestamp default now());')
    return

def initializetables():
    cur.execute("insert into accounts (email) values ('akshit.chhikara@slidetech.in'),('maninder.mann@slidetech.in');")
    cur.execute("insert into roles (role) values ('admin'),('keyword creator'),('docket creator'),('blog allocator'),('blog writer'),('blog evaluator'),('blog analyzer');")
    cur.execute("insert into accountroles (accounts_id,roles_id) values ((select id from accounts where email='akshit.chhikara@slidetech.in'),(select id from roles where role='admin'));")
    cur.execute("insert into status (code) values ('keyword created'),('auto-docket generated'),('final-docket uploaded'),('generating initial blog'),('initial blog generated'),('evaluating blog'),('blog finalized'),('blog published');")
    return

# SELECTS
# select * from accounts;
# select * from roles;
# select * from junction_accounts_roles;
# select accounts.email,roles.role from accounts left join junction_accounts_roles on accounts.id=junction_accounts_roles.accounts_id left join roles on roles.id=junction_accounts_roles.roles_id;

def insertautowriter():
    import json
    # insert preference json into autowriters
    return

def main():
    #createtables()
    #initializetables()
    #cur.execute('create table impersonate (userid uuid primary key, actorid uuid not null);')
    #con.commit()
    return

if __name__=='__main__':
    main()
