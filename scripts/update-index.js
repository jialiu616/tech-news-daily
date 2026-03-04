import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

function updateIndex() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const files = fs.readdirSync(DATA_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();

  const dates = files.map(f => f.replace('.json', ''));

  const index = {
    lastUpdated: new Date().toISOString(),
    dates
  };

  const outFile = path.join(DATA_DIR, 'index.json');
  fs.writeFileSync(outFile, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`[update-index] Written ${dates.length} dates to ${outFile}`);
}

updateIndex();
