chcp 65001
git remote get-url origin
git branch --show-current
git status --short --branch
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git log -1 --oneline HEAD
git log -1 --oneline origin/main

pause

git log --oneline --left-right HEAD...origin/main

pause

git switch main
git status --short
git pull --ff-only origin main
git status --short --branch
git remote get-url origin
git branch --show-current
git status --short --branch

echo ...все...
pause