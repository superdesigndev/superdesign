# Phase 2 Testing Plan - hjps-superdesign

**Branch:** `feat/dependency-standardization-phase2`
**Date:** October 12, 2025
**Status:** Ready for Testing

---

## 📋 Overview

Phase 2 introduces **massive AI SDK updates** (all v1 → v2 major versions) plus React 19.2, TypeScript, and ESLint updates. This is a **VSCode extension** requiring careful testing of AI interactions and extension functionality.

---

## 🔄 Dependency Changes

### Critical AI SDK Updates (v1 → v2)

| Package | Old Version | New Version | Risk Level | Breaking Changes |
|---------|-------------|-------------|------------|------------------|
| **@ai-sdk/anthropic** | 1.2.12 | 2.0.27 | 🔴 High | API restructure |
| **@ai-sdk/google** | 1.2.19 | 2.0.20 | 🔴 High | API restructure |
| **@ai-sdk/openai** | 1.3.22 | 2.0.50 | 🔴 High | API restructure |
| **@anthropic-ai/claude-code** | 1.0.31 | 2.0.14 | 🔴 High | Major rewrite |
| **@openrouter/ai-sdk-provider** | 0.7.2 | 1.2.0 | 🟡 Medium | Breaking changes |
| **ai** | 4.3.16 | 5.0.68 | 🔴 High | Core SDK rewrite |

### React Updates

| Package | Old Version | New Version | Risk Level |
|---------|-------------|-------------|------------|
| **react** | 19.1.0 | 19.2.0 | 🟢 Low |
| **react-dom** | 19.1.0 | 19.2.0 | 🟢 Low |
| **@types/react** | 19.1.8 | 19.2.2 | 🟢 Low |
| **@types/react-dom** | 19.1.6 | 19.2.1 | 🟢 Low |
| **lucide-react** | 0.522.0 | 0.545.0 | 🟢 Low |

### Development Tools

| Package | Old Version | New Version | Risk Level |
|---------|-------------|-------------|------------|
| **typescript** | 5.8.3 | 5.9.3 | 🟢 Low |
| **eslint** | 9.25.1 | 9.37.0 | 🟢 Low |
| **esbuild** | 0.25.3 | 0.25.10 | 🟢 Low |
| **@typescript-eslint/*** | 8.31.1 | 8.46.0 | 🟢 Low |
| **@types/vscode** | 1.90.0 | 1.105.0 | 🟢 Low |

---

## 🧪 Testing Strategy

### Phase 1: Install Dependencies
```bash
cd D:\code\hjps-superdesign
npm install
```

**Expected Output:**
- Clean install with no peer dependency warnings
- Lock file updated successfully
- All AI SDKs installed

### Phase 2: TypeScript Compilation
```bash
npm run check-types
```

**Expected Output:**
- ✅ No TypeScript errors
- All types resolved correctly

### Phase 3: Build Extension
```bash
npm run package
```

**Expected Output:**
- ✅ Extension builds successfully
- dist/extension.js created
- No esbuild errors

### Phase 4: Linting
```bash
npm run lint
```

**Expected Output:**
- ✅ No linting errors
- ESLint 9.37 rules applied

---

## 🎯 Critical Path Testing

### 1. VSCode Extension Loading

**Test Commands:**
```bash
# Build extension
npm run package

# Install extension in VSCode (copy to extensions folder or use F5 to debug)
```

**Manual Test - Extension Activation:**
1. Open VSCode
2. Press F5 (or use "Run Extension" launch config)
3. Extension development host opens
4. Open command palette (Ctrl+Shift+P)
5. Type "Superdesign"
6. Verify commands appear

**Verification:**
- [ ] Extension activates without errors
- [ ] All commands registered
- [ ] Sidebar view appears
- [ ] Icons load correctly
- [ ] No console errors in extension host

---

### 2. AI Provider Testing - Anthropic (Claude)

**What Changed:** @ai-sdk/anthropic 1.2.12 → 2.0.27 + ai 4.3.16 → 5.0.68

**Manual Test:**
1. Open Superdesign sidebar
2. Configure Anthropic API key (Command: "Configure Anthropic API Key")
3. Select "claude-api" as LLM provider
4. Send test prompt: "Create a simple React button component"
5. Wait for response

**Verification:**
- [ ] API key configuration works
- [ ] Connection to Anthropic API succeeds
- [ ] Streaming responses work
- [ ] Code generation functional
- [ ] No API errors
- [ ] Token usage tracked correctly

**Test Multiple Models:**
- [ ] Claude Sonnet 4 (claude-sonnet-4-20250514)
- [ ] Claude 3.5 Sonnet (claude-3-5-sonnet-20241022)
- [ ] Claude 3.5 Haiku (claude-3-5-haiku-20241022)

---

### 3. AI Provider Testing - OpenAI

**What Changed:** @ai-sdk/openai 1.3.22 → 2.0.50

**Manual Test:**
1. Configure OpenAI API key
2. Select OpenAI as AI model provider
3. Send test prompt: "Create a simple Express API endpoint"
4. Wait for response

**Verification:**
- [ ] OpenAI API connection works
- [ ] Streaming responses work
- [ ] Code generation functional
- [ ] GPT-4 model works
- [ ] GPT-4o model works

---

### 4. AI Provider Testing - Google (Gemini)

**What Changed:** @ai-sdk/google 1.2.19 → 2.0.20

**Manual Test:**
1. Configure Google AI API key (if available)
2. Select Google as provider
3. Send test prompt
4. Wait for response

**Verification:**
- [ ] Google AI connection works
- [ ] Gemini model responds
- [ ] Streaming functional

---

### 5. AI Provider Testing - OpenRouter

**What Changed:** @openrouter/ai-sdk-provider 0.7.2 → 1.2.0

**Manual Test:**
1. Configure OpenRouter API key
2. Select OpenRouter as provider
3. Test with available model
4. Send prompt

**Verification:**
- [ ] OpenRouter connection works
- [ ] Model selection works
- [ ] Responses stream correctly

---

### 6. Claude Code Binary Integration

**What Changed:** @anthropic-ai/claude-code 1.0.31 → 2.0.14

**Manual Test:**
1. Select "claude-code" as LLM provider
2. Configure claude binary path (default: "claude")
3. Set model ID (default: claude-sonnet-4-20250514)
4. Send test prompt
5. Wait for response

**Verification:**
- [ ] Claude Code binary detected
- [ ] Thinking budget configuration works
- [ ] Model selection works
- [ ] Tool use functional
- [ ] File operations work

---

### 7. React Components Testing

**What Changed:** react 19.1.0 → 19.2.0

**Manual Test:**
1. Open Superdesign chat interface
2. Interact with UI components:
   - Message input
   - Message display
   - Settings panel
   - Canvas view
3. Test component rendering

**Verification:**
- [ ] All UI components render
- [ ] No React errors in console
- [ ] State management works
- [ ] Re-renders perform well
- [ ] No memory leaks

---

### 8. TypeScript Compilation

**What Changed:** typescript 5.8.3 → 5.9.3

**Test Commands:**
```bash
# Type check
npm run check-types

# Compile tests
npm run compile-tests

# Build extension
npm run package
```

**Verification:**
- [ ] No type errors
- [ ] All imports resolve
- [ ] Type definitions correct
- [ ] Extension compiles

---

### 9. ESLint Validation

**What Changed:** eslint 9.25.1 → 9.37.0

**Test Commands:**
```bash
npm run lint
```

**Verification:**
- [ ] No linting errors
- [ ] ESLint 9 flat config works
- [ ] TypeScript rules apply correctly

---

## 📊 Integration Testing

### Complete AI Interaction Flow

**Scenario 1: Component Generation (Anthropic)**
```
1. User: "Create a React card component with title and description"
2. AI generates code
3. User inserts code into project
4. User: "Add a hover effect"
5. AI modifies code
6. User accepts changes
```

**Verification:**
- [ ] Multi-turn conversation works
- [ ] Code generation accurate
- [ ] Code modification works
- [ ] Context maintained across turns

**Scenario 2: Full-Stack Feature (OpenAI)**
```
1. User: "Create a REST API endpoint for user authentication"
2. AI generates Express route
3. User: "Add input validation"
4. AI adds Joi validation
5. User: "Create React form for this endpoint"
6. AI generates React component
```

**Verification:**
- [ ] Complex multi-step feature generation
- [ ] Cross-file context maintained
- [ ] Code consistency across files

**Scenario 3: Tool Use Testing**
```
1. User: "Read the package.json file"
2. AI uses file read tool
3. User: "Update the version number"
4. AI uses file write tool
```

**Verification:**
- [ ] File read tool works
- [ ] File write tool works
- [ ] File paths resolved correctly
- [ ] Tool execution logged

---

### Canvas View Testing

**Manual Test:**
1. Open canvas view (command or button)
2. Generate UI component
3. View rendered preview
4. Make modifications
5. See live updates

**Verification:**
- [ ] Canvas view opens
- [ ] Preview renders
- [ ] Live updates work
- [ ] Zoom/pan functional (react-zoom-pan-pinch)

---

### Settings Management

**Test All Settings:**
1. LLM Provider selection
2. API key configuration
3. Model selection
4. Thinking budget
5. Claude binary path

**Verification:**
- [ ] Settings save correctly
- [ ] Settings persist across sessions
- [ ] Settings validation works
- [ ] Changes take effect immediately

---

## 🔍 Performance Testing

### Extension Load Time
```
1. Open VSCode
2. Time extension activation
3. Record time to ready state
```

**Baseline:** [Record time]
**Phase 2:** [Record time]
**Acceptable:** < 500ms difference

### AI Response Time
```
1. Send simple prompt
2. Measure time to first token
3. Measure time to complete response
```

**Verification:**
- [ ] First token < 2 seconds
- [ ] Streaming responsive
- [ ] No UI freezing

### Memory Usage
```
1. Open Task Manager
2. Note VSCode memory usage
3. Use extension extensively
4. Check for memory leaks
```

**Verification:**
- [ ] Memory usage stable
- [ ] No continuous growth
- [ ] Extension unload cleans up

---

## 🚨 Known Issues & Workarounds

### Issue 1: AI SDK v2 Breaking Changes
**Symptoms:** API calls fail, different response format
**Fix:** Review migration guides for each AI SDK
**Docs:**
- https://sdk.vercel.ai/docs/upgrade-guide
- Check each provider's v2 migration guide

### Issue 2: React 19 Component Updates
**Symptoms:** Components don't render or have warnings
**Fix:** Update component patterns to React 19 best practices
**Docs:** https://react.dev/blog/2024/04/25/react-19

### Issue 3: Claude Code Binary Not Found
**Symptoms:** Error when using claude-code provider
**Fix:** Install claude binary: `npm install -g @anthropic-ai/claude-code`
**Or:** Specify full path in settings

### Issue 4: VSCode API Changes
**Symptoms:** Extension API deprecation warnings
**Fix:** Update to @types/vscode 1.105.0 APIs
**Docs:** https://code.visualstudio.com/api/references/vscode-api

---

## 🔄 Rollback Procedure

If critical issues are found:

```bash
# 1. Revert to Phase 1 versions
git checkout main
npm install

# 2. Restore specific AI SDKs if needed
npm install @ai-sdk/anthropic@1.2.12 --save
npm install @ai-sdk/openai@1.3.22 --save
npm install @ai-sdk/google@1.2.19 --save
npm install ai@4.3.16 --save
npm install @anthropic-ai/claude-code@1.0.31 --save

# 3. Rebuild extension
npm run package

# 4. Test rollback works
# Load extension in VSCode and verify functionality

# 5. Document issue for future resolution
```

---

## ✅ Sign-Off Checklist

Before merging Phase 2:

### Build & Compilation
- [ ] Extension builds successfully
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] esbuild completes

### Extension Functionality
- [ ] Extension loads in VSCode
- [ ] All commands registered
- [ ] Sidebar view appears
- [ ] Settings save/load

### AI Provider Testing
- [ ] Anthropic/Claude works
- [ ] OpenAI works
- [ ] Google AI works (if available)
- [ ] OpenRouter works (if available)
- [ ] Claude Code binary works

### UI/UX
- [ ] All React components render
- [ ] Chat interface functional
- [ ] Canvas view works
- [ ] Settings panel works
- [ ] No visual regressions

### Performance
- [ ] Extension load time acceptable
- [ ] AI responses stream smoothly
- [ ] No memory leaks
- [ ] UI remains responsive

### Integration
- [ ] Multi-turn conversations work
- [ ] Tool use functional
- [ ] File operations work
- [ ] Context maintained

---

## 📝 Test Results Log

### Test Run 1: [Date]
**Tester:** [Name]
**Environment:** VSCode [Version]
**Node Version:** [Version]
**OS:** [Windows/Mac/Linux]

**AI Providers Tested:**
- Anthropic: ✅ / ❌ / Not Tested
- OpenAI: ✅ / ❌ / Not Tested
- Google: ✅ / ❌ / Not Tested
- OpenRouter: ✅ / ❌ / Not Tested
- Claude Code: ✅ / ❌ / Not Tested

**Results:**
- Build: ✅ / ❌
- Extension load: ✅ / ❌
- UI components: ✅ / ❌
- AI interactions: ✅ / ❌
- Performance: ✅ / ❌

**Timing:**
- Extension load: [X] ms
- First token: [X] seconds
- Build time: [X] seconds

**Notes:**

---

## 🆘 Support

**Issues found?**
1. Check Known Issues section
2. Review AI SDK migration guides:
   - [Vercel AI SDK v5](https://sdk.vercel.ai/docs/upgrade-guide)
   - [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript)
   - [OpenAI SDK](https://github.com/openai/openai-node)
3. Check VSCode Extension API docs
4. Review rollback procedure

**Questions?**
- Test with different AI providers to isolate issues
- Check VSCode console for errors (Help > Toggle Developer Tools)
- Review extension logs in Output panel

---

## 🔗 Related Documentation

- [VSCode Extension API](https://code.visualstudio.com/api)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [React 19 Release](https://react.dev/blog/2024/04/25/react-19)
- [TypeScript 5.9](https://devblogs.microsoft.com/typescript/announcing-typescript-5-9/)

---

**Created:** October 12, 2025
**Branch:** feat/dependency-standardization-phase2
**Phase:** 2 (Safe Updates - Critical AI SDK Major Versions)
**Extension:** VSCode Extension
**AI Providers:** Anthropic, OpenAI, Google, OpenRouter, Claude Code
