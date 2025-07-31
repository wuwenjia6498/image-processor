@echo off
echo 正在恢复本地开发环境的API密钥...

if exist .env.local.backup (
    echo 找到备份文件，正在恢复...
    copy .env.local.backup .env.local
    echo 恢复完成！您的真实API密钥已恢复到 .env.local 文件中。
    echo.
    echo 注意：
    echo - .env.local 现在包含您的真实API密钥
    echo - 请不要意外提交这个文件到Git
    echo - 如果需要再次推送到GitHub，请先运行 fix-git-push.bat
) else (
    echo 错误：未找到 .env.local.backup 文件
    echo 请手动恢复您的API密钥配置
)

pause 