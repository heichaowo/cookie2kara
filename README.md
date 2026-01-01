# Cookie2Kara

一个用于从 Cookie Cloud 同步 Cookie 到 KaraKeep 格式的脚本。

## 功能特性

- 从 Cookie Cloud API 获取加密的 Cookie 数据
- 自动解密 Cookie 数据
- 转换为 KaraKeep 所需的 JSON 格式
- 支持一次性同步和定时同步
- 完整的错误处理和日志记录

## 安装依赖

```bash
npm install
```

## 配置

1. 复制 `.env.example` 到 `.env`
2. 填写你的 Cookie Cloud 配置信息：

```env
COOKIECLOUD_HOST=https://your-cookie-cloud-host.com
COOKIECLOUD_UUID=your-uuid
COOKIECLOUD_PASSWORD=your-password
```

## 使用方法

### 一次性同步

```bash
npm run sync
# 或者
node cookie2kara.mjs
```

### 定时同步（每30分钟）

```bash
npm run watch
# 或者
node cookie2kara.mjs --watch
```

### 自定义同步间隔

```bash
node cookie2kara.mjs --watch --interval=60  # 每60分钟同步一次
```

## 输出格式

脚本会生成 `cookies.json` 文件，格式符合 KaraKeep 的要求：

```json
[
  {
    "name": "session",
    "value": "xxx",
    "domain": ".example.com",
    "path": "/",
    "expires": 1735689600,
    "httpOnly": true,
    "secure": true,
    "sameSite": "Lax"
  }
]
```

## 字段说明

- `name`: Cookie 名称（必需）
- `value`: Cookie 值（必需）
- `domain`: 域名（可选）
- `path`: 路径（可选）
- `expires`: 过期时间戳（可选）
- `httpOnly`: 是否仅 HTTP（可选）
- `secure`: 是否安全连接（可选）
- `sameSite`: 同站策略，值为 "Strict"、"Lax" 或 "None"（可选）

## Ubuntu 系统下使用 Cron 定时任务

如果你希望在 Ubuntu 系统下使用 cron 来定时执行同步任务，而不是让脚本持续运行，可以按照以下步骤配置：

### 1. 直接配置 Cron 任务（推荐）

编辑 crontab：
```bash
crontab -e
```

直接添加定时任务（以下是一些常用的时间配置示例）：

```bash
# 每30分钟执行一次
*/30 * * * * cd /home/your-username/cookie2kara && /usr/bin/node cookie2kara.mjs >> /var/log/cookie2kara.log 2>&1

# 每小时执行一次
0 * * * * cd /home/your-username/cookie2kara && /usr/bin/node cookie2kara.mjs >> /var/log/cookie2kara.log 2>&1

# 每天凌晨2点执行一次
0 2 * * * cd /home/your-username/cookie2kara && /usr/bin/node cookie2kara.mjs >> /var/log/cookie2kara.log 2>&1

# 每6小时执行一次
0 */6 * * * cd /home/your-username/cookie2kara && /usr/bin/node cookie2kara.mjs >> /var/log/cookie2kara.log 2>&1
```

### 2. 使用 Shell 脚本（可选）

如果你的命令比较复杂或需要更多的环境配置，也可以创建 shell 脚本：

```bash
# 创建脚本文件
nano /home/your-username/cookie2kara/sync.sh
```

脚本内容：
```bash
#!/bin/bash
cd /home/your-username/cookie2kara
/usr/bin/node cookie2kara.mjs >> /var/log/cookie2kara.log 2>&1
```

给脚本添加执行权限：
```bash
chmod +x /home/your-username/cookie2kara/sync.sh
```

然后在 crontab 中引用：
```bash
*/30 * * * * /home/your-username/cookie2kara/sync.sh
```

### 3. 查看日志

查看同步日志：
```bash
tail -f /var/log/cookie2kara.log
```

### 4. Cron 时间格式说明

```
* * * * * 命令
│ │ │ │ │
│ │ │ │ └─── 星期几 (0-7, 0和7都表示星期日)
│ │ │ └───── 月份 (1-12)
│ │ └─────── 日期 (1-31)
│ └───────── 小时 (0-23)
└─────────── 分钟 (0-59)
```

### 5. 验证 Cron 任务

查看当前用户的 cron 任务：
```bash
crontab -l
```

查看 cron 服务状态：
```bash
sudo systemctl status cron
```

重启 cron 服务（如需要）：
```bash
sudo systemctl restart cron
```

## 与 KaraKeep 集成

### Docker 挂载方式

如果你的 KaraKeep 运行在 Docker 容器中，需要将生成的 cookies.json 文件挂载到 **爬虫容器** 中，而不是 APP 容器。

#### 1. 修改 KaraKeep 爬虫容器的 Docker Compose 配置

在 KaraKeep 的 `docker-compose.yml` 文件中，找到爬虫服务（通常是 crawler 或 spider 相关的服务），添加以下配置：

```yaml
services:
  karakeep-crawler:  # 爬虫服务名称，根据实际情况调整
    # ... 其他配置
    volumes:
      # 将本地的 cookies.json 文件挂载到爬虫容器内
      - /data/app/cookie2kara/cookies.json:/data/cookies.json:ro
      # ... 其他挂载
    environment:
      # 设置爬虫读取 cookie 文件的路径
      - BROWSER_COOKIE_PATH=/data/cookies.json
      # ... 其他环境变量
```

#### 2. 配置说明

- **Volume 挂载**：`/data/app/cookie2kara/cookies.json:/data/cookies.json:ro`
  - `/data/app/cookie2kara/cookies.json`：宿主机上的 cookies.json 文件路径
  - `/data/cookies.json`：爬虫容器内的文件路径
  - `:ro`：只读模式，防止容器修改文件

- **环境变量**：`BROWSER_COOKIE_PATH=/data/cookies.json`
  - 告诉 KaraKeep 爬虫从容器内的 `/data/cookies.json` 路径读取 cookie 文件

#### 3. 完整的工作流程

1. **同步 Cookie**：运行 cookie2kara 脚本生成 cookies.json
2. **Docker 挂载**：KaraKeep 爬虫容器通过 volume 访问 cookies.json
3. **爬虫使用**：爬虫服务读取 cookie 文件进行网站访问
4. **自动更新**：每次 cookie2kara 更新文件，爬虫会读取最新的 cookie 数据

#### 4. 目录结构示例

```
/data/app/cookie2kara/
├── .env
├── cookie2kara.mjs
├── package.json
└── cookies.json          # 生成的 cookie 文件

/path/to/karakeep/
└── docker-compose.yml    # KaraKeep 的配置文件（包含爬虫服务）
```

### 直接文件路径方式

如果 KaraKeep 爬虫不是运行在 Docker 中，可以直接设置文件路径：

```bash
# 设置环境变量指向 cookies.json 文件
export BROWSER_COOKIE_PATH=/data/app/cookie2kara/cookies.json

# 或者在 KaraKeep 爬虫的配置文件中设置
BROWSER_COOKIE_PATH=/data/app/cookie2kara/cookies.json
```

## 注意事项

- 确保 Cookie Cloud 服务正常运行
- 检查网络连接和防火墙设置
- 定时同步模式下，脚本会持续运行，按 Ctrl+C 停止
- 使用 cron 时，确保脚本路径和 Node.js 路径正确
- 建议定期检查日志文件，确保同步任务正常执行
- 如果使用相对路径，确保在 cron 脚本中切换到正确的工作目录