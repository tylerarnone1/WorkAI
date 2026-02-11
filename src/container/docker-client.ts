import Docker from 'dockerode';
import { createChildLogger } from '../core/logger/index.js';

const log = createChildLogger({ module: 'docker-client' });

let dockerClient: Docker | null = null;

export function getDockerClient(): Docker {
  if (!dockerClient) {
    dockerClient = new Docker({
      // Use default Docker socket/pipe depending on OS
      // On Windows: //./pipe/docker_engine
      // On Unix: /var/run/docker.sock
    });
  }
  return dockerClient;
}

export async function checkDockerAvailable(): Promise<boolean> {
  try {
    const docker = getDockerClient();
    await docker.ping();
    log.info('Docker daemon is available');
    return true;
  } catch (err) {
    log.error({ err }, 'Docker daemon is not available');
    return false;
  }
}

export async function ensureImageExists(imageName: string): Promise<boolean> {
  try {
    const docker = getDockerClient();
    const images = await docker.listImages({
      filters: { reference: [imageName] },
    });

    if (images.length > 0) {
      log.info({ imageName }, 'Docker image found');
      return true;
    }

    log.warn({ imageName }, 'Docker image not found');
    return false;
  } catch (err) {
    log.error({ err, imageName }, 'Failed to check if image exists');
    return false;
  }
}

export async function buildImage(
  dockerfilePath: string,
  imageName: string,
  tag = 'latest',
): Promise<void> {
  const docker = getDockerClient();
  const fullImageName = `${imageName}:${tag}`;

  log.info({ dockerfilePath, fullImageName }, 'Building Docker image...');

  return new Promise((resolve, reject) => {
    docker.buildImage(
      {
        context: dockerfilePath,
        src: ['Dockerfile'],
      },
      { t: fullImageName },
      (err, stream) => {
        if (err) {
          log.error({ err }, 'Failed to start image build');
          return reject(err);
        }

        docker.modem.followProgress(
          stream!,
          (err, _res) => {
            if (err) {
              log.error({ err }, 'Image build failed');
              return reject(err);
            }
            log.info({ fullImageName }, 'Image built successfully');
            resolve();
          },
          (event) => {
            if (event.stream) {
              process.stdout.write(event.stream);
            }
          },
        );
      },
    );
  });
}
