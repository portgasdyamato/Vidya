// Quick test to verify upload endpoint
const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

async function testUpload() {
  console.log('🧪 Testing upload endpoint...\n');
  
  // Create a simple test file
  const testContent = 'This is a test document for Vidya AI platform.';
  fs.writeFileSync('test-doc.txt', testContent);
  
  const form = new FormData();
  form.append('file', fs.createReadStream('test-doc.txt'));
  form.append('title', 'Test Document');
  form.append('processingOptions', JSON.stringify({
    generateAudio: true,
    generateSummary: true,
    generateQuiz: false
  }));
  
  try {
    const response = await fetch('http://localhost:5000/api/content/document', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Upload successful!');
      console.log('   Content ID:', data.id);
      console.log('   Title:', data.title);
      console.log('   Status:', data.status);
      console.log('\n🎉 Upload endpoint is working correctly!\n');
    } else {
      console.log('❌ Upload failed');
      console.log('   Error:', data.message);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  } finally {
    // Cleanup
    if (fs.existsSync('test-doc.txt')) {
      fs.unlinkSync('test-doc.txt');
    }
  }
}

testUpload();
