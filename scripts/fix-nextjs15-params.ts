import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

// Find all route files with [id] or other dynamic params
const files = glob.sync('src/app/api/**/[*]/route.ts');

console.log(`Found ${files.length} API route files with dynamic params\n`);

files.forEach(file => {
  console.log(`Processing: ${file}`);
  let content = readFileSync(file, 'utf-8');
  let modified = false;

  // Pattern 1: { params }: { params: { id: string } }
  const pattern1 = /\{\s*params\s*\}:\s*\{\s*params:\s*\{\s*(\w+):\s*string\s*\}\s*\}/g;
  if (pattern1.test(content)) {
    content = content.replace(
      /\{\s*params\s*\}:\s*\{\s*params:\s*\{\s*(\w+):\s*string\s*\}\s*\}/g,
      '{ params }: { params: Promise<{ $1: string }> }'
    );
    modified = true;
  }

  // Pattern 2: { params }: { params: { id: string, roleId: string } }
  const pattern2 = /\{\s*params\s*\}:\s*\{\s*params:\s*\{\s*(\w+):\s*string,\s*(\w+):\s*string\s*\}\s*\}/g;
  if (pattern2.test(content)) {
    content = content.replace(
      /\{\s*params\s*\}:\s*\{\s*params:\s*\{\s*(\w+):\s*string,\s*(\w+):\s*string\s*\}\s*\}/g,
      '{ params }: { params: Promise<{ $1: string, $2: string }> }'
    );
    modified = true;
  }

  // Now fix params access - add await
  // Pattern: const id = parseInt(params.id)
  const accessPattern1 = /const\s+(\w+)\s*=\s*parseInt\(params\.(\w+)\)/g;
  if (accessPattern1.test(content)) {
    content = content.replace(
      /const\s+(\w+)\s*=\s*parseInt\(params\.(\w+)\)/g,
      'const { $2: param$1 } = await params\n    const $1 = parseInt(param$1)'
    );
    modified = true;
  }

  // Pattern: const something = params.id
  const accessPattern2 = /const\s+(\w+)\s*=\s*params\.(\w+)(?!\))/g;
  if (accessPattern2.test(content)) {
    content = content.replace(
      /const\s+(\w+)\s*=\s*params\.(\w+)/g,
      'const { $2 } = await params'
    );
    modified = true;
  }

  if (modified) {
    writeFileSync(file, content, 'utf-8');
    console.log(`✅ Updated ${file}\n`);
  } else {
    console.log(`⏭️  No changes needed for ${file}\n`);
  }
});

console.log('Done!');
