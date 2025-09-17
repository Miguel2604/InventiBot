# Scripts Directory

This directory contains utility scripts for the InventiBot project.

## Available Scripts

### Shell Scripts
- **`generate-webhook-secret.sh`** - Generates secure webhook secrets for Facebook integration

### TypeScript Scripts
- **`create-invite.ts`** - Creates invite codes for new tenants
- **`populate-faqs.ts`** - Populates the database with FAQ data
- **`test-faq-system.ts`** - Tests the FAQ system functionality
- **`check-faqs.ts`** - Validates FAQ data in the database
- **`test-timezone.ts`** - Tests timezone handling functionality

## Usage

### Shell Scripts
```bash
# Make executable and run
chmod +x scripts/generate-webhook-secret.sh
./scripts/generate-webhook-secret.sh
```

### TypeScript Scripts
```bash
# Run with ts-node
npx ts-node scripts/create-invite.ts
npx ts-node scripts/populate-faqs.ts
npx ts-node scripts/test-faq-system.ts
npx ts-node scripts/check-faqs.ts
npx ts-node scripts/test-timezone.ts
```

## Adding New Scripts

When adding new utility scripts:
1. Place TypeScript scripts in this directory
2. Use `.ts` extension for TypeScript, `.sh` for shell scripts
3. Add proper documentation and usage examples
4. Update this README with the new script information

## Related

- **Source Code**: `../src/` - Main application code
- **SQL Scripts**: `../sql_scripts/` - Database utilities
- **Configuration**: `../config/` - Configuration files