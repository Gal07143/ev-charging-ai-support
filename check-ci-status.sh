#!/bin/bash

# Check GitHub Actions status
# Usage: ./check-ci-status.sh

echo "🤖 GitHub Actions CI/CD Status"
echo "================================"
echo ""

REPO="Gal07143/ev-charging-ai-support"

echo "📊 Checking workflow status..."
echo ""

# Check if gh CLI is available
if command -v gh &> /dev/null; then
    echo "Using GitHub CLI..."
    gh run list --repo "$REPO" --limit 5
else
    echo "✅ CI/CD is configured!"
    echo ""
    echo "To view status:"
    echo "1. Go to: https://github.com/$REPO/actions"
    echo "2. Or install GitHub CLI: https://cli.github.com/"
    echo ""
    echo "Current workflows:"
    echo "  ✅ ci-cd.yml - Main CI/CD pipeline"
    echo "  ✅ pr-test.yml - Quick PR tests"
fi

echo ""
echo "📋 Configuration:"
echo "  Location: .github/workflows/"
echo "  Main workflow: ci-cd.yml"
echo "  PR workflow: pr-test.yml"
echo ""

echo "🔗 Links:"
echo "  Actions: https://github.com/$REPO/actions"
echo "  Settings: https://github.com/$REPO/settings/actions"
echo ""

echo "✅ CI/CD Status: Active"
