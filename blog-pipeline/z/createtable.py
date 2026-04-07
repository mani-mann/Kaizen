createproductmasterquery = '''
create table product_master (
product_url text pk,
product_upload_date datetime pk,
product_name text not null,

timestamp_insert,
timestamp_update
)
'''

def productmaster(cur):
