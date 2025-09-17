# Configuration Directory

This directory contains all configuration files for the InventiBot project.

## Configuration Files

### TypeScript Configuration
- **`tsconfig.json`** - TypeScript compiler configuration
  - Compiles from `../src/` to `../dist/`
  - ES2020 target with strict type checking
  - Source maps and declarations enabled

### Testing Configuration
- **`jest.config.js`** - Jest testing framework configuration
  - TypeScript support via ts-jest
  - Test coverage settings (80% threshold)
  - Module path mapping for `@/` imports

### Environment Template
- **`.env.example`** - Template for environment variables
  - Copy to `../.env` and fill with actual values
  - Contains Facebook API tokens, Supabase credentials, etc.

## Usage

### Building the Project
The TypeScript configuration is used automatically by the build process:
```bash
npm run build    # Uses config/tsconfig.json
npm run dev      # Uses config/tsconfig.json
```

### Running Tests
The Jest configuration is used for all testing:
```bash
npm test                # Uses config/jest.config.js
npm run test:coverage   # Uses config/jest.config.js with coverage
npm run test:watch      # Uses config/jest.config.js in watch mode
```

### Environment Setup
1. Copy the example environment file:
   ```bash
   cp config/.env.example .env
   ```
2. Edit `.env` with your actual values
3. Never commit the actual `.env` file (it's in `.gitignore`)

## Path Configuration

All paths in these configuration files are relative to the project root:
- Source code: `../src/`
- Build output: `../dist/`
- Tests: `../tests/`
- Node modules: `../node_modules/`

## Related

- **Source Code**: `../src/` - Application source
- **Tests**: `../tests/` - Test suite
- **Scripts**: `../scripts/` - Utility scripts