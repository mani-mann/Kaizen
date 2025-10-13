require('dotenv').config();
const fetch = require('node-fetch');

async function testPerformance() {
  console.log('\n⏱️ Testing API Performance...\n');
  
  const tests = [
    { name: '7 Days', start: '2025-10-03', end: '2025-10-10' },
    { name: '30 Days', start: '2025-09-10', end: '2025-10-10' },
    { name: '90 Days', start: '2025-07-12', end: '2025-10-10' }
  ];
  
  for (const test of tests) {
    try {
      console.log(`\n📊 Testing: ${test.name}`);
      console.log(`   Range: ${test.start} to ${test.end}`);
      
      const startTime = Date.now();
      const response = await fetch(`http://localhost:${process.env.PORT || 5000}/api/analytics?start=${test.start}&end=${test.end}`);
      const data = await response.json();
      const duration = Date.now() - startTime;
      
      console.log(`   ✅ Response time: ${duration}ms`);
      console.log(`   📦 Rows returned: ${data.rows?.length || 0}`);
      
      if (duration < 1000) {
        console.log(`   ⚡ Status: FAST!`);
      } else if (duration < 2000) {
        console.log(`   ✅ Status: Good`);
      } else if (duration < 5000) {
        console.log(`   ⚠️  Status: Acceptable`);
      } else {
        console.log(`   ❌ Status: SLOW - needs optimization`);
      }
      
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      console.log(`   💡 Make sure backend is running (npm start)`);
    }
  }
  
  console.log('\n✅ Performance test complete!\n');
}

testPerformance();

