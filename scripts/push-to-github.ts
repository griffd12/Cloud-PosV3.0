import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OWNER = 'griffd12';
const REPO = 'Cloud-pos-V3.0';
const BRANCH = 'main';

const EXCLUDE_PATTERNS = [
  'node_modules', '.git/', '.local/', '.config/', '.cache/',
  'dist/', '.upm/', 'attached_assets/', 'uploads/', '.replit',
  'package-lock.json', '.replit.nix', 'replit.nix', '.nix-',
  '.npm/', 'electron-dist/', 'scripts/push-to-github',
];

let connectionSettings: any;

async function getAccessToken(): Promise<string> {
  if (connectionSettings?.settings?.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;
  if (!xReplitToken) throw new Error('X-Replit-Token not found');
  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    { headers: { 'Accept': 'application/json', 'X-Replit-Token': xReplitToken } }
  ).then(res => res.json()).then(data => data.items?.[0]);
  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
  if (!connectionSettings || !accessToken) throw new Error('GitHub not connected');
  return accessToken;
}

function getAllFiles(dir: string, baseDir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);
    if (EXCLUDE_PATTERNS.some(p => relativePath.includes(p))) continue;
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath, baseDir));
    } else {
      results.push(relativePath);
    }
  }
  return results;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });

  const baseDir = path.resolve(__dirname, '..');
  const allFiles = getAllFiles(baseDir, baseDir);
  console.log(`Found ${allFiles.length} files to push`);

  let latestCommitSha: string;
  let baseTreeSha: string;
  try {
    const { data: ref } = await octokit.git.getRef({ owner: OWNER, repo: REPO, ref: `heads/${BRANCH}` });
    latestCommitSha = ref.object.sha;
    const { data: commit } = await octokit.git.getCommit({ owner: OWNER, repo: REPO, commit_sha: latestCommitSha });
    baseTreeSha = commit.tree.sha;
    console.log(`Existing branch: commit=${latestCommitSha.substring(0, 8)}, tree=${baseTreeSha.substring(0, 8)}`);
  } catch (e: any) {
    console.error('Could not get branch ref:', e.message);
    process.exit(1);
  }

  const BLOB_BATCH = 5;
  const treeItems: Array<{ path: string; mode: '100644'; type: 'blob'; sha: string }> = [];
  
  const savedBlobsPath = '/tmp/saved-blobs.json';
  if (fs.existsSync(savedBlobsPath)) {
    const saved = JSON.parse(fs.readFileSync(savedBlobsPath, 'utf-8'));
    treeItems.push(...saved);
    console.log(`Loaded ${saved.length} previously created blobs`);
  }

  async function createBlobWithRetry(filePath: string, retries = 3): Promise<{ path: string; mode: '100644'; type: 'blob'; sha: string }> {
    const fullPath = path.join(baseDir, filePath);
    const content = fs.readFileSync(fullPath);
    const base64Content = content.toString('base64');

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const { data: blob } = await octokit.git.createBlob({
          owner: OWNER, repo: REPO,
          content: base64Content,
          encoding: 'base64'
        });
        return { path: filePath, mode: '100644' as const, type: 'blob' as const, sha: blob.sha };
      } catch (err: any) {
        if ((err.status === 403 || err.status === 429) && attempt < retries - 1) {
          const wait = (attempt + 1) * 30000;
          console.log(`  Rate limited on ${filePath}, waiting ${wait/1000}s (attempt ${attempt + 1}/${retries})...`);
          await sleep(wait);
        } else {
          throw err;
        }
      }
    }
    throw new Error('Should not reach here');
  }

  const alreadyDone = new Set(treeItems.map(t => t.path));
  const remaining = allFiles.filter(f => !alreadyDone.has(f));
  console.log(`Remaining files to upload: ${remaining.length}`);

  for (let i = 0; i < remaining.length; i += BLOB_BATCH) {
    const batch = remaining.slice(i, i + BLOB_BATCH);
    const promises = batch.map(fp => createBlobWithRetry(fp));
    const results = await Promise.all(promises);
    treeItems.push(...results);

    const done = Math.min(i + BLOB_BATCH, remaining.length);
    console.log(`Blobs created: ${treeItems.length}/${allFiles.length} (batch ${done}/${remaining.length})`);
    
    // Save progress every 50 files
    if (treeItems.length % 50 === 0 || done === remaining.length) {
      fs.writeFileSync(savedBlobsPath, JSON.stringify(treeItems));
    }
    await sleep(1200);
  }

  console.log(`Creating tree with ${treeItems.length} items...`);
  const { data: newTree } = await octokit.git.createTree({
    owner: OWNER, repo: REPO,
    base_tree: baseTreeSha,
    tree: treeItems
  });
  console.log(`Tree created: ${newTree.sha.substring(0, 8)}`);

  console.log('Creating commit...');
  const { data: newCommit } = await octokit.git.createCommit({
    owner: OWNER, repo: REPO,
    message: 'Cloud POS V3.0.0 — Configuration-Driven Architecture\n\nComplete codebase push including:\n- Configuration-driven tender behavior and media flags\n- RVC print configuration\n- OptionBits infrastructure (emc_option_flags)\n- Service-host SQLite schema V4 with offline parity\n- Schema verification CLI\n- CAPS payment enrichment\n- Cash drawer reliability improvements\n- Receipt layout enhancements\n- Electron desktop v3.0.0\n- GitHub Actions CI workflow',
    tree: newTree.sha,
    parents: [latestCommitSha]
  });
  console.log(`Commit created: ${newCommit.sha.substring(0, 8)}`);

  console.log('Updating branch ref...');
  await octokit.git.updateRef({
    owner: OWNER, repo: REPO,
    ref: `heads/${BRANCH}`,
    sha: newCommit.sha
  });

  console.log(`\nDone! All ${allFiles.length} files pushed to ${OWNER}/${REPO}@${BRANCH}`);
  console.log(`Commit: ${newCommit.sha}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
