import { createServer, type Server } from 'node:http';
import type { AgentRegistry } from './agent-registry.js';
import { getPrisma } from '../core/database/index.js';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'health' });

export class HealthServer {
  private server: Server | undefined;

  constructor(private agentRegistry: AgentRegistry) {}

  start(port: number, host: string): void {
    this.server = createServer(async (req, res) => {
      if (req.url === '/health') {
        try {
          // Check DB connection
          await getPrisma().$queryRaw`SELECT 1`;

          const agents = this.agentRegistry.getAll().map((a) => ({
            name: a.name,
            displayName: a.displayName,
            state: a.state,
          }));

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              status: 'healthy',
              timestamp: new Date().toISOString(),
              agents,
            }),
          );
        } catch (err) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              status: 'unhealthy',
              error: err instanceof Error ? err.message : 'Unknown error',
            }),
          );
        }
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    this.server.listen(port + 1, host, () => {
      log.info({ port: port + 1, host }, 'Health server started');
    });
  }

  stop(): void {
    this.server?.close();
  }
}
