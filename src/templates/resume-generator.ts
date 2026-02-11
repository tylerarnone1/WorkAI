import { LLMClient } from '../llm/client.js';
import { createChildLogger } from '../core/logger/index.js';
import type { RoleTemplateDefinition, BackgroundDefinition, ResumeData } from './types.js';

const log = createChildLogger({ module: 'resume-generator' });

export class ResumeGenerator {
  private llmClient: LLMClient;

  constructor(llmClient?: LLMClient) {
    const openaiApiKey = process.env['OPENAI_API_KEY']?.trim();
    const anthropicApiKey = process.env['ANTHROPIC_API_KEY']?.trim();
    const provider = openaiApiKey ? 'openai' : 'anthropic';
    const apiKey = openaiApiKey ?? anthropicApiKey ?? '';
    const model =
      provider === 'openai'
        ? process.env['OPENAI_MODEL'] ?? 'gpt-4o-mini'
        : process.env['ANTHROPIC_MODEL'] ?? 'claude-haiku-4-5';

    this.llmClient =
      llmClient ??
      new LLMClient(provider, {
        apiKey,
        model,
        ...(provider === 'openai' && process.env['OPENAI_BASE_URL']
          ? { baseUrl: process.env['OPENAI_BASE_URL'] }
          : {}),
      });
  }

  /**
   * Generate a realistic resume for a role + background combination
   */
  async generateResume(
    role: RoleTemplateDefinition,
    background: BackgroundDefinition,
  ): Promise<ResumeData> {
    log.info({ role: role.role, background: background.name }, 'Generating resume...');

    const prompt = this.buildPrompt(role, background);
    let lastError: unknown;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await this.llmClient.complete({
          messages: [
            {
              role: 'user',
              content:
                attempt === 1
                  ? prompt
                  : `${prompt}\n\nIMPORTANT: Return a single valid JSON object only. No markdown, no explanations.`,
            },
          ],
          jsonMode: true,
          // Some models only support default temperature.
          ...(attempt === 1 ? { temperature: 0.8 } : {}),
          maxTokens: 2000,
        });

        const resumeData = this.parseResumeFromText(response.content);
        resumeData.generationSource = 'llm';

        log.info(
          { role: role.role, background: background.name, name: resumeData.name, attempt },
          'Resume generated successfully',
        );

        return resumeData;
      } catch (err) {
        lastError = err;
        const errMessage = err instanceof Error ? err.message : String(err);
        log.warn(
          { err: errMessage, role: role.role, background: background.name, attempt },
          'Resume generation attempt failed',
        );
      }
    }

    const fallbackReason =
      lastError instanceof Error ? lastError.message : String(lastError);
    log.error(
      { reason: fallbackReason, role: role.role, background: background.name },
      'Falling back to deterministic resume',
    );
    return this.buildFallbackResume(role, background);
  }

  /**
   * Generate resumes for all role+background combinations
   */
  async generateAllResumes(
    roles: RoleTemplateDefinition[],
    backgrounds: Record<string, BackgroundDefinition[]>,
  ): Promise<Map<string, ResumeData[]>> {
    const results = new Map<string, ResumeData[]>();

    for (const role of roles) {
      const roleBackgrounds = backgrounds[role.slug] || [];
      const resumes: ResumeData[] = [];

      for (const background of roleBackgrounds) {
        const resume = await this.generateResume(role, background);
        resumes.push(resume);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      results.set(role.slug, resumes);
    }

    return results;
  }

  private buildPrompt(role: RoleTemplateDefinition, background: BackgroundDefinition): string {
    return `You are an AI that generates realistic resumes for virtual AI employees. Generate a resume for the following role and background:

**Role:** ${role.role}
**Category:** ${role.category}
**Background:** ${background.name}
**Industry:** ${background.industry}
**Description:** ${background.description}
**Personality Traits:** ${background.personalityTraits.join(', ')}
**Working Style:** ${background.workingStyle}

Generate a realistic resume in JSON format with the following structure:

{
  "name": "FirstName LastName",
  "role": "${role.role}",
  "background": "${background.name}",
  "experience": [
    {
      "company": "Company Name (real company in ${background.industry} industry)",
      "position": "Job Title",
      "duration": "Year-Year (2-4 years each)",
      "achievements": [
        "Specific achievement with metrics (e.g., 'Increased X by Y%')",
        "Another achievement with concrete results",
        "One more achievement showing impact"
      ]
    },
    // 2-3 positions total, showing 6-10 years experience
  ],
  "skills": ["skill1", "skill2", "skill3", ...], // 5-8 relevant skills
  "workingStyle": "One sentence describing how they work (based on background)",
  "personality": ["trait1", "trait2", "trait3"] // From personality traits
}

**Requirements:**
- Use a realistic, diverse name (various ethnicities, genders)
- Use REAL companies from the ${background.industry} industry
- Include 2-3 previous positions showing career progression
- Total experience: 6-10 years
- Achievements must have SPECIFIC metrics and numbers
- Skills should match the role's expertise: ${role.requiredExpertise.join(', ')}
- Working style should reflect: ${background.workingStyle}

**Example (for SEO Engineer with Consumer Tech background):**

{
  "name": "Jordan Kim",
  "role": "SEO Engineer",
  "background": "Consumer Tech Innovator",
  "experience": [
    {
      "company": "Notion",
      "position": "Senior SEO Manager",
      "duration": "2021-2024",
      "achievements": [
        "Grew organic traffic from 2M to 8M monthly visitors (300% increase)",
        "Implemented technical SEO framework that improved site speed by 40%",
        "Led content strategy resulting in 500+ high-authority backlinks"
      ]
    },
    {
      "company": "Airbnb",
      "position": "SEO Specialist",
      "duration": "2018-2021",
      "achievements": [
        "Optimized 50,000+ listing pages for local search, increasing bookings 25%",
        "Built automated keyword research system processing 100K queries monthly",
        "Improved Core Web Vitals scores across 15 international markets"
      ]
    },
    {
      "company": "Dropbox",
      "position": "Digital Marketing Analyst",
      "duration": "2016-2018",
      "achievements": [
        "Conducted A/B tests on landing pages, improving conversion rate 35%",
        "Analyzed user search behavior leading to 3 major product insights",
        "Collaborated with product team on SEO-friendly feature launches"
      ]
    }
  ],
  "skills": ["Technical SEO", "Google Analytics", "A/B Testing", "Python", "Data Analysis", "Content Strategy", "User Research"],
  "workingStyle": "Fast iteration and experimentation. Loves trying new tactics and measuring everything.",
  "personality": ["creative", "experimental", "user-obsessed"]
}

Now generate the resume for ${role.role} with ${background.name} background. Return ONLY the JSON, no additional text.`;
  }

  private parseResumeFromText(text: string): ResumeData {
    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from LLM response');
    }

    try {
      const resume = JSON.parse(jsonMatch[0]) as ResumeData;

      // Validate required fields
      if (
        !resume.name ||
        !resume.role ||
        !resume.background ||
        !resume.experience ||
        !resume.skills ||
        !resume.workingStyle ||
        !resume.personality
      ) {
        throw new Error('Resume missing required fields');
      }

      if (resume.experience.length < 2) {
        throw new Error('Resume must have at least 2 previous positions');
      }

      return resume;
    } catch (err) {
      const preview = text.slice(0, 400);
      const errMessage = err instanceof Error ? err.message : String(err);
      log.warn({ err: errMessage, preview }, 'Failed to parse resume JSON');
      throw new Error(`Failed to parse resume: ${err}`);
    }
  }

  private buildFallbackResume(
    role: RoleTemplateDefinition,
    background: BackgroundDefinition,
  ): ResumeData {
    const fallbackName = this.buildFallbackName(background);
    const coreSkills = role.requiredExpertise.slice(0, 6);

    return {
      name: fallbackName,
      role: role.role,
      background: background.name,
      generationSource: 'fallback',
      experience: [
        {
          company: `${background.industry} Systems`,
          position: `Senior ${role.role}`,
          duration: '2021-2024',
          achievements: [
            'Led cross-functional initiatives with measurable business impact',
            'Improved team throughput and delivery consistency',
            'Built repeatable processes adopted across multiple projects',
          ],
        },
        {
          company: `${background.industry} Labs`,
          position: role.role,
          duration: '2018-2021',
          achievements: [
            'Delivered production-ready work under tight deadlines',
            'Collaborated with engineering and operations on implementation',
            'Created documentation and playbooks to improve onboarding',
          ],
        },
      ],
      skills: coreSkills.length > 0 ? coreSkills : ['communication', 'execution'],
      workingStyle: background.workingStyle,
      personality: background.personalityTraits.slice(0, 3),
    };
  }

  private buildFallbackName(background: BackgroundDefinition): string {
    const firstNames = ['Jordan', 'Taylor', 'Avery', 'Morgan', 'Riley'];
    const lastNames = ['Reed', 'Patel', 'Nguyen', 'Kim', 'Rivera'];
    const seed = (background.name + background.slug).length;
    const first = firstNames[seed % firstNames.length]!;
    const last = lastNames[(seed * 3) % lastNames.length]!;
    return `${first} ${last}`;
  }
}
