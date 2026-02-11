export interface RoleTemplateDefinition {
  role: string;
  slug: string;
  category: 'Marketing' | 'Engineering' | 'Operations';
  team: string;
  reportsTo?: string;
  icon: string;
  description: string;
  baseSystemPrompt: string;
  defaultTools: string[];
  requiredExpertise: string[];
  needsContainer: boolean;
  priority: number;
}

export interface BackgroundDefinition {
  name: string;
  slug: string;
  industry: string;
  description: string;
  personalityTraits: string[];
  workingStyle: string;
  promptModifiers: string;
  expertiseBoost: string[];
  priority: number;
}

export interface ResumeData {
  name: string;
  role: string;
  background: string;
  generationSource?: 'llm' | 'fallback';
  experience: Array<{
    company: string;
    position: string;
    duration: string;
    achievements: string[];
  }>;
  skills: string[];
  workingStyle: string;
  personality: string[];
}
