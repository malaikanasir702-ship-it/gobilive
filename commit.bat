@echo off
git add src/features/beans/beans.route.ts
git commit -m "fix: add missing flat bean routes matching frontend calls (dollar-rate, d2b-commission, d2b-rate)"
git push origin main
