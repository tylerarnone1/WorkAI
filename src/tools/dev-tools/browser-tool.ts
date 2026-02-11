import type { ITool, ToolDefinition, ToolResult, ToolExecutionContext } from '../types.js';
import { getDockerClient } from '../../container/docker-client.js';
import { createChildLogger } from '../../core/logger/index.js';

const log = createChildLogger({ module: 'browser-tool' });

export class BrowserTool implements ITool {
  definition: ToolDefinition = {
    name: 'browser_screenshot',
    description:
      'Take a screenshot of a URL (usually your local dev server). This lets you see the UI you\'re building. Essential for frontend work.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to screenshot (e.g., http://localhost:3000)',
        },
        waitForSelector: {
          type: 'string',
          description: 'Optional CSS selector to wait for before taking screenshot',
        },
        fullPage: {
          type: 'boolean',
          description: 'Capture full page (default: true)',
        },
        viewport: {
          type: 'object',
          properties: {
            width: { type: 'number' },
            height: { type: 'number' },
          },
          description: 'Viewport size (default: 1280x720)',
        },
      },
      required: ['url'],
    },
    category: 'development',
  };

  async execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    const url = args['url'] as string;
    const waitForSelector = args['waitForSelector'] as string | undefined;
    const fullPage = (args['fullPage'] as boolean) ?? true;
    const viewport = (args['viewport'] as { width: number; height: number }) ?? {
      width: 1280,
      height: 720,
    };

    const containerName = `agent-${context.agentId}`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = `/workspace/screenshots/screenshot-${timestamp}.png`;

    try {
      const docker = getDockerClient();
      const container = docker.getContainer(containerName);

      // Create Playwright script
      const playwrightScript = `
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: ${viewport.width}, height: ${viewport.height} }
  });
  const page = await context.newPage();

  try {
    await page.goto('${url}', { waitUntil: 'networkidle', timeout: 30000 });
    ${waitForSelector ? `await page.waitForSelector('${waitForSelector}', { timeout: 10000 });` : ''}
    await page.screenshot({
      path: '${screenshotPath}',
      fullPage: ${fullPage}
    });
    console.log('Screenshot saved successfully');
  } catch (err) {
    console.error('Screenshot failed:', err.message);
    throw err;
  } finally {
    await browser.close();
  }
})();
`;

      const scriptPath = '/tmp/screenshot.js';

      // Write script to container
      await this.writeFileToContainer(container, scriptPath, playwrightScript);

      // Ensure playwright is installed in workspace
      const installExec = await container.exec({
        Cmd: ['bash', '-c', 'cd /workspace && npm list playwright || npm install playwright'],
        AttachStdout: true,
        AttachStderr: true,
      });

      await installExec.start({});

      // Execute screenshot script
      const exec = await container.exec({
        Cmd: ['node', scriptPath],
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: '/workspace',
      });

      const stream = await exec.start({});
      let output = '';

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          output += chunk.slice(8).toString();
        });
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      const inspectResult = await exec.inspect();
      const exitCode = inspectResult.ExitCode ?? 0;

      if (exitCode !== 0) {
        return {
          success: false,
          output: `Screenshot failed:\n${output}`,
        };
      }

      // Copy screenshot from container to host (for viewing in UI)
      // This would be used in the hiring UI to show agents what they built
      log.info(
        { agentId: context.agentId, url, screenshotPath },
        'Screenshot captured successfully',
      );

      return {
        success: true,
        output: `Screenshot saved to ${screenshotPath}\n\nTo view: The screenshot is available in your workspace at ${screenshotPath}`,
      };
    } catch (err) {
      log.error({ err, agentId: context.agentId, url }, 'Failed to capture screenshot');
      return {
        success: false,
        output: `Failed to capture screenshot: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }

  private async writeFileToContainer(
    container: any,
    filePath: string,
    content: string,
  ): Promise<void> {
    const exec = await container.exec({
      Cmd: ['bash', '-c', `cat > ${filePath} << 'PLAYWRIGHT_SCRIPT_EOF'\n${content}\nPLAYWRIGHT_SCRIPT_EOF`],
      AttachStdout: true,
      AttachStderr: true,
    });

    await exec.start({});
  }
}
