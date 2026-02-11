import { ResumeGenerator } from './resume-generator.js';
import { ROLE_TEMPLATES, BACKGROUNDS } from './seed-data.js';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'test-resume-generator' });

async function testResumeGeneration() {
  log.info('Testing resume generator...');

  const generator = new ResumeGenerator();

  // Test with SEO Engineer + Energy Sector background
  const seoRole = ROLE_TEMPLATES.find(r => r.slug === 'seo-engineer');
  const energyBackground = BACKGROUNDS['seo-engineer']?.find(b => b.slug === 'energy-sector');

  if (!seoRole || !energyBackground) {
    throw new Error('Could not find test role/background');
  }

  log.info('Generating resume for SEO Engineer (Energy Sector Veteran)...');
  const resume = await generator.generateResume(seoRole, energyBackground);

  console.log('\n========================================');
  console.log('GENERATED RESUME');
  console.log('========================================\n');
  console.log(`Name: ${resume.name}`);
  console.log(`Role: ${resume.role}`);
  console.log(`Background: ${resume.background}\n`);

  console.log('EXPERIENCE:');
  resume.experience.forEach((exp, idx) => {
    console.log(`\n${idx + 1}. ${exp.position} @ ${exp.company}`);
    console.log(`   Duration: ${exp.duration}`);
    console.log('   Achievements:');
    exp.achievements.forEach(achievement => {
      console.log(`   • ${achievement}`);
    });
  });

  console.log(`\nSKILLS: ${resume.skills.join(', ')}`);
  console.log(`\nWORKING STYLE: ${resume.workingStyle}`);
  console.log(`\nPERSONALITY: ${resume.personality.join(', ')}`);
  console.log('\n========================================\n');

  log.info('Resume generation test complete!');
}

// Run test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testResumeGeneration()
    .then(() => {
      console.log('✅ Test completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Test failed:', err);
      process.exit(1);
    });
}
