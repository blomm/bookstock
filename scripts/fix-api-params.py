#!/usr/bin/env python3
import re
import glob

files_to_fix = [
    'src/app/api/series/[id]/route.ts',
    'src/app/api/warehouses/[id]/route.ts',
    'src/app/api/warehouses/[id]/deactivate/route.ts',
    'src/app/api/warehouses/[id]/activate/route.ts',
    'src/app/api/admin/users/[id]/route.ts',
    'src/app/api/admin/users/[id]/roles/route.ts',
    'src/app/api/admin/users/[id]/roles/[roleId]/route.ts',
    'src/app/api/titles/[id]/stock-threshold/route.ts',
    'src/app/api/audit/users/[id]/route.ts',
    'src/app/api/inventory/[id]/route.ts',
    'src/app/api/inventory/[id]/adjust/route.ts',
]

for filepath in files_to_fix:
    try:
        with open(filepath, 'r') as f:
            content = f.read()

        original_content = content

        # Fix single id param
        content = re.sub(
            r'\{\s*params\s*\}:\s*\{\s*params:\s*\{\s*id:\s*string\s*\}\s*\}',
            '{ params }: { params: Promise<{ id: string }> }',
            content
        )

        # Fix id + roleId params
        content = re.sub(
            r'\{\s*params\s*\}:\s*\{\s*params:\s*\{\s*id:\s*string,\s*roleId:\s*string\s*\}\s*\}',
            '{ params }: { params: Promise<{ id: string, roleId: string }> }',
            content
        )

        # Fix params.id access - parseInt version
        content = re.sub(
            r'const id = parseInt\(params\.id\)',
            'const { id: paramId } = await params\n    const id = parseInt(paramId)',
            content
        )

        # Fix params.id access - direct version
        content = re.sub(
            r'const id = params\.id(?!\))',
            'const { id } = await params',
            content
        )

        # Fix params.roleId access
        content = re.sub(
            r'const roleId = params\.roleId',
            'const { roleId } = await params',
            content
        )

        if content != original_content:
            with open(filepath, 'w') as f:
                f.write(content)
            print(f'✅ Fixed: {filepath}')
        else:
            print(f'⏭️  No changes: {filepath}')

    except FileNotFoundError:
        print(f'❌ Not found: {filepath}')
    except Exception as e:
        print(f'❌ Error processing {filepath}: {e}')

print('\nDone!')
