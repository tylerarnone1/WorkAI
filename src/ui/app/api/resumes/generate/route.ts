import { NextRequest, NextResponse } from "next/server";
import { getResumeGenerator, getPrisma } from "@/lib/backend";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const roleSlug = searchParams.get("role");

    if (!roleSlug) {
      return NextResponse.json(
        { error: "Role parameter is required" },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    const resumeGenerator = getResumeGenerator();

    // Find the role template by slug
    const template = await prisma.roleTemplate.findUnique({
      where: { slug: roleSlug },
      include: { backgrounds: true },
    });

    if (!template) {
      return NextResponse.json(
        { error: `Role template not found: ${roleSlug}` },
        { status: 404 }
      );
    }

    if (template.backgrounds.length === 0) {
      return NextResponse.json(
        { error: `No backgrounds found for role: ${roleSlug}` },
        { status: 404 }
      );
    }

    // Generate resumes for all backgrounds (up to 3)
    type BackgroundRecord = {
      id: string;
      name: string;
      description: string;
      personalityTraits: string[];
      workingStyle: string;
    };

    const backgroundsToGenerate = template.backgrounds.slice(
      0,
      3
    ) as BackgroundRecord[];
    const resumes = await Promise.all(
      backgroundsToGenerate.map(async (background) => {
        const resumeData = await resumeGenerator.generateResume(
          template as any, // Type conversion needed
          background as any
        );

        return {
          id: background.id,
          name: resumeData.name,
          generationSource: resumeData.generationSource ?? "llm",
          backgroundName: background.name,
          backgroundDescription: background.description,
          summary: resumeData.workingStyle,
          experience: resumeData.experience.map((exp) => ({
            title: exp.position,
            company: exp.company,
            duration: exp.duration,
            highlights: exp.achievements,
          })),
          skills: resumeData.skills,
          personality: background.personalityTraits,
          workingStyle: background.workingStyle,
        };
      })
    );

    return NextResponse.json({ resumes });
  } catch (error) {
    console.error("Error generating resumes:", error);
    return NextResponse.json(
      {
        error: "Failed to generate resumes",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
