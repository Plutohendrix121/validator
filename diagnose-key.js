require('dotenv').config();
const axios = require('axios');

console.log('🔍 Diagnosing Emailable API Key Issues\n');

// Your key
const yourKey = process.env.EMAILABLE_API_KEY || process.env.EMailable_API_KEY || 'live_56b67edb1cbbe4daaaa5';
const testEmail = 'test@gmail.com';

// Possible key formats to test
const keyVariations = [
    yourKey,                      // live_56b67edb1cbbe4daaaa5
    `eml_${yourKey}`,            // eml_live_56b67edb1cbbe4daaaa5
    `eml_live_${yourKey.replace('live_', '')}`, // eml_live_56b67edb1cbbe4daaaa5 (if live_ is duplicated)
    'demo'                       // Demo key for comparison
];

async function testKey(key, label) {
    console.log(`\n🧪 Testing: ${label}`);
    console.log(`   Key: ${key.substring(0, 15)}...`);
    
    try {
        const response = await axios.get('https://api.emailable.com/v1/verify', {
            params: {
                email: testEmail,
                api_key: key
            },
            timeout: 5000
        });
        
        console.log(`   ✅ SUCCESS! Status: ${response.data.state}`);
        console.log(`   Response:`, {
            state: response.data.state,
            score: response.data.score,
            reason: response.data.reason
        });
        return { success: true, key: key };
        
    } catch (error) {
        console.log(`   ❌ FAILED: ${error.response?.status || error.code}`);
        console.log(`   Message: ${error.response?.data?.message || error.message}`);
        if (error.response?.data) {
            console.log(`   Full Error:`, JSON.stringify(error.response.data, null, 2));
        }
        return { success: false, key: key, error: error.response?.data };
    }
}

async function runDiagnostics() {
    console.log('='.repeat(60));
    console.log('Emailable API Key Diagnostic Tool');
    console.log('='.repeat(60));
    
    const results = [];
    
    for (let i = 0; i < keyVariations.length; i++) {
        const result = await testKey(keyVariations[i], `Format ${i + 1}`);
        results.push(result);
        
        // Wait between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY:');
    console.log('='.repeat(60));
    
    const workingKey = results.find(r => r.success);
    if (workingKey) {
        console.log(`🎉 Found working key format: ${workingKey.key.substring(0, 20)}...`);
        console.log('\n📝 Update your .env.local file with:');
        console.log(`EMAILABLE_API_KEY=${workingKey.key}`);
    } else {
        console.log('❌ No key format worked.');
        console.log('\n🔧 Possible issues:');
        console.log('1. Your key might be expired or disabled');
        console.log('2. You might need to activate your Emailable account');
        console.log('3. The key format might be different than expected');
        console.log('4. You might have run out of credits');
        console.log('\n🚀 Next steps:');
        console.log('1. Visit https://emailable.com/dashboard');
        console.log('2. Check your API key section');
        console.log('3. Copy the exact key shown there');
        console.log('4. Make sure your account has credits');
    }
}

runDiagnostics().catch(console.error);



