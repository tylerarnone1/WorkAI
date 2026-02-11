import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { ROLE_TEMPLATES, BACKGROUNDS } from "../src/templates/seed-data.js";

// Load environment variables
config();

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seed...");

  // Clear existing data
  console.log("Clearing existing templates and backgrounds...");
  await prisma.background.deleteMany();
  await prisma.roleTemplate.deleteMany();

  // Seed role templates with backgrounds
  for (const template of ROLE_TEMPLATES) {
    console.log(`Creating role template: ${template.role}`);
    const backgrounds = BACKGROUNDS[template.slug] ?? [];

    const createdTemplate = await prisma.roleTemplate.create({
      data: {
        role: template.role,
        slug: template.slug,
        category: template.category,
        team: template.team,
        reportsTo: template.reportsTo ?? null,
        icon: template.icon,
        description: template.description,
        needsContainer: template.needsContainer,
        baseSystemPrompt: template.baseSystemPrompt,
        defaultTools: template.defaultTools,
        requiredExpertise: template.requiredExpertise,
        priority: template.priority,
        backgrounds: {
          create: backgrounds.map((bg) => ({
            name: bg.name,
            slug: bg.slug,
            industry: bg.industry,
            description: bg.description,
            personalityTraits: bg.personalityTraits,
            workingStyle: bg.workingStyle,
            promptModifiers: bg.promptModifiers,
            expertiseBoost: bg.expertiseBoost,
            priority: bg.priority,
          })),
        },
      },
      include: {
        backgrounds: true,
      },
    });

    console.log(
      `  ✓ Created ${createdTemplate.role} with ${createdTemplate.backgrounds.length} backgrounds`
    );
  }

  console.log("\n✅ Database seed completed!");

  // Print summary
  const templateCount = await prisma.roleTemplate.count();
  const backgroundCount = await prisma.background.count();

  console.log(`\nSummary:`);
  console.log(`  - ${templateCount} role templates`);
  console.log(`  - ${backgroundCount} backgrounds`);
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
