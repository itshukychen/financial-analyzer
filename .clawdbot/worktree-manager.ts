import { promises as fs, existsSync } from 'fs';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { join, resolve } from 'path';

const execAsync = promisify(exec);

/**
 * Metadata for a single worktree instance
 */
export interface WorktreeMetadata {
  featureId: string;           // e.g., "git-worktree-parallel-20260309045723"
  status: 'active' | 'cleaned';
  createdAt: string;           // ISO 8601
  agents: string[];            // ["Architect", "Engineer", "QA", "Reviewer"]
  branch: string;              // e.g., "feat/git-worktree-parallel"
  path: string;                // e.g., "/home/claw/worktrees/my-feature-123/financial-analyzer"
  cleanedAt?: string;          // ISO 8601, set when cleaned
}

/**
 * Registry of all worktrees
 */
export interface WorktreeRegistry {
  worktrees: WorktreeMetadata[];
}

const METADATA_FILE = resolve('.clawdbot/worktrees.json');
const WORKTREE_BASE = resolve(process.env.HOME || '/home/claw', 'worktrees');
const CLEANUP_SCRIPT = resolve('.clawdbot/scripts/cleanup-worktree.sh');

/**
 * Generate a timestamp in YYYYMMDDHHMMSS format (UTC)
 */
function generateTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    String(now.getUTCFullYear()) +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds())
  );
}

/**
 * Ensure the metadata file exists and is valid JSON
 */
export async function ensureMetadataFile(): Promise<void> {
  try {
    if (existsSync(METADATA_FILE)) {
      const content = await fs.readFile(METADATA_FILE, 'utf-8');
      JSON.parse(content);
      return;
    }
  } catch (error) {
    console.warn(`Worktree metadata file corrupt or missing, recreating: ${error}`);
  }

  const emptyRegistry: WorktreeRegistry = { worktrees: [] };
  await fs.writeFile(METADATA_FILE, JSON.stringify(emptyRegistry, null, 2) + '\n');
}

/**
 * Read the metadata registry
 */
async function readMetadata(): Promise<WorktreeRegistry> {
  await ensureMetadataFile();
  const content = await fs.readFile(METADATA_FILE, 'utf-8');
  return JSON.parse(content) as WorktreeRegistry;
}

/**
 * Write the metadata registry
 */
async function writeMetadata(registry: WorktreeRegistry): Promise<void> {
  await fs.writeFile(METADATA_FILE, JSON.stringify(registry, null, 2) + '\n');
}

/**
 * Check if a worktree path already exists
 */
function worktreeExists(featureId: string): boolean {
  const path = join(WORKTREE_BASE, featureId);
  return existsSync(path);
}

/**
 * Create a new worktree and record metadata
 */
export async function createWorktree(
  featureSlug: string,
  branchName: string,
  agents: string[] = []
): Promise<WorktreeMetadata> {
  // Generate unique feature ID
  let featureId = `${featureSlug}-${generateTimestamp()}`;
  let collisionCount = 0;

  // Collision handling: append UUID suffix if exists
  while (worktreeExists(featureId) && collisionCount < 10) {
    const suffix = randomUUID().slice(0, 8);
    featureId = `${featureSlug}-${generateTimestamp()}-${suffix}`;
    collisionCount++;
  }

  if (collisionCount >= 10) {
    throw new Error(
      `Unable to generate unique feature ID for "${featureSlug}" after 10 attempts`
    );
  }

  const worktreePath = join(WORKTREE_BASE, featureId, 'financial-analyzer');

  // Create worktree directory parent
  await fs.mkdir(join(WORKTREE_BASE, featureId), { recursive: true });

  try {
    // Execute git worktree add
    const cmd = `git worktree add -b ${branchName} ${worktreePath} origin/main`;
    execSync(cmd, { cwd: process.cwd(), stdio: 'pipe' });
  } catch (error) {
    // Clean up partial directory on failure
    try {
      await fs.rm(join(WORKTREE_BASE, featureId), { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn(`Failed to clean up partial worktree: ${cleanupError}`);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('No space left on device')) {
      throw new Error(
        `Worktree creation failed: disk full. Free space in "${WORKTREE_BASE}" and retry.`
      );
    }
    if (errorMessage.includes('Permission denied')) {
      throw new Error(
        `Worktree creation failed: permission denied. Check Git permissions and retry.`
      );
    }
    throw new Error(`Worktree creation failed: ${errorMessage}`);
  }

  // Create metadata entry
  const now = new Date().toISOString();
  const metadata: WorktreeMetadata = {
    featureId,
    status: 'active',
    createdAt: now,
    agents,
    branch: branchName,
    path: worktreePath,
  };

  // Append to metadata file
  const registry = await readMetadata();
  registry.worktrees.push(metadata);
  await writeMetadata(registry);

  return metadata;
}

/**
 * Clean up a worktree and mark metadata as cleaned
 */
export async function cleanupWorktree(featureId: string): Promise<void> {
  try {
    // Call cleanup script
    try {
      execSync(`bash ${CLEANUP_SCRIPT} ${featureId}`, {
        cwd: process.cwd(),
        stdio: 'pipe',
      });
    } catch (error) {
      // Soft-fail: log warning but do not throw
      console.warn(`Worktree cleanup script failed for "${featureId}": ${error}`);
    }

    // Update metadata
    const registry = await readMetadata();
    const entry = registry.worktrees.find((w) => w.featureId === featureId);

    if (entry) {
      entry.status = 'cleaned';
      entry.cleanedAt = new Date().toISOString();
      await writeMetadata(registry);
    }
  } catch (error) {
    // Soft-fail on metadata update
    console.warn(`Worktree metadata update failed for "${featureId}": ${error}`);
  }
}

/**
 * Get all active worktrees
 */
export async function getActiveWorktrees(): Promise<WorktreeMetadata[]> {
  const registry = await readMetadata();
  return registry.worktrees.filter((w) => w.status === 'active');
}
