import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/backend";
import { resolveActorIdentity, withActorCookie } from "@/lib/actor";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const prisma = getPrisma();
    const actor = await resolveActorIdentity(request);

    const hiredAgent = await prisma.hiredAgent.findFirst({
      where: {
        agentId: id,
        hiredBy: actor.actorKey,
      },
      include: {
        agent: true,
        template: true,
        background: true,
      },
    });

    if (!hiredAgent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const agent = {
      id: hiredAgent.id,
      agentId: hiredAgent.agentId,
      name: hiredAgent.generatedName,
      role: hiredAgent.template.role,
      status: hiredAgent.agent.enabled ? "active" : "stopped",
      currentTask: null, // TODO: Get from agent's current conversation
      tokenUsage: {
        today: 0, // TODO: Calculate from conversations
        total: 0, // TODO: Calculate from conversations
      },
      containerInfo: hiredAgent.agent.containerInfo as any,
      background: {
        name: hiredAgent.background.name,
        description: hiredAgent.background.description,
        personalityTraits: hiredAgent.background.personalityTraits,
        workingStyle: hiredAgent.background.workingStyle,
      },
      hiredAt: hiredAgent.hiredAt.toISOString(),
    };

    const response = NextResponse.json({ agent });
    return withActorCookie(response, actor);
  } catch (error) {
    console.error("Error fetching agent:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch agent",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
