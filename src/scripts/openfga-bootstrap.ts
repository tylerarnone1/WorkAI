import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  OpenFgaClient,
  CredentialsMethod,
  ClientWriteRequestOnDuplicateWrites,
  type WriteAuthorizationModelRequest,
} from '@openfga/sdk';
import { PrismaClient } from '@prisma/client';

type Tuple = {
  user: string;
  relation: string;
  object: string;
};

const integrationPattern =
  /^(github|jira|clickup|gmail|hubspot|argocd|drive|calendar|figma)_/;
const writeOperationPattern =
  /(create|update|delete|send|sync|rollback|transition|comment)/;

async function main(): Promise<void> {
  const apiUrl = process.env['OPENFGA_API_URL'];
  if (!apiUrl) {
    throw new Error('OPENFGA_API_URL is required.');
  }

  const apiToken = process.env['OPENFGA_API_TOKEN'];
  const credentials = apiToken
    ? {
        method: CredentialsMethod.ApiToken as CredentialsMethod.ApiToken,
        config: { token: apiToken },
      }
    : undefined;

  const bootstrapClient = new OpenFgaClient({
    apiUrl,
    credentials,
  });

  let storeId = process.env['OPENFGA_STORE_ID'];
  if (!storeId) {
    const created = await bootstrapClient.createStore({
      name: `agents-${Date.now()}`,
    });
    storeId = created.id;
    console.log(`Created OpenFGA store: ${storeId}`);
  }

  const modelPath = resolve(
    process.cwd(),
    process.env['OPENFGA_MODEL_FILE'] ?? 'openfga/model.json',
  );
  const rawModel = await readFile(modelPath, 'utf8');
  const model = JSON.parse(rawModel) as WriteAuthorizationModelRequest;

  const client = new OpenFgaClient({
    apiUrl,
    storeId,
    authorizationModelId: process.env['OPENFGA_MODEL_ID'],
    credentials,
  });

  const modelResult = await client.writeAuthorizationModel(model);
  const modelId = modelResult.authorization_model_id;
  console.log(`Wrote authorization model: ${modelId}`);

  const seedFromDb =
    (process.env['OPENFGA_SEED_FROM_DB'] ?? 'true').toLowerCase() === 'true';
  if (seedFromDb) {
    const seeded = await seedTuplesFromDatabase(client);
    console.log(`Seeded ${seeded} OpenFGA tuples from database`);
  } else {
    console.log('Skipped tuple seeding (OPENFGA_SEED_FROM_DB=false)');
  }

  console.log('\nSet these in your env:');
  console.log(`OPENFGA_API_URL=${apiUrl}`);
  console.log(`OPENFGA_STORE_ID=${storeId}`);
  console.log(`OPENFGA_MODEL_ID=${modelId}`);
}

async function seedTuplesFromDatabase(client: OpenFgaClient): Promise<number> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    console.log('DATABASE_URL not set; skipping DB tuple seeding.');
    return 0;
  }

  const prisma = new PrismaClient();
  const tuples = new Map<string, Tuple>();

  try {
    const agents = await prisma.agent.findMany({
      where: { enabled: true },
      select: {
        name: true,
        tools: true,
        canDelegate: true,
      },
    });

    for (const agent of agents) {
      const user = `agent:${normalize(agent.name)}`;

      for (const tool of agent.tools) {
        addTuple(tuples, {
          user,
          relation: 'can_execute',
          object: `tool:${normalize(tool)}`,
        });

        const providerMatch = tool.match(integrationPattern);
        if (providerMatch) {
          const provider = providerMatch[1];
          const relation = writeOperationPattern.test(tool)
            ? 'can_write'
            : 'can_read';
          addTuple(tuples, {
            user,
            relation,
            object: `integration:${provider}`,
          });
        }

        if (tool === 'memory_store') {
          addTuple(tuples, {
            user,
            relation: 'can_write',
            object: 'memory:shared',
          });
        }
      }

      for (const target of agent.canDelegate) {
        addTuple(tuples, {
          user,
          relation: 'can_delegate',
          object: `agent:${normalize(target)}`,
        });
      }
    }

    // Allow messaging across all active agents by default.
    for (const source of agents) {
      for (const target of agents) {
        if (source.name === target.name) continue;
        addTuple(tuples, {
          user: `agent:${normalize(source.name)}`,
          relation: 'can_message',
          object: `agent:${normalize(target.name)}`,
        });
      }
    }

    const allTuples = Array.from(tuples.values());
    const chunkSize = 100;
    for (let i = 0; i < allTuples.length; i += chunkSize) {
      const chunk = allTuples.slice(i, i + chunkSize);
      await client.writeTuples(chunk, {
        conflict: {
          onDuplicateWrites: ClientWriteRequestOnDuplicateWrites.Ignore,
        },
      });
    }

    return allTuples.length;
  } finally {
    await prisma.$disconnect();
  }
}

function addTuple(target: Map<string, Tuple>, tuple: Tuple): void {
  target.set(`${tuple.user}|${tuple.relation}|${tuple.object}`, tuple);
}

function normalize(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9:_-]/g, '_');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
