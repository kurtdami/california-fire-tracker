export async function testCaching() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  console.log('🧪 Testing AQI Cache Strategy');
  console.log('----------------------------');

  // Test 1: Initial request
  console.log('1️⃣ Making initial request...');
  const response1 = await fetch(`${baseUrl}/api/air-quality?lat=33.8728915&lng=-117.9234644`);
  console.log(`Status: ${response1.status}`);
  console.log('Cache Status:', response1.headers.get('cf-cache-status'));
  
  // Test 2: Same grid, different coordinates
  console.log('\n2️⃣ Testing same grid, slightly different coordinates...');
  const response2 = await fetch(`${baseUrl}/api/air-quality?lat=33.8728000&lng=-117.9234000`);
  console.log(`Status: ${response2.status}`);
  console.log('Cache Status:', response2.headers.get('cf-cache-status'));
  
  // Test 3: Different grid
  console.log('\n3️⃣ Testing different grid...');
  const response3 = await fetch(`${baseUrl}/api/air-quality?lat=34.8728915&lng=-117.9234644`);
  console.log(`Status: ${response3.status}`);
  console.log('Cache Status:', response3.headers.get('cf-cache-status'));
  
  // Test 4: Cache busting
  console.log('\n4️⃣ Testing cache busting...');
  const response4 = await fetch(`${baseUrl}/api/air-quality?lat=33.8728915&lng=-117.9234644&_t=${Date.now()}`);
  console.log(`Status: ${response4.status}`);
  console.log('Cache Status:', response4.headers.get('cf-cache-status'));
}

// Only run if called directly
if (require.main === module) {
  testCaching();
} 