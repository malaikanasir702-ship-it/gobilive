@echo off
git add -A public/admin/
git status --short public/admin/
git commit -m "fix: gifts 1to1 ratio UI and beans icon in admin panel"
git push origin main
