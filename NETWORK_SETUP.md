# 🌐 网络问题解决指南

本指南将帮助您解决 Hugging Face 模型下载的网络连接问题。

## 🚀 快速解决方案

### 1. 自动诊断网络问题

运行网络诊断工具：

```bash
npm run network-check
```

该工具将：
- ✅ 测试各种网络连接
- ⚙️ 自动配置最佳镜像设置
- 💡 提供个性化解决方案

### 2. 手动配置镜像站（推荐）

在 `.env.local` 文件中添加：

```env
HF_ENDPOINT="https://hf-mirror.com"
```

然后重新运行程序：

```bash
npm run process
```

## 🔧 详细解决方案

### 方案1: 使用 HF-Mirror 镜像站

**适用场景**: 无法访问 huggingface.co 但网络正常

1. 在 `.env.local` 中配置：
   ```env
   HF_ENDPOINT="https://hf-mirror.com"
   ```

2. 验证配置：
   ```bash
   npm run network-check
   ```

### 方案2: 配置代理服务器

**适用场景**: 有代理服务器可用

1. 在 `.env.local` 中添加：
   ```env
   HTTP_PROXY="http://your-proxy:port"
   HTTPS_PROXY="http://your-proxy:port"
   ```

2. 如果代理需要认证：
   ```env
   HTTP_PROXY="http://username:password@proxy:port"
   HTTPS_PROXY="http://username:password@proxy:port"
   ```

### 方案3: 预下载模型到本地

**适用场景**: 网络不稳定，希望一次性下载

#### 使用 huggingface-cli

1. 安装工具：
   ```bash
   pip install huggingface_hub
   ```

2. 设置镜像：
   ```bash
   # Linux/Mac
   export HF_ENDPOINT=https://hf-mirror.com
   
   # Windows PowerShell
   $env:HF_ENDPOINT = "https://hf-mirror.com"
   ```

3. 下载模型：
   ```bash
   huggingface-cli download Xenova/vit-gpt2-image-captioning --local-dir ./models/vit-gpt2-image-captioning
   huggingface-cli download Xenova/clip-ViT-B-32 --local-dir ./models/clip-ViT-B-32
   ```

#### 使用 hfd 工具（多线程下载）

1. 下载 hfd：
   ```bash
   wget https://hf-mirror.com/hfd/hfd.sh
   chmod +x hfd.sh
   ```

2. 设置环境变量：
   ```bash
   export HF_ENDPOINT=https://hf-mirror.com
   ```

3. 下载模型：
   ```bash
   ./hfd.sh Xenova/vit-gpt2-image-captioning
   ./hfd.sh Xenova/clip-ViT-B-32
   ```

### 方案4: 使用其他镜像站

如果 HF-Mirror 不可用，可以尝试其他镜像：

```env
# 选择其中一个
HF_ENDPOINT="https://hf-mirror.com"
HF_ENDPOINT="https://your-custom-mirror.com"
```

## 🔍 网络问题诊断

### 常见错误信息

1. **连接超时**
   ```
   TimeoutError: Read timed out
   ```
   **解决**: 配置镜像站或增加超时时间

2. **连接被拒绝**
   ```
   ConnectionRefusedError: [Errno 111] Connection refused
   ```
   **解决**: 检查代理设置或使用镜像站

3. **DNS 解析失败**
   ```
   gaierror: [Errno -2] Name or service not known
   ```
   **解决**: 检查网络连接或DNS设置

### 网络连接测试

手动测试网络连接：

```bash
# 测试 Hugging Face 官网
curl -I https://huggingface.co

# 测试镜像站
curl -I https://hf-mirror.com

# 测试国际网络
curl -I https://www.google.com
```

## ⚡ 性能优化

### 1. 启用 hf-transfer

安装 hf-transfer 以获得更快的下载速度：

```bash
pip install hf-transfer
```

设置环境变量：

```bash
# Linux/Mac
export HF_HUB_ENABLE_HF_TRANSFER=1

# Windows PowerShell
$env:HF_HUB_ENABLE_HF_TRANSFER = 1
```

### 2. 配置下载超时

在 `.env.local` 中设置：

```env
HF_HUB_DOWNLOAD_TIMEOUT=300
```

## 🆘 故障排除

### 如果所有方案都无效

1. **检查防火墙设置**
   - 确保允许 Node.js 访问网络
   - 检查企业防火墙规则

2. **尝试不同网络**
   - 使用移动热点测试
   - 尝试不同的网络环境

3. **联系网络管理员**
   - 如果在企业网络中，可能需要特殊配置

4. **使用离线模式**
   - 考虑使用本地模型文件
   - 或在其他环境下载后传输

## 📞 获取帮助

如果问题仍然存在：

1. 运行诊断工具：`npm run network-check`
2. 查看详细错误日志
3. 检查系统网络配置
4. 联系技术支持

---

💡 **提示**: 大多数网络问题都可以通过配置镜像站解决。建议优先尝试方案1。 