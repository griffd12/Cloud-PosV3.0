import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OWNER = 'griffd12';
const REPO = 'Cloud-pos-V3.0';
const BRANCH = 'main';

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

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });
  
  const savedBlobsPath = '/tmp/saved-blobs.json';
  const treeItems = JSON.parse(fs.readFileSync(savedBlobsPath, 'utf-8'));
  console.log(`Loaded ${treeItems.length} blob items`);

  const { data: ref } = await octokit.git.getRef({ owner: OWNER, repo: REPO, ref: `heads/${BRANCH}` });
  const latestCommitSha = ref.object.sha;
  const { data: commit } = await octokit.git.getCommit({ owner: OWNER, repo: REPO, commit_sha: latestCommitSha });
  const baseTreeSha = commit.tree.sha;
  console.log(`Branch state: commit=${latestCommitSha.substring(0, 8)}, tree=${baseTreeSha.substring(0, 8)}`);

  // Try creating tree in chunks if the full tree fails
  // GitHub has a limit on tree items per request (~1000, but blob GC can cause issues)
  // First try: just create the full tree
  try {
    console.log(`Attempting tree creation with ${treeItems.length} items...`);
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

    await octokit.git.updateRef({
      owner: OWNER, repo: REPO,
      ref: `heads/${BRANCH}`,
      sha: newCommit.sha
    });
    console.log(`Branch updated! All ${treeItems.length} files pushed.`);
    console.log(`Commit: ${newCommit.sha}`);
    
    // Clean up saved blobs
    fs.unlinkSync(savedBlobsPath);
  } catch (err: any) {
    console.error(`Tree creation failed: ${err.message}`);
    
    if (err.status === 404 || err.status === 422) {
      console.log('\nBlobs may have been garbage collected. Re-creating all blobs...');
      const baseDir = path.resolve(__dirname, '..');
      
      const EXCLUDE_PATTERNS = [
        'node_modules', '.git/', '.local/', '.config/', '.cache/',
        'dist/', '.upm/', 'attached_assets/', 'uploads/', '.replit',
        'package-lock.json', '.replit.nix', 'replit.nix', '.nix-',
        '.npm/', 'electron-dist/', 'scripts/push-to-github', 'scripts/create-tree',
      ];

      function getAllFiles(dir: string, bd: string): string[] {
        const results: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(bd, fullPath);
          if (EXCLUDE_PATTERNS.some(p => relativePath.includes(p))) continue;
          if (entry.isDirectory()) results.push(...getAllFiles(fullPath, bd));
          else results.push(relativePath);
        }
        return results;
      }

      const allFiles = getAllFiles(baseDir, baseDir);
      console.log(`Re-creating ${allFiles.length} blobs sequentially...`);
      
      const newTreeItems: any[] = [];
      for (let i = 0; i < allFiles.length; i++) {
        const filePath = allFiles[i];
        const fullPath = path.join(baseDir, filePath);
        const content = fs.readFileSync(fullPath);
        
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const { data: blob } = await octokit.git.createBlob({
              owner: OWNER, repo: REPO,
              content: content.toString('base64'),
              encoding: 'base64'
            });
            newTreeItems.push({ path: filePath, mode: '100644', type: 'blob', sha: blob.sha });
            break;
          } catch (retryErr: any) {
            if (retryErr.status === 403 || retryErr.status === 429) {
              console.log(`Rate limited at ${i}, waiting 30s...`);
              await sleep(30000);
            } else throw retryErr;
          }
        }
        
        if ((i + 1) % 10 === 0) console.log(`Blobs: ${i + 1}/${allFiles.length}`);
        if ((i + 1) % 3 === 0) await sleep(500);
      }

      // Now immediately create tree + commit
      console.log(`Creating tree with ${newTreeItems.length} fresh blobs...`);
      const { data: newTree } = await octokit.git.createTree({
        owner: OWNER, repo: REPO,
        base_tree: baseTreeSha,
        tree: newTreeItems
      });

      const { data: newCommit } = await octokit.git.createCommit({
        owner: OWNER, repo: REPO,
        message: 'Cloud POS V3.0.0 — Configuration-Driven Architecture',
        tree: newTree.sha,
        parents: [latestCommitSha]
      });

      await octokit.git.updateRef({
        owner: OWNER, repo: REPO,
        ref: `heads/${BRANCH}`,
        sha: newCommit.sha
      });
      console.log(`Done! Commit: ${newCommit.sha}`);
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
