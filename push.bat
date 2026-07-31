@echo off
git add public/admin
git status --short public/admin
git commit -m "feat: rebuilt admin panel - multi-role dashboard selector with role picker modal"
git push origin main
