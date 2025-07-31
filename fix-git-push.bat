@echo off
echo 正在解决Git推送问题...

echo.
echo 步骤1: 检查当前Git状态
git status

echo.
echo 步骤2: 添加所有更改到暂存区
git add .

echo.
echo 步骤3: 提交更改
git commit -m "fix: replace sensitive API keys with placeholders for secure push"

echo.
echo 步骤4: 推送到GitHub
git push origin main

echo.
echo 如果推送成功，请记住：
echo 1. 使用 .env.local.backup 文件恢复您的真实API密钥
echo 2. 将 .env.local.backup 重命名为 .env.local 以恢复本地开发环境
echo 3. .env.local.backup 已被添加到 .gitignore，不会被跟踪

pause 