import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const REPLIED_COMMENTS_FILE = join(process.cwd(), 'data', 'replied_comments.json');

export async function readRepliedComments(): Promise<Set<string>> {
  try {
    if (existsSync(REPLIED_COMMENTS_FILE)) {
      const content = readFileSync(REPLIED_COMMENTS_FILE, 'utf8');
      const data = JSON.parse(content);
      return new Set(data);
    }
  } catch (e) {
    console.error('Error reading replied comments:', e);
  }
  return new Set();
}

export async function writeRepliedComments(commentIds: Set<string>): Promise<void> {
  try {
    const dir = join(process.cwd(), 'data');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(REPLIED_COMMENTS_FILE, JSON.stringify(Array.from(commentIds)));
    console.log(`Replied comments saved locally: ${commentIds.size} entries`);
  } catch (e) {
    console.error('Error writing replied comments locally:', e);
  }
}
