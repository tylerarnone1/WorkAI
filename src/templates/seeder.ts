import { getPrisma } from '../core/database/index.js';
import { createChildLogger } from '../core/logger/index.js';
import { ROLE_TEMPLATES, BACKGROUNDS } from './seed-data.js';

const log = createChildLogger({ module: 'template-seeder' });

export async function seedTemplates(): Promise<void> {
  const prisma = getPrisma();

  log.info('Starting template seeding...');

  try {
    // Seed role templates
    for (const template of ROLE_TEMPLATES) {
      log.info({ role: template.role }, 'Seeding role template...');

      const createdTemplate = await prisma.roleTemplate.upsert({
        where: { slug: template.slug },
        create: template,
        update: template,
      });

      // Seed backgrounds for this role
      const backgrounds = BACKGROUNDS[template.slug] || [];
      for (const background of backgrounds) {
        log.info({ role: template.role, background: background.name }, 'Seeding background...');

        await prisma.background.upsert({
          where: {
            templateId_slug: {
              templateId: createdTemplate.id,
              slug: background.slug,
            },
          },
          create: {
            ...background,
            templateId: createdTemplate.id,
          },
          update: background,
        });
      }
    }

    log.info('Template seeding complete!');
    log.info(
      {
        roles: ROLE_TEMPLATES.length,
        totalBackgrounds: Object.values(BACKGROUNDS).flat().length,
      },
      'Seeded data summary',
    );
  } catch (err) {
    log.error({ err }, 'Template seeding failed');
    throw err;
  }
}

// CLI runner
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTemplates()
    .then(() => {
      console.log('✅ Templates seeded successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Template seeding failed:', err);
      process.exit(1);
    });
}
