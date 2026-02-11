import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/backend";
import { resolveActorIdentity, withActorCookie } from "@/lib/actor";

export async function GET(request: NextRequest) {
  try {
    const prisma = getPrisma();
    const actor = await resolveActorIdentity(request);

    let hiredAgents = await prisma.hiredAgent.findMany({
      where: { status: "active" },
      include: {
        agent: true,
        template: true,
        background: true,
      },
      orderBy: { hiredAt: "desc" },
    });

    // Multi-user scope:
    // - authenticated users see only their owned hires (`user:<email>`)
    // - anonymous sessions see only their cookie-scoped hires (`anon:<id>`)
    //
    // Legacy migration path:
    // if an authenticated actor has no scoped hires but legacy rows exist with null `hiredBy`,
    // claim them once to preserve pre-multi-user data.
    if (actor.isAuthenticated) {
      let actorScoped = hiredAgents.filter(
        (item) => item.hiredBy === actor.actorKey
      );

      if (actorScoped.length === 0) {
        const legacyCount = hiredAgents.filter((item) => item.hiredBy == null)
          .length;
        if (legacyCount > 0) {
          await prisma.hiredAgent.updateMany({
            where: {
              status: "active",
              hiredBy: null,
            },
            data: {
              hiredBy: actor.actorKey,
            },
          });

          hiredAgents = await prisma.hiredAgent.findMany({
            where: { status: "active" },
            include: {
              agent: true,
              template: true,
              background: true,
            },
            orderBy: { hiredAt: "desc" },
          });
          actorScoped = hiredAgents.filter(
            (item) => item.hiredBy === actor.actorKey
          );
        }
      }

      hiredAgents = actorScoped;
    } else {
      hiredAgents = hiredAgents.filter((item) => item.hiredBy === actor.actorKey);
    }

    type HiredAgentRecord = {
      id: string;
      agentId: string;
      generatedName: string;
      hiredAt: Date;
      agent: { enabled: boolean; containerInfo: unknown };
      template: { role: string };
      background: { name: string };
    };

    const agents = (hiredAgents as HiredAgentRecord[]).map((hiredAgent) => ({
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
      hiredAt: hiredAgent.hiredAt.toISOString(),
      backgroundName: hiredAgent.background.name,
    }));

    const response = NextResponse.json({ agents });
    return withActorCookie(response, actor);
  } catch (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch agents",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
