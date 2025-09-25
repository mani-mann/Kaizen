// Map your actual DB column names to logical fields used by the app
export const mapping = {
  sites: {
    table: 'sites',
    id: 'id',
    name: 'name',
    city: 'city',
  },
  sales: {
    table: 'sales',
    id: 'id',
    siteId: 'site_id',
    date: 'date',
    liters: 'liters',
    fuelSalesValue: 'fuel_sales_value',
    shopSalesValue: 'shop_sales_value',
    cogsValue: 'cogs_value',
  },
  expenses: {
    table: 'expenses',
    id: 'id',
    siteId: 'site_id',
    date: 'date',
    category: 'category',
    amount: 'amount',
  },
  categories: {
    wages: 'WAGES',
    electricity: 'ELECTRICITY',
    repairs: 'REPAIRS',
    other: 'OTHER',
  },
};

