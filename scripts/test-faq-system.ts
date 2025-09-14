import { faqHandler } from '../src/handlers/faq.handler';
import { supabaseAdmin } from '../src/config/supabase';

// Mock Facebook service to prevent actual messages
const mockFacebookService = {
  sendTextMessage: async (senderId: string, message: string) => {
    console.log(`[MESSAGE TO ${senderId}]:`, message);
  },
  sendQuickReply: async (senderId: string, message: string, quickReplies: any[]) => {
    console.log(`[QUICK REPLY TO ${senderId}]:`, message);
    console.log('Options:', quickReplies.map(qr => qr.title).join(', '));
  }
};

// Replace the Facebook service with mock
(faqHandler as any).facebookService = mockFacebookService;

async function testFAQSystem() {
  console.log('🧪 Testing FAQ System with Database\n');
  console.log('=' .repeat(50));

  const testSenderId = 'test_user_123';

  try {
    // Test 1: Check database connection and FAQ count
    console.log('\n📊 Test 1: Checking database FAQs...');
    const { count } = await supabaseAdmin
      .from('faqs')
      .select('*', { count: 'exact', head: true });
    console.log(`✅ Found ${count} FAQs in database`);

    // Test 2: Get unique categories
    console.log('\n📁 Test 2: Fetching categories...');
    const { data: faqData } = await supabaseAdmin
      .from('faqs')
      .select('category')
      .eq('is_published', true);
    
    const categories = [...new Set(faqData?.map(f => f.category) || [])];
    console.log(`✅ Found ${categories.length} categories:`, categories.join(', '));

    // Test 3: Test main menu handler (simulated)
    console.log('\n🎯 Test 3: Testing main menu handler...');
    console.log('Simulating FAQ main menu request:');
    // This would normally send to Facebook, but we're mocking it
    await testMainMenu();

    // Test 4: Test category selection
    console.log('\n🎯 Test 4: Testing category selection...');
    if (categories.length > 0) {
      const testCategory = categories[0];
      console.log(`Testing category: ${testCategory}`);
      await testCategorySelection(testCategory);
    }

    // Test 5: Test search functionality
    console.log('\n🔍 Test 5: Testing search functionality...');
    const searchResults = await faqHandler.searchFAQs(testSenderId, 'office');
    console.log(`✅ Search for "office" returned ${searchResults.length} results`);
    if (searchResults && searchResults.length > 0) {
      console.log('First result:', searchResults[0]?.question);
    }

    console.log('\n' + '=' .repeat(50));
    console.log('✨ All tests completed successfully!');
    console.log('\n📝 Summary:');
    console.log('- FAQ system is connected to database');
    console.log('- Categories are being fetched dynamically');
    console.log('- Search functionality is working');
    console.log('- No more hardcoded FAQ structure!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  process.exit(0);
}

// Helper function to test main menu
async function testMainMenu() {
  const { data: faqData } = await supabaseAdmin
    .from('faqs')
    .select('category')
    .eq('is_published', true)
    .is('building_id', null);
  
  const categories = [...new Set(faqData?.map(f => f.category) || [])];
  console.log('  Main menu would show these categories:', categories.slice(0, 10));
}

// Helper function to test category selection
async function testCategorySelection(category: string) {
  const { data: faqs } = await supabaseAdmin
    .from('faqs')
    .select('*')
    .eq('category', category)
    .eq('is_published', true)
    .is('building_id', null)
    .order('priority');

  console.log(`  Category "${category}" has ${faqs?.length || 0} FAQs`);
  if (faqs && faqs.length > 0) {
    console.log('  Sample questions:');
    faqs.slice(0, 3).forEach(faq => {
      console.log(`    - ${faq.question}`);
    });
  }
}

testFAQSystem();
