/**
 * Web Worker for Heavy Calculations
 * Offloads intensive computations to background thread
 */

self.onmessage = function(e) {
    const { type, data } = e.data;
    
    switch(type) {
        case 'calculateKPIs':
            const kpis = calculateKPIs(data);
            self.postMessage({ type: 'kpisCalculated', result: kpis });
            break;
            
        case 'aggregateData':
            const aggregated = aggregateData(data);
            self.postMessage({ type: 'dataAggregated', result: aggregated });
            break;
            
        case 'sortData':
            const sorted = sortData(data.items, data.sortBy, data.sortOrder);
            self.postMessage({ type: 'dataSorted', result: sorted });
            break;
            
        default:
            self.postMessage({ type: 'error', message: 'Unknown operation' });
    }
};

function calculateKPIs(rows) {
    let totalSpend = 0;
    let totalAdSales = 0;
    let totalSales = 0;
    let totalClicks = 0;
    let totalImpressions = 0;
    
    rows.forEach(row => {
        totalSpend += parseFloat(row.cost || row.spend || 0);
        totalAdSales += parseFloat(row.sales_1d || row.sales || 0);
        totalSales += parseFloat(row.ordered_product_sales || row.totalSales || 0);
        totalClicks += parseInt(row.clicks || 0);
        totalImpressions += parseInt(row.impressions || 0);
    });
    
    const acos = totalAdSales > 0 ? (totalSpend / totalAdSales) * 100 : 0;
    const tcos = totalSales > 0 ? (totalSpend / totalSales) * 100 : 0;
    const roas = totalSpend > 0 ? totalAdSales / totalSpend : 0;
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    
    return {
        adSpend: totalSpend,
        adSales: totalAdSales,
        totalSales: totalSales,
        acos: acos,
        tcos: tcos,
        roas: roas,
        adClicks: totalClicks,
        avgCpc: avgCpc,
        impressions: totalImpressions
    };
}

function aggregateData(rows) {
    // Group by date and aggregate metrics
    const grouped = {};
    
    rows.forEach(row => {
        const date = row.date || row.report_date;
        if (!grouped[date]) {
            grouped[date] = {
                date: date,
                spend: 0,
                sales: 0,
                clicks: 0,
                impressions: 0
            };
        }
        
        grouped[date].spend += parseFloat(row.cost || row.spend || 0);
        grouped[date].sales += parseFloat(row.sales_1d || row.sales || 0);
        grouped[date].clicks += parseInt(row.clicks || 0);
        grouped[date].impressions += parseInt(row.impressions || 0);
    });
    
    return Object.values(grouped);
}

function sortData(items, sortBy, sortOrder) {
    return items.sort((a, b) => {
        let aVal = a[sortBy];
        let bVal = b[sortBy];
        
        // Handle numeric values
        if (typeof aVal === 'string' && !isNaN(aVal)) {
            aVal = parseFloat(aVal);
            bVal = parseFloat(bVal);
        }
        
        if (sortOrder === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });
}

