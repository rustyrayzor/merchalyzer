const { validatePrintifyApiKey } = require('./src/lib/printify');

async function testPrintifyIntegration() {
  console.log('🧪 Testing Printify Integration...\n');

  try {
    // Check if API key is configured
    if (!process.env.PRINTIFY_API_KEY) {
      console.error('❌ PRINTIFY_API_KEY environment variable is not set');
      console.log('Please make sure to add PRINTIFY_API_KEY to your .env.local file');
      return;
    }

    console.log('✅ PRINTIFY_API_KEY is configured');
    console.log('🔑 API Key:', process.env.PRINTIFY_API_KEY.substring(0, 10) + '...');

    // Test API key validation
    console.log('\n🔍 Testing API key validation...');
    const isValid = await validatePrintifyApiKey();

    if (isValid) {
      console.log('✅ API key is valid - Printify integration is working!');
    } else {
      console.log('❌ API key validation failed');
      console.log('Please check your API key and ensure it has the correct permissions');
    }

  } catch (error) {
    console.error('❌ Error during testing:', error.message);
  }
}

// Run the test
testPrintifyIntegration();

