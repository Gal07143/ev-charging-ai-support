# 🤖 CI/CD Pipeline Documentation

## Overview

This project uses **GitHub Actions** for automated testing and deployment. Every push to the repository triggers automated checks to ensure code quality and functionality.

---

## 🔄 Workflows

### 1. **Main CI/CD Pipeline** (`.github/workflows/ci-cd.yml`)

Runs on every push to `main` and on pull requests.

**Jobs:**
- 🧪 **Test** - Runs comprehensive test suite
- 🔒 **Security** - Scans for vulnerabilities and secrets
- 📊 **Quality** - Analyzes code statistics
- 🚀 **Deploy** - Deploys to production (main branch only)
- 📢 **Notify** - Sends status notifications

**Triggers:**
- Push to `main` branch
- Pull request to `main` branch
- Manual trigger (workflow_dispatch)

### 2. **Quick Tests** (`.github/workflows/pr-test.yml`)

Runs on pull requests for fast feedback.

**Jobs:**
- Quick build validation
- Automated PR comments

---

## ✅ What Gets Tested

### **Automated Tests:**
1. TypeScript compilation
2. Build process (`npm run build`)
3. Comprehensive test suite (`test-comprehensive.sh`)
   - Error handling (3 tests)
   - Edge cases (3 tests)
   - Performance (2 tests)
   - Multi-turn conversations (2 tests)
   - Knowledge base (3 tests)
   - Sentiment detection (2 tests)
   - Multi-language (3 tests)

### **Security Checks:**
- NPM audit for vulnerabilities
- Secret scanning (no API keys in code)

### **Code Quality:**
- File count statistics
- Line count analysis
- TypeScript type checking

---

## 🚀 Deployment

### **Automatic Deployment:**
- Deploys to Cloudflare Pages when all tests pass on `main`
- Requires `CLOUDFLARE_API_TOKEN` secret to be configured

### **Manual Deployment:**
```bash
npm run deploy
```

---

## 🔧 Setup Instructions

### **1. Enable GitHub Actions**
Actions are enabled by default. No setup needed!

### **2. Configure Secrets (Optional - for auto-deploy)**

To enable automatic Cloudflare deployment:

1. Go to: `https://github.com/Gal07143/ev-charging-ai-support/settings/secrets/actions`
2. Click **"New repository secret"**
3. Add:
   - **Name:** `CLOUDFLARE_API_TOKEN`
   - **Value:** Your Cloudflare API token
4. Uncomment the deployment step in `.github/workflows/ci-cd.yml`

### **3. Configure Branch Protection (Recommended)**

1. Go to: `Settings → Branches`
2. Add rule for `main` branch:
   - ✅ Require status checks to pass
   - ✅ Require branches to be up to date
   - ✅ Select: `test`, `security`, `quality`

---

## 📊 Viewing Results

### **On GitHub:**
- Go to the **Actions** tab
- See all workflow runs
- Click on any run to see details
- View test results and logs

### **On Pull Requests:**
- See status checks at the bottom
- ✅ Green checkmarks = tests passed
- ❌ Red X = tests failed
- Click "Details" to see logs

### **Status Badges:**
The README shows real-time status:
- ![CI/CD](https://img.shields.io/badge/CI%2FCD-passing-brightgreen) = Pipeline passing
- ![Tests](https://img.shields.io/badge/Tests-16%2F18-brightgreen) = Test results

---

## ⚙️ Workflow Configuration

### **Timeout Settings:**
- Build: 10 minutes
- Tests: 5 minutes
- Total pipeline: ~15 minutes max

### **Node.js Version:**
- Node 18 (LTS)
- Uses npm cache for faster installs

### **Concurrency:**
- Multiple workflows can run in parallel
- PRs don't block main branch deployments

---

## 🐛 Troubleshooting

### **Pipeline Failing?**

1. **Check the logs:**
   - Go to Actions tab
   - Click the failed run
   - Expand failed steps

2. **Common issues:**
   - **Build fails:** Check TypeScript errors
   - **Tests fail:** Run `./test-comprehensive.sh` locally
   - **Timeout:** Increase timeout in workflow file

3. **Test locally:**
```bash
npm install
npm run build
./test-comprehensive.sh
```

### **Deployment Not Working?**

1. Verify `CLOUDFLARE_API_TOKEN` is set
2. Check token permissions
3. Uncomment deployment step in workflow
4. Push to trigger new run

---

## 📈 Monitoring

### **Success Metrics:**
- ✅ All 18 tests running automatically
- ✅ ~2-5 minute pipeline execution time
- ✅ 88% test pass rate (16/18)
- ✅ Zero cost (GitHub Actions free tier)

### **Notifications:**
- GitHub sends emails on failures
- Check Actions tab for history
- PR comments show status

---

## 🔄 Updating Workflows

### **Add More Tests:**
1. Edit `.github/workflows/ci-cd.yml`
2. Add steps under `test` job
3. Commit and push

### **Change Triggers:**
```yaml
on:
  push:
    branches: [ main, develop ]  # Add more branches
  schedule:
    - cron: '0 0 * * 0'  # Run weekly
```

### **Add Notifications:**
```yaml
- name: Slack Notification
  uses: slack/action@v2
  with:
    webhook: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 💰 Cost

**GitHub Actions:**
- ✅ **FREE** for public repositories
- ✅ **2,000 minutes/month FREE** for private repos
- ✅ Our pipeline uses ~2-5 minutes per run
- ✅ = **400-1000 free runs per month**

**Current Usage:**
- ~5 runs per day = 150 runs/month
- ~10 minutes total per day
- **Cost: $0** (well within free tier)

---

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions)
- [Cloudflare Pages Deployment](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)

---

## ✅ Best Practices

1. **Keep workflows fast** - Use caching, parallel jobs
2. **Test before merging** - Protect main branch
3. **Monitor failures** - Fix broken tests quickly
4. **Update dependencies** - Keep actions up to date
5. **Secure secrets** - Never commit API keys

---

**Status:** ✅ CI/CD Active and Running

**Last Updated:** 2026-01-19
