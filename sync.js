// sync.js - 开发端同步工具
// 用于文件拉取/推送功能
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const { promisify } = require('util');

// 简单的彩色输出函数，不依赖外部库
const chalk = {
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    bold: (text) => `\x1b[1m${text}\x1b[0m`
};

// ============= 配置（支持外部配置文件） =============
const CONFIG_PATH = path.resolve(__dirname, 'sync.config.json');
let externalConfig = {};
try {
    if (fs.existsSync(CONFIG_PATH)) {
        externalConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        console.log(chalk.yellow(`[INFO] 使用外部配置: ${CONFIG_PATH}`));
    }
} catch (e) {
    console.log(chalk.yellow(`[WARNING] 外部配置读取失败，将使用内置配置: ${e.message}`));
}

const SERVER_URL = externalConfig.serverUrl || '-'; // 修改为生成环境同步地址
const TOKEN = externalConfig.token || '-';     // 必须与 PHP 中一致
const LOCAL_ROOT = externalConfig.localRoot || '.';                            // 本地项目根目录（当前目录）
const REMOTE_BASE = externalConfig.remoteBase || '';                            // 服务器上的子目录前缀，如 'project/'
const DEBUG = typeof externalConfig.debug === 'boolean' ? externalConfig.debug : (process.env.DEBUG === 'true');        // 调试模式
// =================================

// 忽略列表 - 只忽略特定文件和目录，不要忽略整个目录树
const DEFAULT_IGNORE_FILES = [
    'sync.js', 
    'node_modules', 
    '.git', 
    'debug.flag', 
    'package.json', 
    '.last_sync_timestamp',
    'sync-error.log',
    'sync.config.json'
];
const IGNORE_FILES = Array.isArray(externalConfig.ignore) ? externalConfig.ignore : DEFAULT_IGNORE_FILES;

// 检查是否应该忽略文件
function shouldIgnore(filePath) {
    // 标准化路径
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    // 检查是否在忽略列表中
    for (const pattern of IGNORE_FILES) {
        if (normalizedPath.includes(pattern)) {
            return true;
        }
    }
    
    return false;
}

// 将异步函数转换为Promise
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);

// 日志函数
function log(message, type = 'info') {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    let formattedMessage = `[${timestamp}] `;
    
    switch (type) {
        case 'error':
            formattedMessage += chalk.red(`[ERROR] ${message}`);
            break;
        case 'success':
            formattedMessage += chalk.green(`[SUCCESS] ${message}`);
            break;
        case 'warning':
            formattedMessage += chalk.yellow(`[WARNING] ${message}`);
            break;
        case 'info':
        default:
            formattedMessage += chalk.blue(`[INFO] ${message}`);
    }
    
    console.log(formattedMessage);
    
    // 如果是错误，还可以写入日志文件
    if (type === 'error' && DEBUG) {
        try {
            fs.appendFileSync('sync-error.log', `[${timestamp}] ${message}\n`);
        } catch (e) {
            // 忽略日志写入错误
        }
    }
}

// 这个函数已经被上面的新版本替代

// 计算文件哈希值，用于比较文件内容是否相同
async function calculateFileHash(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
}

// 将本地路径转为远程路径
function localToRemote(localPath) {
    const relPath = path.relative(LOCAL_ROOT, localPath).replace(/\\/g, '/');
    return (REMOTE_BASE + relPath).replace(/^\/+/, '');
}

// 将远程路径转为本地路径
function remoteToLocal(remotePath) {
    if (REMOTE_BASE && remotePath.startsWith(REMOTE_BASE)) {
        remotePath = remotePath.slice(REMOTE_BASE.length).replace(/^\/+/, '');
    }
    return path.join(LOCAL_ROOT, remotePath).replace(/\\/g, '/');
}

// 获取服务器文件列表
async function listRemoteFiles() {
    try {
        log('获取远程文件列表...');
        const res = await axios.get(SERVER_URL, {
            params: { action: 'list', token: TOKEN },
            timeout: 30000 // 30秒超时
        });
        
        if (res.data.error) {
            throw new Error(res.data.error);
        }
        
        log(`获取到 ${res.data.files?.length || 0} 个远程文件`, 'success');
        return res.data.files || [];
    } catch (err) {
        log(`获取远程文件列表失败: ${err.message}`, 'error');
        throw err;
    }
}

// 读取远程文件内容（base64）
async function readRemoteFile(remotePath) {
    try {
        if (DEBUG) log(`读取远程文件: ${remotePath}`);
        
        const res = await axios.post(SERVER_URL, new URLSearchParams({
            action: 'read',
            file: remotePath,
            token: TOKEN
        }), {
            timeout: 30000 // 30秒超时
        });
        
        if (res.data.error) {
            log(`读取远程文件失败: ${remotePath} - ${res.data.error}`, 'error');
            return null;
        }
        
        return {
            content: Buffer.from(res.data.content, 'base64'),
            mtime: res.data.mtime,
            size: res.data.size || 0
        };
    } catch (err) {
        log(`读取远程文件失败: ${remotePath} - ${err.message}`, 'error');
        return null;
    }
}

// 写入远程文件
async function writeRemoteFile(remotePath, buffer) {
    try {
        const base64Content = buffer.toString('base64');
        
        log(`推送文件: ${remotePath} (${buffer.length} 字节)`);
        
        const res = await axios.post(SERVER_URL, new URLSearchParams({
            action: 'write',
            file: remotePath,
            content: base64Content,
            token: TOKEN
        }), {
            timeout: 60000 // 60秒超时，大文件可能需要更长时间
        });
        
        if (res.data.error) {
            log(`推送失败: ${remotePath} - ${res.data.error}`, 'error');
            return false;
        }
        
        if (res.data.success) {
            log(`推送成功: ${remotePath}`, 'success');
            return true;
        } else {
            log(`推送失败: ${remotePath}`, 'error');
            return false;
        }
    } catch (err) {
        log(`推送失败: ${remotePath} - ${err.message}`, 'error');
        return false;
    }
}

// 删除远程文件
async function deleteRemoteFile(remotePath) {
    try {
        log(`删除远程文件: ${remotePath}`);
        
        const res = await axios.post(SERVER_URL, new URLSearchParams({
            action: 'delete',
            file: remotePath,
            token: TOKEN
        }));
        
        if (res.data.success) {
            log(`删除成功: ${remotePath}`, 'success');
            return true;
        } else {
            log(`删除失败: ${remotePath} - ${res.data.error || '未知错误'}`, 'error');
            return false;
        }
    } catch (err) {
        log(`删除失败: ${remotePath} - ${err.message}`, 'error');
        return false;
    }
}

// 递归获取本地文件列表
async function* walkLocalFiles(dir) {
    try {
        const files = await readdir(dir);
        
        for (const file of files) {
            if (shouldIgnore(file)) continue;
            
            const fullPath = path.join(dir, file);
            const stats = await stat(fullPath);
            
            if (stats.isDirectory()) {
                yield* walkLocalFiles(fullPath);
            } else {
                yield {
                    path: fullPath,
                    mtime: stats.mtimeMs / 1000,
                    size: stats.size
                };
            }
        }
    } catch (err) {
        log(`读取目录失败: ${dir} - ${err.message}`, 'error');
    }
}

// 拉取：从服务器下载到本地
async function pull(options = {}) {
    const { force = false, dryRun = false } = options;
    
    try {
        log('🔄 开始拉取服务器文件...', 'info');
        const remoteFiles = await listRemoteFiles();
        let totalFiles = 0;
        let updatedFiles = 0;
        let skippedFiles = 0;
        let errorFiles = 0;
        
        for (const file of remoteFiles) {
            if (file.type !== 'file') continue;
            const remotePath = file.path;
            if (shouldIgnore(remotePath)) {
                if (DEBUG) log(`忽略文件: ${remotePath}`, 'info');
                continue;
            }
            
            totalFiles++;
            const localPath = remoteToLocal(remotePath);
            const dir = path.dirname(localPath);
            
            // 确保目录存在
            if (!fs.existsSync(dir)) {
                if (dryRun) {
                    log(`将创建目录: ${dir}`, 'info');
                } else {
                    await mkdir(dir, { recursive: true });
                }
            }
            
            // 判断是否需要更新
            let needUpdate = force;
            
            if (!needUpdate && fs.existsSync(localPath)) {
                const localStat = await stat(localPath);
                const localMtime = localStat.mtimeMs / 1000;
                
                // 如果远程文件更新，则需要更新本地文件
                if (localMtime < file.mtime) {
                    needUpdate = true;
                }
            } else if (!fs.existsSync(localPath)) {
                // 本地不存在，需要创建
                needUpdate = true;
            }
            
            if (needUpdate) {
                if (dryRun) {
                    log(`将拉取: ${remotePath} -> ${localPath}`, 'info');
                    updatedFiles++;
                    continue;
                }
                
                const data = await readRemoteFile(remotePath);
                if (data) {
                    try {
                        await writeFile(localPath, data.content);
                        // 设置文件修改时间与服务器一致
                        fs.utimesSync(localPath, file.mtime, file.mtime);
                        log(`拉取成功: ${remotePath}`, 'success');
                        updatedFiles++;
                    } catch (err) {
                        log(`写入本地文件失败: ${localPath} - ${err.message}`, 'error');
                        errorFiles++;
                    }
                } else {
                    errorFiles++;
                }
            } else {
                if (DEBUG) log(`跳过文件(未修改): ${remotePath}`, 'info');
                skippedFiles++;
            }
        }
        
        log(`拉取完成! 总文件: ${totalFiles}, 更新: ${updatedFiles}, 跳过: ${skippedFiles}, 错误: ${errorFiles}`, 
            errorFiles > 0 ? 'warning' : 'success');
            
        return { totalFiles, updatedFiles, skippedFiles, errorFiles };
    } catch (err) {
        log(`拉取操作失败: ${err.message}`, 'error');
        throw err;
    }
}

// 获取文件的最后修改时间
async function getLastModifiedTime(filePath) {
    try {
        const stats = await stat(filePath);
        return stats.mtimeMs / 1000;
    } catch (err) {
        return 0;
    }
}

// 保存文件哈希缓存，避免重复计算
const fileHashCache = new Map();
// 保存上次同步时间
let lastSyncTime = 0;
const SYNC_TIMESTAMP_FILE = '.last_sync_timestamp';

// 加载上次同步时间
async function loadLastSyncTime() {
    try {
        if (fs.existsSync(SYNC_TIMESTAMP_FILE)) {
            const timestamp = await readFile(SYNC_TIMESTAMP_FILE, 'utf8');
            lastSyncTime = parseInt(timestamp.trim(), 10) || 0;
            log(`上次同步时间: ${new Date(lastSyncTime * 1000).toLocaleString()}`, 'info');
        } else {
            // 如果时间戳文件不存在，创建一个初始时间戳
            // 使用当前时间减去1小时作为初始时间戳
            // 这样首次运行时只会推送最近1小时内修改的文件
            const initialTime = Math.floor(Date.now() / 1000) - 3600;
            await writeFile(SYNC_TIMESTAMP_FILE, initialTime.toString());
            lastSyncTime = initialTime;
            log(`创建初始同步时间戳: ${new Date(lastSyncTime * 1000).toLocaleString()}`, 'info');
        }
    } catch (err) {
        log(`读取同步时间戳失败: ${err.message}`, 'warning');
    }
}

// 保存当前同步时间
async function saveCurrentSyncTime() {
    try {
        const currentTime = Math.floor(Date.now() / 1000);
        await writeFile(SYNC_TIMESTAMP_FILE, currentTime.toString());
        lastSyncTime = currentTime;
    } catch (err) {
        log(`保存同步时间戳失败: ${err.message}`, 'warning');
    }
}

// 检查文件是否在上次同步后被修改
async function isFileModifiedSinceLastSync(filePath) {
    if (lastSyncTime === 0) return true;
    
    const mtime = await getLastModifiedTime(filePath);
    return mtime > lastSyncTime;
}

// 推送：从本地上传到服务器
async function push(options = {}) {
    const { 
        force = false, 
        dryRun = false, 
        onlyModified = true, 
        recentOnly = false,
        fullSync = false  // 新增全量同步选项
    } = options;
    
    try {
        log('🚀 开始推送本地文件...', 'info');
        
        // 如果是全量同步，删除时间戳文件
        if (fullSync && fs.existsSync(SYNC_TIMESTAMP_FILE)) {
            try {
                fs.unlinkSync(SYNC_TIMESTAMP_FILE);
                log('已启用全量同步模式，时间戳文件已删除', 'info');
            } catch (err) {
                log(`删除时间戳文件失败: ${err.message}`, 'warning');
            }
        }
        
        // 加载上次同步时间
        if (onlyModified && !force && !fullSync) {
            await loadLastSyncTime();
            
            // 如果是首次运行且启用了recentOnly选项
            if (recentOnly && fs.existsSync(SYNC_TIMESTAMP_FILE)) {
                log('首次运行或时间戳文件已重置，只推送最近修改的文件', 'info');
            }
        }
        
        // 获取远程文件列表和映射
        const remoteFiles = await listRemoteFiles();
        const remoteMap = Object.fromEntries(remoteFiles.map(f => [f.path, f]));

        // 删除远程 bundle 文件（根目录与 pages/**），避免旧版本被引用
        try {
            const bundleRegex = /(^|\/)bundle-.*\.min\.(js|css)(\.map)?$/i;
            const toDelete = remoteFiles.filter(f => f && f.type === 'file' && bundleRegex.test(f.path) && (f.path.startsWith('pages/') || !f.path.includes('/')));
            if (toDelete.length > 0) {
                log(`清理远程 bundle 文件: ${toDelete.length} 个`, 'info');
                for (const f of toDelete) {
                    if (dryRun) {
                        log(`将删除远程: ${f.path}`, 'info');
                    } else {
                        await deleteRemoteFile(f.path);
                    }
                }
            } else {
                if (DEBUG) log('远程无 bundle 文件需要清理', 'info');
            }
        } catch (e) {
            log(`清理远程 bundle 文件失败: ${e.message}`, 'warning');
        }
        
        let totalFiles = 0;
        let updatedFiles = 0;
        let skippedFiles = 0;
        let errorFiles = 0;
        let scannedFiles = 0;
        
        // 遍历本地文件
        for await (const { path: localPath, mtime } of walkLocalFiles(LOCAL_ROOT)) {
            const remotePath = localToRemote(localPath);
            totalFiles++;
            scannedFiles++;
            
            // 每扫描100个文件输出一次进度
            if (scannedFiles % 100 === 0) {
                log(`已扫描 ${scannedFiles} 个文件...`, 'info');
            }
            
            try {
                // 检查文件是否在上次同步后被修改
                let needUpdate = force || fullSync;
                
                if (!needUpdate && onlyModified) {
                    const isModified = await isFileModifiedSinceLastSync(localPath);
                    if (!isModified) {
                        if (DEBUG) log(`跳过文件(未修改): ${remotePath}`, 'info');
                        skippedFiles++;
                        continue;
                    }
                }
                
                // 读取本地文件内容
                const content = await readFile(localPath);
                
                // 计算文件哈希，使用缓存避免重复计算
                let localHash;
                if (fileHashCache.has(localPath)) {
                    localHash = fileHashCache.get(localPath);
                } else {
                    localHash = await calculateFileHash(content);
                    fileHashCache.set(localPath, localHash);
                }
                
                // 检查远程是否存在 & 内容是否一致
                const remoteInfo = remoteMap[remotePath];
                
                if (!remoteInfo) {
                    // 远程不存在，需要上传
                    needUpdate = true;
                } else if (!needUpdate && !force) {
                    // 检查文件内容是否相同（除非使用force选项）
                    const remoteData = await readRemoteFile(remotePath);
                    if (remoteData) {
                        const remoteHash = await calculateFileHash(remoteData.content);
                        if (localHash !== remoteHash) {
                            needUpdate = true;
                            log(`文件内容不同: ${remotePath}`, 'info');
                        }
                    } else {
                        // 无法读取远程文件，假设需要更新
                        needUpdate = true;
                        log(`无法读取远程文件: ${remotePath}，将重新上传`, 'warning');
                    }
                }
                
                if (needUpdate) {
                    if (dryRun) {
                        log(`将推送: ${localPath} -> ${remotePath}`, 'info');
                        updatedFiles++;
                    } else {
                        const success = await writeRemoteFile(remotePath, content);
                        if (success) {
                            updatedFiles++;
                        } else {
                            errorFiles++;
                        }
                    }
                } else {
                    if (DEBUG) log(`跳过文件(内容相同): ${remotePath}`, 'info');
                    skippedFiles++;
                }
            } catch (err) {
                log(`处理文件失败: ${localPath} - ${err.message}`, 'error');
                errorFiles++;
            }
        }
        
        // 保存当前同步时间
        if (!dryRun && onlyModified && !fullSync) {
            await saveCurrentSyncTime();
        }
        
        log(`推送完成! 总文件: ${totalFiles}, 更新: ${updatedFiles}, 跳过: ${skippedFiles}, 错误: ${errorFiles}`, 
            errorFiles > 0 ? 'warning' : 'success');
            
        return { totalFiles, updatedFiles, skippedFiles, errorFiles };
    } catch (err) {
        log(`推送操作失败: ${err.message}`, 'error');
        throw err;
    }
}

// 同步：双向同步文件
async function sync(options = {}) {
    log('🔄 开始双向同步文件...', 'info');
    
    try {
        // 先拉取远程文件
        await pull(options);
        
        // 再推送本地文件
        await push(options);
        
        log('🎉 同步完成!', 'success');
    } catch (err) {
        log(`同步操作失败: ${err.message}`, 'error');
        process.exit(1);
    }
}

// 显示帮助信息
function showHelp() {
    console.log(`
${chalk.bold('文件同步工具')} - 用于开发环境与生产环境之间的文件同步

${chalk.bold('用法:')}
  node sync.js <命令> [选项]

${chalk.bold('命令:')}
  pull              从服务器拉取文件到本地
  push              从本地推送文件到服务器
  sync              双向同步文件
  help              显示帮助信息

${chalk.bold('选项:')}
  --force, -f       强制更新所有文件，忽略时间戳和内容比较
  --dry-run, -d     模拟运行，不实际修改文件
  --debug           启用调试模式，显示详细日志
  --all             推送所有文件，不仅是修改过的文件（会进行内容比较）
  --recent, -r      首次运行时只推送最近1小时内修改的文件（避免全量推送）
  --full-sync       全量同步，重置时间戳并推送所有文件（解决文件不全问题）

${chalk.bold('示例:')}
  node sync.js pull
  node sync.js push            # 只推送上次同步后修改的文件
  node sync.js push --recent   # 首次运行时只推送最近1小时内修改的文件
  node sync.js push --all      # 推送所有文件（会进行内容比较）
  node sync.js push --force    # 强制推送所有文件（不进行内容比较）
  node sync.js push --full-sync # 全量同步，解决文件不全问题
  node sync.js sync --dry-run

${chalk.bold('问题排查:')}
  1. 如果发现同步后文件不全，请使用 --full-sync 选项进行全量同步
  2. 如果想重置同步记录，只需删除 .last_sync_timestamp 文件
  3. 使用 --debug 选项可以查看详细的同步过程和问题
`);
}

// 解析命令行参数
function parseArgs() {
    const args = process.argv.slice(2);
    const command = args[0];
    const options = {
        force: args.includes('--force') || args.includes('-f'),
        dryRun: args.includes('--dry-run') || args.includes('-d'),
        debug: args.includes('--debug') || process.env.DEBUG === 'true',
        onlyModified: !args.includes('--all'), // 默认只推送修改过的文件，除非使用--all选项
        recentOnly: args.includes('--recent') || args.includes('-r'), // 只推送最近修改的文件
        fullSync: args.includes('--full-sync') || args.includes('--full') // 全量同步，重置时间戳
    };
    
    return { command, options };
}

// 主入口
(async () => {
    try {
        const { command, options } = parseArgs();
        
        // 设置全局调试模式
        if (options.debug) {
            process.env.DEBUG = 'true';
        }
        
        switch (command) {
            case 'pull':
                await pull(options);
                break;
                
            case 'push':
                await push(options);
                break;
                
            case 'sync':
                await sync(options);
                break;
                
            case 'help':
            case '--help':
            case '-h':
                showHelp();
                break;
                
            default:
                log('未知命令或未提供命令', 'error');
                showHelp();
                process.exit(1);
        }
    } catch (err) {
        log(`程序执行错误: ${err.message}`, 'error');
        process.exit(1);
    }
})();
