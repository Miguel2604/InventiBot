import { supabaseAdmin } from '../src/config/supabase';

// Define the FAQ structure with hierarchy
interface FAQData {
  category: string;
  subcategory?: string;
  question: string;
  answer: string;
  keywords: string[];
  priority: number;
  building_id?: string | null;
}

// Convert hardcoded FAQ structure to database format
const faqsToInsert: FAQData[] = [
  // Hours of Operation
  {
    category: 'Hours of Operation',
    subcategory: 'Pool',
    question: 'What are the pool hours?',
    answer: 'The pool is open from 8:00 AM to 10:00 PM, Tuesday to Sunday. It is closed on Mondays for cleaning.',
    keywords: ['pool', 'hours', 'swimming', 'open', 'closed'],
    priority: 10,
    building_id: null
  },
  {
    category: 'Hours of Operation',
    subcategory: 'Gym',
    question: 'What are the gym hours?',
    answer: 'The gym is open 24/7 for all residents. Please use your key fob for access after 10:00 PM.',
    keywords: ['gym', 'fitness', 'hours', '24/7', 'workout'],
    priority: 11,
    building_id: null
  },
  {
    category: 'Hours of Operation',
    subcategory: 'Office',
    question: 'What are the management office hours?',
    answer: 'The management office is open Monday to Friday, 9:00 AM to 6:00 PM, and Saturday 10:00 AM to 2:00 PM. Closed on Sundays.',
    keywords: ['office', 'management', 'hours', 'leasing', 'admin'],
    priority: 12,
    building_id: null
  },

  // Policies
  {
    category: 'Policies',
    subcategory: 'Pets',
    question: 'What is the pet policy?',
    answer: 'Pets are welcome! Maximum 2 pets per unit. Dogs must be under 50 lbs. All pets must be registered with the office.',
    keywords: ['pets', 'dogs', 'cats', 'animals', 'policy'],
    priority: 20,
    building_id: null
  },
  {
    category: 'Policies',
    subcategory: 'Noise',
    question: 'What are the noise restrictions?',
    answer: 'Quiet hours are from 10:00 PM to 8:00 AM. Please be respectful of your neighbors at all times.',
    keywords: ['noise', 'quiet', 'hours', 'sound', 'music'],
    priority: 21,
    building_id: null
  },
  {
    category: 'Policies',
    subcategory: 'Parking',
    question: 'What is the parking policy?',
    answer: 'Each unit is assigned one parking spot. Guest parking is available on a first-come, first-served basis. Overnight guest parking requires a permit from the office.',
    keywords: ['parking', 'car', 'vehicle', 'guest', 'permit'],
    priority: 22,
    building_id: null
  },

  // Waste & Recycling
  {
    category: 'Waste & Recycling',
    subcategory: 'Trash',
    question: 'When is trash collected?',
    answer: 'Trash is collected Monday, Wednesday, and Friday. Please place bins at the curb by 7:00 AM on collection days.',
    keywords: ['trash', 'garbage', 'collection', 'waste', 'pickup'],
    priority: 30,
    building_id: null
  },
  {
    category: 'Waste & Recycling',
    subcategory: 'Recycling',
    question: 'What can I recycle and when is it collected?',
    answer: 'Recycling is collected every Tuesday. Accepted items: paper, cardboard, plastic bottles, glass, and aluminum cans.',
    keywords: ['recycling', 'recycle', 'green', 'environment', 'collection'],
    priority: 31,
    building_id: null
  },
  {
    category: 'Waste & Recycling',
    subcategory: 'Bulk Items',
    question: 'How do I dispose of large items?',
    answer: 'Bulk item pickup is available on the first Saturday of each month. Please schedule with the office at least 48 hours in advance.',
    keywords: ['bulk', 'large', 'furniture', 'disposal', 'pickup'],
    priority: 32,
    building_id: null
  },

  // Access & Keys
  {
    category: 'Access & Keys',
    subcategory: 'Lost Key',
    question: 'What do I do if I lost my key or fob?',
    answer: 'Lost keys or fobs can be replaced at the office for a $50 fee. Temporary access can be arranged for emergencies.',
    keywords: ['lost', 'key', 'fob', 'replacement', 'access'],
    priority: 40,
    building_id: null
  },
  {
    category: 'Access & Keys',
    subcategory: 'Guest Access',
    question: 'How can my guests access the building?',
    answer: 'Guests can be buzzed in through the intercom system. For extended stays, temporary access codes can be arranged through the office.',
    keywords: ['guest', 'visitor', 'access', 'intercom', 'buzzer'],
    priority: 41,
    building_id: null
  },
  {
    category: 'Access & Keys',
    subcategory: 'Emergency',
    question: 'What if I get locked out after hours?',
    answer: 'For emergency lockouts after hours, call our 24/7 emergency line at (555) 123-4567. A fee may apply for after-hours service.',
    keywords: ['emergency', 'lockout', 'after hours', '24/7', 'help'],
    priority: 42,
    building_id: null
  },

// Additional common FAQs
  {
    category: 'Maintenance',
    question: 'How do I report a maintenance issue?',
    answer: 'You can report maintenance issues through this chatbot by selecting "Report Issue" from the main menu, or contact the office during business hours.',
    keywords: ['maintenance', 'repair', 'fix', 'broken', 'report'],
    priority: 50,
    building_id: null
  },
  {
    category: 'Amenities',
    question: 'How do I book an amenity?',
    answer: 'You can book amenities through this chatbot by selecting "Book Amenity" from the main menu, or visit the office to make a reservation.',
    keywords: ['amenity', 'book', 'reservation', 'facility', 'reserve'],
    priority: 60,
    building_id: null
  },
  {
    category: 'Payments',
    question: 'How do I pay rent?',
    answer: 'Rent can be paid online through our resident portal, by check at the office, or through automatic bank transfer. Rent is due on the 1st of each month.',
    keywords: ['rent', 'payment', 'pay', 'due', 'portal'],
    priority: 70,
    building_id: null
  },
  {
    category: 'Emergencies',
    question: 'What do I do in case of emergency?',
    answer: 'For life-threatening emergencies, call 911. For building emergencies (flooding, fire alarm, etc.), call our 24/7 emergency line at (555) 123-4567.',
    keywords: ['emergency', '911', 'urgent', 'help', 'fire', 'flood'],
    priority: 1,
    building_id: null
  }
];

async function populateFAQs() {
  console.log('🚀 Starting FAQ population...\n');

  try {
    // First, clear existing FAQs to avoid duplicates (optional)
    console.log('🧹 Clearing existing FAQs...');
    const { error: deleteError } = await supabaseAdmin
      .from('faqs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all except a non-existent ID

    if (deleteError) {
      console.error('Error clearing FAQs:', deleteError);
      console.log('Continuing anyway...\n');
    } else {
      console.log('✅ Existing FAQs cleared\n');
    }

    // Insert new FAQs
    console.log(`📝 Inserting ${faqsToInsert.length} FAQs...`);
    
    for (const faq of faqsToInsert) {
      const { error } = await supabaseAdmin
        .from('faqs')
        .insert({
          category: faq.category,
          question: faq.question,
          answer: faq.answer,
          keywords: faq.keywords,
          priority: faq.priority,
          building_id: faq.building_id,
          is_published: true,
          views_count: 0,
          helpful_count: 0
        });

      if (error) {
        console.error(`❌ Error inserting FAQ "${faq.question}":`, error.message);
      } else {
        console.log(`✅ Inserted: ${faq.category} - ${faq.question.substring(0, 40)}...`);
      }
    }

    // Verify insertion
    const { count } = await supabaseAdmin
      .from('faqs')
      .select('*', { count: 'exact', head: true });

    console.log(`\n✨ FAQ population complete! Total FAQs in database: ${count}`);

    // Show category summary
    const { data: categories } = await supabaseAdmin
      .from('faqs')
      .select('category');

    if (categories) {
      const uniqueCategories = [...new Set(categories.map(c => c.category))];
      console.log('📁 Categories:', uniqueCategories.join(', '));
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }

  process.exit(0);
}

populateFAQs();
