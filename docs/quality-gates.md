# Quality Gates Documentation

## Overview

This project uses a **two-layered quality gate strategy**:
1. **Pre-commit hook** (local) - Comprehensive validation before git commit
2. **GitHub Actions CI/CD** (remote) - Multi-environment verification

**Philosophy**: **"Stop problems at commit time, not push time"** - Every commit should be production-ready.

---

## Design Rationale

### Why Single Comprehensive Pre-Commit Hook?

We use ONE comprehensive pre-commit hook instead of multiple hooks (pre-commit + pre-push) because:

1. ✅ **No partial commits** - Every commit is fully validated
2. ✅ **Simpler workflow** - Developers remember: "commit = full validation"
3. ✅ **Earlier feedback** - Issues caught immediately at commit time
4. ✅ **Cleaner git history** - No commits with hidden issues
5. ✅ **Faster debugging** - If a commit exists, it passed all checks

**Trade-off**: Pre-commit takes 30-60 seconds instead of 2-5 seconds, but ensures 100% of commits are production-ready.

---

## Quality Gate Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     DEVELOPER WORKFLOW                       │
│                      Make code changes                       │
└─────────────────────────────────────────────────────────────┘
                              │
                     git add . && git commit
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: Pre-Commit Hook - The Guardian Gate               │
│  ═══════════════════════════════════════════════════════════│
│  1. TypeScript type check (ENTIRE codebase)                 │
│  2. ESLint (staged files with auto-fix)                     │
│  3. Build verification                                       │
│  4. Unit tests                                               │
│                                                              │
│  ⚡ Time: 30-60 seconds                                     │
│  🎯 Goal: Every commit is production-ready                  │
│  🚫 Blocks commit if ANY check fails                        │
└─────────────────────────────────────────────────────────────┘
                              │
                     All checks passed!
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Commit enters git history ✅                    │
│              Ready to push safely                            │
└─────────────────────────────────────────────────────────────┘
                              │
                          git push
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2: GitHub Actions CI/CD - Multi-Environment          │
│  ═══════════════════════════════════════════════════════════│
│  • Multi-environment (Node 18/20/22)                        │
│  • Cross-platform (Ubuntu, macOS, Windows)                  │
│  • Chrome matrix (90-130, stable, beta)                     │
│  • E2E, Performance, Accessibility tests                     │
│  • Security audit                                            │
│  • Coverage thresholds (>90%)                                │
│                                                              │
│  ⚡ Time: 5-15 minutes                                      │
│  🎯 Goal: Verify cross-environment compatibility            │
│  🚫 Blocks merge if ANY check fails                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Pre-Commit Hook (Local)

### Configuration
- **File**: `.husky/pre-commit`
- **Trigger**: `git commit`
- **Time**: 30-60 seconds

### What It Checks (in sequence)

#### 1. TypeScript Type Checking (`tsc --noEmit`)
- Checks **ENTIRE codebase** for type errors
- Catches: Missing imports, wrong types, type mismatches
- Why entire codebase: One file change can break types elsewhere

#### 2. ESLint (`eslint --fix`)
- Checks **staged files** only
- Auto-fixes code style issues
- Catches: Code quality issues, potential bugs, style violations

#### 3. Build Verification (`pnpm build`)
- Ensures code compiles successfully
- Catches: Compilation errors, tsup configuration issues

#### 4. Unit Tests (`pnpm test:unit`)
- Runs all unit tests
- Catches: Broken functionality, regression bugs

### Bypass (Use Sparingly)
```bash
# Only for temporary WIP commits during experimentation
git commit --no-verify -m "WIP: experimenting"

# Always validate and amend before pushing/sharing
pnpm validate
git commit --amend -m "feat: proper commit message"
```

---

## Layer 2: GitHub Actions CI/CD (Remote)

### Configuration
- **File**: `.github/workflows/test-and-release.yml`
- **Trigger**: Push to remote repository
- **Time**: 5-15 minutes

### Jobs

#### Code Quality
- TypeScript type checking
- ESLint validation
- Build verification

#### Test Matrix (runs in parallel)
- Node.js: 18.x, 20.x, 22.x
- OS: Ubuntu, macOS, Windows
- Chrome: 90, 100, 110, 120, 130, stable, beta

#### Advanced Tests
- Performance tests
- Accessibility tests (WCAG 2.1 AA)
- Visual regression tests

#### Security & Quality
- Security audit (`pnpm audit`)
- Coverage thresholds (lines, functions, branches, statements >90%)

---

## Manual Validation

### Individual Checks
```bash
pnpm typecheck    # TypeScript type checking
pnpm lint         # Linting
pnpm build        # Build verification
pnpm test:unit    # Unit tests
```

### Full Validation
```bash
pnpm validate     # Runs ALL checks (same as pre-commit hook)
```

**Use `pnpm validate` when**:
- Before creating PR
- After bypassing pre-commit with `--no-verify`
- When making risky changes
- Before important meetings/demos

---

## Common Issues & Solutions

### Issue 1: "Pre-commit hook is too slow"

**Expected**: 30-60 seconds

**Why it's worth it**:
- Catches ALL issues before git history
- Prevents wasting time debugging later
- Keeps git history clean
- Saves team time reviewing broken PRs

**If you need speed temporarily**:
```bash
# Use for experimental commits only
git commit --no-verify -m "WIP: experiment"

# Then fix and amend before pushing
pnpm validate
git commit --amend -m "feat: proper message"
```

### Issue 2: "Type errors not caught locally"

**Root cause**: Used `--no-verify` to bypass pre-commit

**Solution**:
- Never use `--no-verify` for final commits
- Only for temporary WIP commits
- Always run `pnpm validate` before pushing

### Issue 3: "CI fails but local checks passed"

**Possible causes**:
1. Different Node.js version (CI uses 18, 20, 22)
2. Different OS (CI tests Ubuntu, macOS, Windows)
3. Lockfile out of sync

**Solution**:
```bash
# Update lockfile
pnpm install

# Test with CI Node version
nvm use 20  # or 18, 22
pnpm validate
```

### Issue 4: "Hooks not running"

**Diagnosis**:
```bash
ls -la .git/hooks/    # Check if hooks installed
cat .husky/pre-commit # Verify hook content
```

**Solution**:
```bash
# Reinstall husky hooks
rm -rf .git/hooks/*
pnpm run prepare
```

### Issue 5: "Build passes locally but fails in CI"

**Common causes**:
- Using relative paths incorrectly
- Environment-specific dependencies
- Missing `.env` variables

**Solution**:
- Check CI logs for specific error
- Test in clean directory: `cd /tmp && git clone <repo> && cd <repo> && pnpm install && pnpm build`
- Ensure all dependencies in `package.json`

---

## Best Practices

### ✅ DO

1. **Let pre-commit run** - Don't use `--no-verify` unless truly necessary
2. **Commit frequently** - Small commits = faster validation
3. **Run `pnpm validate`** before important commits
4. **Fix issues immediately** when hooks catch them
5. **Review hook output** - understand what failed and why

### ❌ DON'T

1. **Don't bypass hooks regularly** - defeats the purpose
2. **Don't commit without testing** - always test your changes
3. **Don't ignore TypeScript errors** - fix them immediately
4. **Don't push with failing tests** - investigate root cause
5. **Don't disable hooks permanently** - fix performance instead

---

## Performance Optimization

### If Pre-Commit Feels Slow

**Check what's taking time**:
```bash
# Run checks individually to identify bottleneck
time pnpm exec tsc --noEmit  # TypeScript
time pnpm lint                # Linting
time pnpm build               # Build
time pnpm test:unit           # Tests
```

**Optimization strategies**:
1. **TypeScript**: Ensure `tsconfig.json` excludes unnecessary files
2. **Tests**: Use `vitest` watch mode during development
3. **Build**: Check `tsup.config.ts` for unnecessary entry points
4. **Dependencies**: Keep dependencies up to date

---

## Comparison: Two Layers vs Three Layers

### Two-Layer Approach (Current)
```
Pre-Commit (30-60s) ──> GitHub Actions (5-15min)
    [Full validation]     [Multi-environment]
```

**Advantages**:
- ✅ Simpler mental model - one local gate
- ✅ No partial commits - every commit is validated
- ✅ Cleaner git history

**Trade-offs**:
- ⚠️ Pre-commit takes longer (30-60s vs 2-5s)

### Three-Layer Approach (Alternative)
```
Pre-Commit (2-5s) ──> Pre-Push (30-60s) ──> GitHub Actions (5-15min)
  [Fast lint]        [Full validation]      [Multi-environment]
```

**Advantages**:
- ✅ Faster commits

**Disadvantages**:
- ❌ Can create "partial commits" (passes commit, fails push)
- ❌ More complex workflow to remember
- ❌ Issues discovered later (at push time, not commit time)
- ❌ Dirtier git history with potentially broken commits

**Why we chose two-layer**: Simpler is better. 30-60 seconds per commit is a small price for guaranteed quality and clean git history.

---

## Emergency Procedures

### Hotfix with Failing CI

If CI is broken but you need to push an urgent hotfix:

1. ⚠️ **Only for genuine emergencies**
2. Create hotfix branch: `git checkout -b hotfix/critical-bug`
3. Make minimal changes
4. Run local validation: `pnpm validate`
5. If local passes, push: `git push origin hotfix/critical-bug`
6. Create PR with `[HOTFIX]` prefix
7. Get immediate review and merge
8. **Fix CI immediately after** hotfix deployed

### Temporarily Disable Hook

**Never recommended**, but if absolutely necessary:

```bash
# Temporarily disable (max 1 hour)
chmod -x .husky/pre-commit

# Make your changes and commit
git commit -m "emergency fix"

# RE-ENABLE IMMEDIATELY
chmod +x .husky/pre-commit

# Then fix the root cause
```

---

## Metrics to Track

Monitor these to measure effectiveness:

- **Pre-commit catch rate**: % of issues caught before commit
- **CI failure rate**: % of pushes that fail CI (target: <5%)
- **Average validation time**: How long pre-commit takes
- **Bypass frequency**: How often `--no-verify` used (target: <2%)
- **Time to fix**: Average time to resolve caught issues

**Review metrics monthly** to assess if the strategy needs adjustment.

---

## Questions & Support

For questions about quality gates:
- Check this document first
- Review `docs/AGENTS.md` for AI collaboration guidelines
- Create GitHub issue for quality gate improvements
- Ask technical lead for clarification

**Remember**: Quality gates exist to help you ship better code faster. They're your friend, not an obstacle!
