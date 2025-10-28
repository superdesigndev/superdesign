# Deployment Guide for Superdesign Extension

This guide covers how to publish updates to both the new official publisher (`SuperdesignDev`) and the deprecated old publisher (`iganbold`).

---

## 📋 Prerequisites

### Required Tokens

1. **SuperdesignDev Publisher (New)**
   - **VSCE Token**: Your Personal Access Token from Azure DevOps
   - **Open VSX Token**: Your token from https://open-vsx.org/user-settings/tokens
   - Location: Keep these handy or store in password manager

2. **iganbold Publisher (Old - Deprecated)**
   - **VSCE_TOKEN**: Stored in GitHub Secrets
   - **OPEN_VSX_TOKEN**: Stored in GitHub Secrets
   - Location: https://github.com/superdesigndev/superdesign/settings/secrets/actions

### Required Tools
```bash
npm install -g @vscode/vsce ovsx
```

---

## 🚀 Publishing to New Publisher (SuperdesignDev)

This is the **primary publisher** for all new releases. Use this for regular updates.

### Step 1: Update Version

Edit `package.json`:
```json
{
  "name": "superdesign-official",
  "displayName": "Superdesign Dev",
  "version": "0.0.X",  // Increment this
  "publisher": "SuperdesignDev"
}
```

### Step 2: Build and Publish

```bash
# Build the extension
npm run package

# Publish to VS Code Marketplace
npx vsce publish --pat YOUR_VSCE_TOKEN

# Publish to Open VSX Registry
npx ovsx publish -p YOUR_OVSX_TOKEN
```

**Or all in one command:**
```bash
npm run package && \
npx vsce publish --pat YOUR_VSCE_TOKEN && \
npx ovsx publish -p YOUR_OVSX_TOKEN
```

### Step 3: Verify Publication

- **VS Code Marketplace**: https://marketplace.visualstudio.com/items?itemName=SuperdesignDev.superdesign-official
- **Open VSX**: https://open-vsx.org/extension/SuperdesignDev/superdesign-official

---

## 🗂️ Publishing to Old Publisher (iganbold - Deprecated)

This publisher should **only receive deprecation updates** when there are important changes users need to know about.

### When to Publish to Old Publisher

Only publish to `iganbold` when:
- Security fixes that users must know about
- Critical breaking changes in the ecosystem
- Major migration announcements
- **NOT for regular feature updates**

### Step 1: Update Files for Deprecation

1. **Update `package.json`:**
```json
{
  "name": "superdesign",
  "displayName": "superdesign (DEPRECATED)",
  "description": "⚠️ DEPRECATED - Please install the new version: https://marketplace.visualstudio.com/items?itemName=SuperdesignDev.superdesign-official",
  "version": "0.0.X",  // Match or increment from last iganbold version
  "publisher": "iganbold"
}
```

2. **Update `src/extension.ts` (line ~1327):**
```typescript
const openSettingsDisposable = vscode.commands.registerCommand('superdesign.openSettings', () => {
  vscode.commands.executeCommand('workbench.action.openSettings', '@ext:iganbold.superdesign');
});
```

3. **Create deprecation README:**
```bash
# Save your current README
mv README.md README_ORIGINAL.md

# Create deprecation README
cat > README.md << 'EOF'
# ⚠️ THIS EXTENSION HAS BEEN DEPRECATED

## 🚨 Important Notice

This extension has moved to a new publisher account. Please uninstall this version and install the new official version:

### 👉 **[Install the New Official Extension](https://marketplace.visualstudio.com/items?itemName=SuperdesignDev.superdesign-official)**

[... rest of deprecation message ...]
EOF
```

### Step 2: Commit and Tag

```bash
# Commit deprecation changes
git add -A
git commit -m "Update deprecation version 0.0.X for iganbold publisher"

# Create version tag (this triggers GitHub Actions)
git tag v0.0.X

# Push to GitHub
git push origin main
git push origin v0.0.X
```

### Step 3: Monitor GitHub Actions

GitHub Actions will automatically publish when it detects the tag:

1. **Check workflow status**: https://github.com/superdesigndev/superdesign/actions
2. **Wait for completion** (~2-3 minutes)
3. **Verify publication**: https://marketplace.visualstudio.com/items?itemName=iganbold.superdesign

### Step 4: Revert to SuperdesignDev

After GitHub Actions completes, revert your working directory:

```bash
# Restore original README
mv README_ORIGINAL.md README.md

# Update package.json back to SuperdesignDev
# Update version to match the latest SuperdesignDev version (0.0.X)
# Update publisher to "SuperdesignDev"
# Update name to "superdesign-official"
# Update displayName to "Superdesign Dev"

# Update extension.ts settings command back to SuperdesignDev
# Line ~1327: '@ext:SuperdesignDev.superdesign-official'

# Commit changes
git add -A
git commit -m "Revert to SuperdesignDev publisher for ongoing development"
git push origin main
```

---

## 📦 Complete Dual Publishing Workflow

For important releases that need to update both publishers:

```bash
# 1. Publish to NEW publisher first (SuperdesignDev)
# - Update package.json version (e.g., 0.0.14)
npm run package && \
npx vsce publish --pat YOUR_VSCE_TOKEN && \
npx ovsx publish -p YOUR_OVSX_TOKEN

# 2. Prepare OLD publisher (iganbold)
# - Update to iganbold publisher
# - Change displayName to include (DEPRECATED)
# - Swap README with deprecation notice
# - Set version (e.g., 0.0.13)

# 3. Commit and tag for GitHub Actions
git add -A
git commit -m "Update deprecation version 0.0.X for iganbold publisher"
git tag v0.0.X
git push origin main && git push origin v0.0.X

# 4. Wait for GitHub Actions to complete
# Check: https://github.com/superdesigndev/superdesign/actions

# 5. Revert to SuperdesignDev
# - Restore README
# - Update package.json back to SuperdesignDev
# - Update extension.ts
git add -A
git commit -m "Revert to SuperdesignDev publisher for ongoing development"
git push origin main
```

---

## 🔧 GitHub Actions Configuration

The workflow file is at `.github/workflows/publish.yml`:

```yaml
name: Publish Extension

on:
  push:
    tags:
      - 'v*'  # Triggers on version tags like v0.0.13

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'  # Must be Node.js 20+ for vsce compatibility
      - run: npm ci
      - run: npm install -g @vscode/vsce ovsx
      - run: vsce publish --pat ${{ secrets.VSCE_TOKEN }}
      - run: ovsx publish -p ${{ secrets.OPEN_VSX_TOKEN }}
```

### GitHub Secrets

Make sure these secrets are set in your repository:
- `VSCE_TOKEN` - For iganbold publisher (old)
- `OPEN_VSX_TOKEN` - For iganbold publisher (old)

**Location**: https://github.com/superdesigndev/superdesign/settings/secrets/actions

---

## 🎯 Quick Reference

### Regular Update (SuperdesignDev only)
```bash
# Edit package.json version
npm run package && \
npx vsce publish --pat YOUR_TOKEN && \
npx ovsx publish -p YOUR_OVSX_TOKEN
```

### Deprecation Update (iganbold via GitHub Actions)
```bash
# 1. Modify files for deprecation
# 2. Commit and tag
git tag v0.0.X && git push origin main && git push origin v0.0.X
# 3. Wait for GitHub Actions
# 4. Revert changes
```

### Check Published Versions

**SuperdesignDev (New):**
- VS Code: https://marketplace.visualstudio.com/items?itemName=SuperdesignDev.superdesign-official
- Open VSX: https://open-vsx.org/extension/SuperdesignDev/superdesign-official

**iganbold (Old - Deprecated):**
- VS Code: https://marketplace.visualstudio.com/items?itemName=iganbold.superdesign
- Open VSX: https://open-vsx.org/extension/iganbold/superdesign

---

## ⚠️ Important Notes

1. **Always publish to SuperdesignDev first** - This is the primary publisher
2. **Only publish to iganbold for critical updates** - It's deprecated
3. **Never commit your tokens** - Keep them secure
4. **Test locally before publishing** - Use `code --install-extension file.vsix`
5. **Keep version numbers consistent** - SuperdesignDev should always be ahead or equal
6. **Node.js 20+ required** - For GitHub Actions and local `vsce` usage

---

## 🔐 Security

- **Never commit tokens** to the repository
- Store tokens securely in password manager
- Use GitHub Secrets for automated publishing
- Rotate tokens periodically
- Keep this document up to date

---

## 📝 Version History

- **v0.0.14** - SuperdesignDev (Theme-adaptive icon)
- **v0.0.13** - iganbold deprecation (Theme-adaptive icon + deprecation notice)
- **v0.0.12** - iganbold deprecation (Initial deprecation release)
- **v0.0.11** - Last version under iganbold before migration

---

**Last Updated**: 2025-10-28
