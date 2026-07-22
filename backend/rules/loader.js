import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rulesCache = new Map();

function loadAllRules() {
  if (rulesCache.size > 0) return;

  const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf-8'));
    rulesCache.set(data.platform, data);
  }
}

export function getRules(platform) {
  loadAllRules();
  const rules = rulesCache.get(platform);
  if (!rules) {
    throw new Error(`Unknown platform: ${platform}. Available: ${[...rulesCache.keys()].join(', ')}`);
  }
  return rules;
}

export function getAvailablePlatforms() {
  loadAllRules();
  return [...rulesCache.values()].map(({ platform, label }) => ({ platform, label }));
}

// Force reload (useful after editing rule files)
export function reloadRules() {
  rulesCache.clear();
  loadAllRules();
}
