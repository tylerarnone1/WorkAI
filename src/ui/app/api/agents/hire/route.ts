import { NextRequest, NextResponse } from "next/server";
import { getAgentLoader, getPrisma } from "@/lib/backend";
import { resolveActorIdentity, withActorCookie } from "@/lib/actor";

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveActorIdentity(request);
    const body = await request.json();
    const { templateId, backgroundId, generatedName, generatedResume } = body;

    if (!templateId || !backgroundId || !generatedName || !generatedResume) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const agentLoader = getAgentLoader();

    // Hire the agent using DynamicAgentLoader
    const loadedAgent = await agentLoader.hireAgent({
      templateId, // This should be the role slug like "seo-engineer"
      backgroundId,
      generatedName,
      generatedResume,
      hiredBy: actor.actorKey,
    });

    // Get the hired agent record with template info
    const prisma = getPrisma();
    const hiredAgent = await prisma.hiredAgent.findUnique({
      where: { agentId: loadedAgent.agent.id },
      include: {
        template: true,
        agent: true,
      },
    });

    if (!hiredAgent) {
      throw new Error("Failed to find hired agent after creation");
    }

    const response = NextResponse.json({
      agent: {
        id: hiredAgent.agentId,
        name: hiredAgent.generatedName,
        role: hiredAgent.template.role,
        status: hiredAgent.status,
        hiredAt: hiredAgent.hiredAt.toISOString(),
        containerInfo: hiredAgent.agent.containerInfo,
      },
    });
    return withActorCookie(response, actor);
  } catch (error) {
    console.error("Error hiring agent:", error);
    return NextResponse.json(
      {
        error: "Failed to hire agent",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
