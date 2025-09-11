import { facebookService } from './services/facebook.service';

async function setup() {
  try {
    console.log('Setting up Facebook Messenger profile...');
    
    // Set greeting message
    await facebookService.setGreeting();
    console.log('✅ Greeting message set');
    
    // Set get started button
    await facebookService.setGetStarted();
    console.log('✅ Get started button set');
    
    // Set persistent menu
    await facebookService.setPersistentMenu();
    console.log('✅ Persistent menu set');
    
    console.log('\n🎉 Setup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

setup();
