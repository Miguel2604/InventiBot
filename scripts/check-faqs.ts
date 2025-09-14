import { supabaseAdmin } from '../src/config/supabase';

async function checkFAQs() {
  console.log('🔍 Checking FAQ table schema and data...\n');

  try {
    // First, let's check the table structure
    console.log('📊 FAQ Table Structure:');
    const { data: tableInfo, error: schemaError } = await supabaseAdmin
      .from('faqs')
      .select('*')
      .limit(1);

    if (schemaError) {
      console.error('Error fetching table info:', schemaError);
      return;
    }

    // Log column names if we have data
    if (tableInfo && tableInfo.length > 0) {
      console.log('Columns:', Object.keys(tableInfo[0]));
      console.log('\nSample record:', JSON.stringify(tableInfo[0], null, 2));
    }

    // Count existing FAQs
    const { count, error: countError } = await supabaseAdmin
      .from('faqs')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error counting FAQs:', countError);
    } else {
      console.log(`\n📝 Total FAQs in database: ${count || 0}`);
    }

    // Get all existing FAQs grouped by category
    const { data: faqs, error: faqError } = await supabaseAdmin
      .from('faqs')
      .select('*')
      .order('category')
      .order('priority');

    if (faqError) {
      console.error('Error fetching FAQs:', faqError);
      return;
    }

    // Group by category
    const categorized: { [key: string]: any[] } = {};
    faqs?.forEach(faq => {
      if (!categorized[faq.category]) {
        categorized[faq.category] = [];
      }
      categorized[faq.category]!.push(faq);
    });

    console.log('\n📁 FAQs by Category:');
    Object.entries(categorized).forEach(([category, items]) => {
      console.log(`\n  ${category}: ${items.length} items`);
      items.forEach(item => {
        console.log(`    - ${item.question.substring(0, 50)}...`);
      });
    });

    // Check for building-specific FAQs
    const { data: buildingFaqs, error: buildingError } = await supabaseAdmin
      .from('faqs')
      .select('building_id, category')
      .not('building_id', 'is', null);

    if (!buildingError && buildingFaqs) {
      console.log(`\n🏢 Building-specific FAQs: ${buildingFaqs.length}`);
    }

    // Check unique categories
    const { data: categories, error: catError } = await supabaseAdmin
      .from('faqs')
      .select('category')
      .order('category');

    if (!catError && categories) {
      const uniqueCategories = [...new Set(categories.map(c => c.category))];
      console.log('\n🏷️ Unique Categories:', uniqueCategories);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }

  process.exit(0);
}

checkFAQs();
