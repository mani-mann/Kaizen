// Test file to investigate campaign name structure in search terms data
// This file helps identify if campaign names contain pipe-separated values
// or if there are grouping issues causing duplicate rows

class SearchTermAnalyzer {
    constructor() {
        this.analysisResults = {
            uniqueSearchTerms: new Set(),
            campaignNamePatterns: new Map(),
            pipeSeparatedCampaigns: [],
            duplicateGroups: [],
            sampleData: []
        };
    }

    // Analyze data from trend reports
    analyzeData(data) {
        console.log('🔍 Starting Search Term Campaign Analysis...');
        console.log(`📊 Total data items: ${data.length}`);

        // Filter for search-terms category
        const searchTermData = data.filter(item => item.category === 'search-terms');
        console.log(`📊 Search terms data items: ${searchTermData.length}`);

        // Track unique search terms and their campaigns
        const searchTermCampaigns = new Map();
        const campaignNameCounts = new Map();
        const groupKeys = new Set();
        
        // NEW: Track if pipe-separated parts appear as separate campaigns
        const pipePartsAsSeparate = new Map(); // Map of pipe-separated campaign -> Set of individual parts found separately
        const allCampaignNames = new Set(); // All unique campaign names (including pipe-separated)
        const individualCampaignParts = new Set(); // Individual campaign parts from pipe-separated names

        searchTermData.forEach((item, index) => {
            const name = item.displayName || item.name || '';
            const campaignName = (item.campaignName || item.campaign_name || '').trim();
            const date = item.date;

            // Skip DAILY TOTAL rows
            if (name.includes('📊') || name.toLowerCase().includes('daily total')) {
                return;
            }

            // Track unique search terms
            this.analysisResults.uniqueSearchTerms.add(name);

            // Track campaign name patterns
            if (campaignName) {
                allCampaignNames.add(campaignName);
                
                const count = campaignNameCounts.get(campaignName) || 0;
                campaignNameCounts.set(campaignName, count + 1);

                // Check for pipe-separated campaign names
                if (campaignName.includes('|')) {
                    const parts = campaignName.split('|').map(p => p.trim()).filter(p => p);
                    
                    // Track individual parts
                    parts.forEach(part => {
                        individualCampaignParts.add(part);
                    });
                    
                    // Check if any of these parts appear as separate campaign names
                    parts.forEach(part => {
                        if (allCampaignNames.has(part)) {
                            if (!pipePartsAsSeparate.has(campaignName)) {
                                pipePartsAsSeparate.set(campaignName, new Set());
                            }
                            pipePartsAsSeparate.get(campaignName).add(part);
                        }
                    });
                    
                    this.analysisResults.pipeSeparatedCampaigns.push({
                        searchTerm: name,
                        originalCampaign: campaignName,
                        splitParts: parts,
                        date: date,
                        spend: item.spend || 0,
                        sales: item.sales || 0,
                        clicks: item.clicks || 0
                    });
                }

                // Track search term -> campaigns mapping
                if (!searchTermCampaigns.has(name)) {
                    searchTermCampaigns.set(name, new Set());
                }
                searchTermCampaigns.get(name).add(campaignName);

                // Create group key (same as in groupDataByProductForPivot)
                const groupKey = `${name}|||${campaignName}`;
                
                // Check for duplicate group keys (same search term + campaign)
                if (groupKeys.has(groupKey)) {
                    this.analysisResults.duplicateGroups.push({
                        searchTerm: name,
                        campaignName: campaignName,
                        groupKey: groupKey,
                        date: date,
                        spend: item.spend || 0,
                        sales: item.sales || 0,
                        index: index
                    });
                } else {
                    groupKeys.add(groupKey);
                }
            }

            // Collect sample data for specific search terms
            const testTerms = [
                'naruto trading cards game',
                'mahabharat',
                'flags flash cards for kids',
                'match attax football cards',
                'card game',
                'b0bsnfj5ym',
                'business game'
            ];
            
            if (testTerms.some(term => name.toLowerCase().includes(term.toLowerCase()) || term.toLowerCase().includes(name.toLowerCase()))) {
                this.analysisResults.sampleData.push({
                    index: index,
                    name: name,
                    campaignName: campaignName,
                    date: date,
                    spend: item.spend || 0,
                    sales: item.sales || 0,
                    clicks: item.clicks || 0,
                    groupKey: campaignName ? `${name}|||${campaignName}` : `${name}|||Unknown`
                });
            }
        });
        
        // Store pipe analysis results
        this.analysisResults.pipePartsAsSeparate = pipePartsAsSeparate;
        this.analysisResults.individualCampaignParts = individualCampaignParts;

        // Build campaign name patterns report
        campaignNameCounts.forEach((count, campaignName) => {
            this.analysisResults.campaignNamePatterns.set(campaignName, {
                count: count,
                hasPipe: campaignName.includes('|'),
                length: campaignName.length,
                trimmed: campaignName.trim(),
                normalized: campaignName.trim().toLowerCase()
            });
        });

        return this.generateReport(searchTermCampaigns, groupKeys);
    }

    generateReport(searchTermCampaigns, groupKeys) {
        console.log('\n📋 ANALYSIS REPORT');
        console.log('='.repeat(80));

        // 1. Unique search terms count
        console.log(`\n1. Unique Search Terms: ${this.analysisResults.uniqueSearchTerms.size}`);
        
        // 2. Campaign name patterns
        console.log(`\n2. Campaign Name Patterns:`);
        console.log(`   Total unique campaign names: ${this.analysisResults.campaignNamePatterns.size}`);
        
        const pipeSeparatedCount = Array.from(this.analysisResults.campaignNamePatterns.values())
            .filter(p => p.hasPipe).length;
        console.log(`   Campaign names with pipes: ${pipeSeparatedCount}`);

        // Show top campaign names with pipes
        if (pipeSeparatedCount > 0) {
            console.log(`\n   Top Campaign Names with Pipes:`);
            const pipeCampaigns = Array.from(this.analysisResults.campaignNamePatterns.entries())
                .filter(([name, data]) => data.hasPipe)
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 10);
            
            pipeCampaigns.forEach(([name, data]) => {
                console.log(`     - "${name}" (appears ${data.count} times)`);
                const parts = name.split('|').map(p => p.trim()).filter(p => p);
                console.log(`       Split into: [${parts.join(', ')}]`);
            });
        }

        // 3. Pipe-separated campaigns details
        if (this.analysisResults.pipeSeparatedCampaigns.length > 0) {
            console.log(`\n3. Pipe-Separated Campaign Details:`);
            console.log(`   Total items with pipe-separated campaigns: ${this.analysisResults.pipeSeparatedCampaigns.length}`);
            
            // Group by search term
            const bySearchTerm = new Map();
            this.analysisResults.pipeSeparatedCampaigns.forEach(item => {
                if (!bySearchTerm.has(item.searchTerm)) {
                    bySearchTerm.set(item.searchTerm, []);
                }
                bySearchTerm.get(item.searchTerm).push(item);
            });

            bySearchTerm.forEach((items, searchTerm) => {
                console.log(`\n   Search Term: "${searchTerm}"`);
                console.log(`   Items with pipe-separated campaigns: ${items.length}`);
                items.slice(0, 5).forEach(item => {
                    console.log(`     - Campaign: "${item.originalCampaign}"`);
                    console.log(`       Split into: [${item.splitParts.join(', ')}]`);
                    console.log(`       Date: ${item.date}, Spend: ${item.spend}, Sales: ${item.sales}`);
                });
            });
        }

        // 4. Duplicate groups check
        if (this.analysisResults.duplicateGroups.length > 0) {
            console.log(`\n4. ⚠️  DUPLICATE GROUPS DETECTED:`);
            console.log(`   Found ${this.analysisResults.duplicateGroups.length} potential duplicate groups`);
            
            // Group duplicates by search term + campaign
            const duplicateMap = new Map();
            this.analysisResults.duplicateGroups.forEach(dup => {
                const key = `${dup.searchTerm}|||${dup.campaignName}`;
                if (!duplicateMap.has(key)) {
                    duplicateMap.set(key, []);
                }
                duplicateMap.get(key).push(dup);
            });

            duplicateMap.forEach((dups, key) => {
                console.log(`\n   Group Key: "${key}"`);
                console.log(`   Appears ${dups.length} times:`);
                dups.slice(0, 3).forEach(dup => {
                    console.log(`     - Date: ${dup.date}, Spend: ${dup.spend}, Sales: ${dup.sales}`);
                });
            });
        } else {
            console.log(`\n4. ✅ No duplicate groups detected (all group keys are unique)`);
        }

        // 5. Sample data for test search terms
        if (this.analysisResults.sampleData.length > 0) {
            console.log(`\n5. Sample Data for Test Search Terms:`);
            console.log(`   Total items: ${this.analysisResults.sampleData.length}`);
            
            // Group by search term and campaign
            const bySearchTerm = new Map();
            this.analysisResults.sampleData.forEach(item => {
                if (!bySearchTerm.has(item.name)) {
                    bySearchTerm.set(item.name, new Map());
                }
                const termCampaigns = bySearchTerm.get(item.name);
                if (!termCampaigns.has(item.campaignName)) {
                    termCampaigns.set(item.campaignName, []);
                }
                termCampaigns.get(item.campaignName).push(item);
            });

            bySearchTerm.forEach((campaigns, searchTerm) => {
                console.log(`\n   Search Term: "${searchTerm}"`);
                console.log(`   Total campaigns: ${campaigns.size}`);
                campaigns.forEach((items, campaign) => {
                    console.log(`     Campaign: "${campaign}"`);
                    console.log(`       Items: ${items.length}`);
                    console.log(`       Group Key: "${items[0].groupKey}"`);
                    console.log(`       Total Spend: ${items.reduce((s, i) => s + (i.spend || 0), 0)}`);
                    console.log(`       Total Sales: ${items.reduce((s, i) => s + (i.sales || 0), 0)}`);
                });
            });
        }

        // 6. Search terms with multiple campaigns
        console.log(`\n6. Search Terms with Multiple Campaigns:`);
        const multiCampaignTerms = Array.from(searchTermCampaigns.entries())
            .filter(([term, campaigns]) => campaigns.size > 1)
            .sort((a, b) => b[1].size - a[1].size)
            .slice(0, 10);

        if (multiCampaignTerms.length > 0) {
            multiCampaignTerms.forEach(([term, campaigns]) => {
                console.log(`\n   "${term}" has ${campaigns.size} different campaigns:`);
                Array.from(campaigns).forEach(campaign => {
                    console.log(`     - "${campaign}"`);
                });
            });
        } else {
            console.log(`   No search terms found with multiple campaigns`);
        }

        // 7. CRITICAL: Check if pipe-separated campaign parts appear as separate campaigns
        console.log(`\n7. 🔍 CRITICAL ANALYSIS: Pipe-Separated vs Individual Campaigns:`);
        if (this.analysisResults.pipePartsAsSeparate.size > 0) {
            console.log(`   ⚠️  Found ${this.analysisResults.pipePartsAsSeparate.size} pipe-separated campaigns whose parts appear separately:`);
            
            this.analysisResults.pipePartsAsSeparate.forEach((separateParts, pipeCampaign) => {
                console.log(`\n   Pipe Campaign: "${pipeCampaign}"`);
                console.log(`   Parts that appear separately: [${Array.from(separateParts).join(', ')}]`);
                console.log(`   💡 CONCLUSION: This pipe-separated campaign should be SPLIT into individual campaigns!`);
            });
        } else {
            console.log(`   ✅ No pipe-separated campaigns found whose parts appear as separate campaigns`);
            console.log(`   💡 CONCLUSION: Pipe-separated campaigns (like "MM | Man") are SINGLE campaign names, NOT multiple campaigns`);
        }
        
        // 8. Analyze specific search terms to determine single vs multiple campaigns
        console.log(`\n8. 🔍 Search Term Campaign Analysis (Single vs Multiple):`);
        const termsToAnalyze = Array.from(searchTermCampaigns.entries())
            .filter(([term, campaigns]) => {
                // Focus on terms with pipe-separated campaigns or multiple campaigns
                const hasPipe = Array.from(campaigns).some(c => c.includes('|'));
                return hasPipe || campaigns.size > 1;
            })
            .slice(0, 15);
            
        if (termsToAnalyze.length > 0) {
            termsToAnalyze.forEach(([term, campaigns]) => {
                console.log(`\n   Search Term: "${term}"`);
                console.log(`   Total unique campaign names: ${campaigns.size}`);
                
                const pipeCampaigns = Array.from(campaigns).filter(c => c.includes('|'));
                const nonPipeCampaigns = Array.from(campaigns).filter(c => !c.includes('|'));
                
                if (pipeCampaigns.length > 0) {
                    console.log(`   Pipe-separated campaigns: ${pipeCampaigns.length}`);
                    pipeCampaigns.forEach(c => {
                        const parts = c.split('|').map(p => p.trim()).filter(p => p);
                        const partsFoundSeparately = parts.filter(p => nonPipeCampaigns.includes(p) || allCampaignNames.has(p));
                        
                        if (partsFoundSeparately.length > 0) {
                            console.log(`     - "${c}" → Parts [${parts.join(', ')}]`);
                            console.log(`       ⚠️  Parts found separately: [${partsFoundSeparately.join(', ')}]`);
                            console.log(`       💡 Should be SPLIT into individual campaigns`);
                        } else {
                            console.log(`     - "${c}" → Parts [${parts.join(', ')}]`);
                            console.log(`       ✅ Parts NOT found separately - this is a SINGLE campaign name`);
                        }
                    });
                }
                
                if (nonPipeCampaigns.length > 0) {
                    console.log(`   Individual campaigns: ${nonPipeCampaigns.length}`);
                    nonPipeCampaigns.slice(0, 5).forEach(c => {
                        console.log(`     - "${c}"`);
                    });
                }
                
                // Determine if this search term should show multiple rows
                const shouldSplit = pipeCampaigns.some(c => {
                    const parts = c.split('|').map(p => p.trim()).filter(p => p);
                    return parts.some(p => allCampaignNames.has(p));
                });
                
                if (shouldSplit) {
                    console.log(`   🎯 RECOMMENDATION: SPLIT pipe-separated campaigns into individual rows`);
                } else if (campaigns.size > 1) {
                    console.log(`   🎯 RECOMMENDATION: Already has multiple campaigns - should show ${campaigns.size} rows`);
                } else {
                    console.log(`   🎯 RECOMMENDATION: Single campaign - should show 1 row`);
                }
            });
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ Analysis Complete\n');

        return {
            uniqueSearchTerms: this.analysisResults.uniqueSearchTerms.size,
            totalCampaignNames: this.analysisResults.campaignNamePatterns.size,
            pipeSeparatedCount: pipeSeparatedCount,
            duplicateGroupsCount: this.analysisResults.duplicateGroups.length,
            sampleDataCount: this.analysisResults.sampleData.length
        };
    }

    // Method to test specific search term
    testSearchTerm(data, searchTermName) {
        const filtered = data.filter(item => {
            const name = item.displayName || item.name || '';
            return name === searchTermName && item.category === 'search-terms';
        });

        console.log(`\n🔍 Testing Search Term: "${searchTermName}"`);
        console.log(`📊 Found ${filtered.length} items\n`);

        const byCampaign = new Map();
        const allCampaignNamesInData = new Set();
        
        // First pass: collect all campaign names in the entire dataset
        data.filter(item => item.category === 'search-terms').forEach(item => {
            const campaign = (item.campaignName || item.campaign_name || '').trim();
            if (campaign) {
                allCampaignNamesInData.add(campaign);
            }
        });

        filtered.forEach(item => {
            const campaign = (item.campaignName || item.campaign_name || '').trim() || 'Unknown';
            if (!byCampaign.has(campaign)) {
                byCampaign.set(campaign, []);
            }
            byCampaign.get(campaign).push(item);
        });

        console.log(`📋 Campaigns for "${searchTermName}": ${byCampaign.size}`);
        
        let shouldSplit = false;
        const splitRecommendations = [];
        
        byCampaign.forEach((items, campaign) => {
            console.log(`\n   Campaign: "${campaign}"`);
            console.log(`   Items: ${items.length}`);
            console.log(`   Has pipe: ${campaign.includes('|')}`);
            
            if (campaign.includes('|')) {
                const parts = campaign.split('|').map(p => p.trim()).filter(p => p);
                console.log(`   Split parts: [${parts.join(', ')}]`);
                
                // Check if any part appears as a separate campaign in the dataset
                const partsFoundSeparately = parts.filter(part => allCampaignNamesInData.has(part));
                
                if (partsFoundSeparately.length > 0) {
                    console.log(`   ⚠️  CRITICAL: Parts found as separate campaigns: [${partsFoundSeparately.join(', ')}]`);
                    console.log(`   💡 This campaign should be SPLIT into individual campaigns!`);
                    shouldSplit = true;
                    splitRecommendations.push({
                        campaign: campaign,
                        parts: parts,
                        partsFoundSeparately: partsFoundSeparately
                    });
                } else {
                    console.log(`   ✅ Parts NOT found separately - this is a SINGLE campaign name`);
                }
            }
            
            console.log(`   Total Spend: ${items.reduce((sum, i) => sum + (i.spend || 0), 0)}`);
            console.log(`   Total Sales: ${items.reduce((sum, i) => sum + (i.sales || 0), 0)}`);
            console.log(`   Total Clicks: ${items.reduce((sum, i) => sum + (i.clicks || 0), 0)}`);
            
            // Show date range
            const dates = items.map(i => i.date).sort();
            if (dates.length > 0) {
                console.log(`   Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
            }
        });
        
        // Final recommendation
        console.log(`\n🎯 FINAL ANALYSIS FOR "${searchTermName}":`);
        if (shouldSplit) {
            console.log(`   ⚠️  ISSUE FOUND: This search term has pipe-separated campaigns that should be split!`);
            console.log(`   📋 Current rows: ${byCampaign.size}`);
            let expectedRows = byCampaign.size;
            splitRecommendations.forEach(rec => {
                expectedRows = expectedRows - 1 + rec.parts.length; // Remove 1 pipe campaign, add individual parts
            });
            console.log(`   📋 Expected rows after split: ${expectedRows}`);
            console.log(`   💡 RECOMMENDATION: Implement splitting logic to create separate rows for each campaign part`);
        } else if (byCampaign.size > 1) {
            console.log(`   ✅ This search term already has ${byCampaign.size} separate campaigns`);
            console.log(`   💡 Should display ${byCampaign.size} rows (one per campaign)`);
        } else {
            console.log(`   ✅ This search term has 1 campaign`);
            console.log(`   💡 Should display 1 row`);
        }

        return {
            byCampaign: byCampaign,
            shouldSplit: shouldSplit,
            splitRecommendations: splitRecommendations,
            totalCampaigns: byCampaign.size
        };
    }
}

// Export for use in browser console or as module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchTermAnalyzer;
} else {
    window.SearchTermAnalyzer = SearchTermAnalyzer;
}

// Auto-run analysis when data is available
function autoRunAnalysis() {
    if (typeof window !== 'undefined' && window.trendReportsInstance) {
        const analyzer = new SearchTermAnalyzer();
        const data = window.trendReportsInstance.currentData;
        
        if (data && data.length > 0) {
            console.log('🚀 Auto-running analysis...\n');
            
            // Run full analysis
            analyzer.analyzeData(data);
            
            // Test specific search terms
            const testTerms = [
                'naruto trading cards game',
                'mahabharat',
                'flags flash cards for kids',
                'match attax football cards',
                'card game',
                'b0bsnfj5ym',
                'business game'
            ];
            
            console.log('\n' + '='.repeat(80));
            console.log('🔍 TESTING SPECIFIC SEARCH TERMS');
            console.log('='.repeat(80));
            
            testTerms.forEach(term => {
                analyzer.testSearchTerm(data, term);
            });
            
            console.log('\n' + '='.repeat(80));
            console.log('✅ All tests complete!');
            console.log('='.repeat(80));
        } else {
            console.log('⏳ Waiting for data to load...');
            setTimeout(autoRunAnalysis, 1000);
        }
    } else {
        console.log('⏳ Waiting for TrendReports instance...');
        setTimeout(autoRunAnalysis, 1000);
    }
}

// Usage instructions
console.log(`
📝 Search Term Analyzer Usage:

1. Auto-run (will start automatically when data loads):
   The analyzer will automatically run when the page loads and data is available.

2. Manual run in browser console:
   const analyzer = new SearchTermAnalyzer();
   const data = window.trendReportsInstance.currentData;
   analyzer.analyzeData(data);

3. Test specific search term:
   analyzer.testSearchTerm(data, 'b0bsnfj5yn');

4. Test all specified terms:
   const testTerms = ['naruto trading cards game', 'mahabharat', 'flags flash cards for kids', 
                      'match attax football cards', 'card game', 'b0bsnfj5ym', 'business game'];
   testTerms.forEach(term => analyzer.testSearchTerm(data, term));
`);

// Start auto-run when DOM is ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(autoRunAnalysis, 2000); // Wait 2 seconds for data to load
        });
    } else {
        setTimeout(autoRunAnalysis, 2000);
    }
}
