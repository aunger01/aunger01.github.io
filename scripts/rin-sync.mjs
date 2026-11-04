// Rin 主站 D1 → Jekyll 备份站内容同步脚本（文章 + 动态 + 图片本地化）
// 用法: node scripts/rin-sync.mjs
// 环境变量: CF_API_TOKEN / CF_ACCOUNT_ID / D1_DATABASE_ID / R2_BUCKET_NAME
//           RIN_MAIN_SITE（可选，主站域名，缺省读 _config.yml 的 rin.main_url）
//           RIN_REQUIRE_WEBP=1（可选，强制要求 sharp，缺失即报错，避免静默退化成原格式）
// 只管理带 rin-sync-managed 标记的 _posts 文件、_data/rin-moments.json 与 assets/img/rin/ 图片，
// 手写文章与手放图片不会被覆盖或删除
//
// 可见性映射（与主站一致）：
//   listed=1 draft=0  公开文章  → 正常展示（首页/标签/RSS/归档）
//   listed=0 draft=0  unlisted  → front matter hidden:true + sitemap:false，首页/归档/RSS 不显，标签页可见
//   draft=1           私密      → 同上，并自动追加「深海幽域」标签（圣上 2026-08-23 定名）
//
// ★ 2026-11-04 图片本地化（甲方案）
//   主站正文里的图片地址可能是两种形态之一：
//     /api/blob/images/<sha1>.webp                       （主站改为相对路径后的新文章）
//     https://aunger.eu.org/api/blob/images/<sha1>.webp  （历史文章 / 旧行为）
//   两者都会被抓到、从 R2 源站直取（走 CF API，不经过站点前端，不会被 CF 挑战拦）、
//   统一转 webp、落到 assets/img/rin/，正文改写为根相对路径 /assets/img/rin/<name>。
//
// ★ 域名解耦（圣上 2026-11-04 追加要求）
//   1. 正文图片一律写「根相对路径」，与域名完全无关 —— 换域名、换 HTTP/HTTPS 都不失效；
//   2. 主站域名不写死在本文件里，取自 _config.yml 的 rin.main_url（可用 RIN_MAIN_SITE 覆盖）；
//   3. 若将来把站点挂到子路径，_config.yml 里填 baseurl 即可，图片前缀会自动跟随（无需改代码）。
//
//   增长控制：只收「当前正文/动态里实际引用」的图，未被引用的一律删除；已有文件不重复下载。

import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync, mkdirSync, statSync, copyFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const POSTS_DIR = join(process.cwd(), '_posts');
const DATA_DIR = join(process.cwd(), '_data');
const MOMENTS_FILE = join(DATA_DIR, 'rin-moments.json');
const IMG_DIR = join(process.cwd(), 'assets', 'img', 'rin');
const MARKER = '<!-- rin-sync-managed -->';
const PRIVATE_TAG = '深海幽域'; // 私密文章自动标签名（圣上 2026-08-23 定名）
const CF_BASE = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.D1_DATABASE_ID}/query`;
const R2_BUCKET = process.env.R2_BUCKET_NAME || '';

// ---------- 站点配置（不写死域名） ----------

/** 从 _config.yml 读一个标量配置；读不到返回 ''。只用空格/制表符缩进，避免跨行误匹配 */
function readConfigValue(key) {
    try {
        const yml = readFileSync(join(process.cwd(), '_config.yml'), 'utf8');
        const m = yml.match(new RegExp(`^[ \\t]*${key}:[ \\t]*["']?([^"'\\n#]+)`, 'm'));
        return m ? m[1].trim() : '';
    } catch {
        return '';
    }
}

const MAIN_SITE = (process.env.RIN_MAIN_SITE || readConfigValue('main_url') || 'https://aunger.eu.org')
    .trim()
    .replace(/\/+$/, '');
// 本站子路径（GitHub Pages 自定义域根部署时为空）。只从 _config.yml 读，不用环境变量，
// 避免 shell 把 "/sub" 改写成别的路径。填了 baseurl 后图片前缀会自动变成 /子路径/assets/img/rin/。
const SITE_BASEURL = readConfigValue('baseurl').replace(/\/+$/, '');
const LOCAL_IMG_PREFIX = `${SITE_BASEURL}/assets/img/rin/`;

// 匹配 /api/blob/<key>，前面允许有任意站点前缀（含主站绝对地址）
const BLOB_RE = /(?:https?:\/\/[^\s)"'<>]+)?\/api\/blob\/([A-Za-z0-9._~%\-\/]+)/g;
// 需要转 webp 的栅格格式；gif 单独处理（要保住动图）
const RASTER_TO_WEBP = new Set(['jpg', 'jpeg', 'png']);
const WEBP_QUALITY = 82;
// 本地图片命名白名单（清理时只动这类文件）
const LOCAL_NAME_RE = /^[A-Za-z0-9._-]+\.(webp|jpg|jpeg|png|gif|avif|svg)$/i;

async function d1Query(sql) {
    const res = await fetch(CF_BASE, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.CF_API_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql }),
    });
    const data = await res.json();
    if (!data.success) {
        throw new Error(`D1 query failed: ${JSON.stringify(data.errors)}`);
    }
    return data.result[0].results;
}

function slugify(text) {
    const slug = String(text)
        .trim()
        .toLowerCase()
        .replace(/['"!?，。：:；;、（）()\[\]{}]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9\u4e00-\u9fff-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return slug || 'untitled';
}

function toDateObj(unixSeconds) {
    // D1 存 unix 秒时间戳，转为东八区展示
    const bj = new Date(Number(unixSeconds) * 1000 + 8 * 3600 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return {
        file: `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())}`,
        front: `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())} ${pad(bj.getUTCHours())}:${pad(bj.getUTCMinutes())}:${pad(bj.getUTCSeconds())} +0800`,
    };
}

function yamlQuote(text) {
    return `"${String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** 判断一个站内路径是否属于「本地化过的资源」，这类路径必须保持相对、绝不能被补成主站域名 */
function isLocalAsset(path) {
    return path.startsWith(LOCAL_IMG_PREFIX) || path.startsWith('/assets/');
}

// 主站内容里其余相对资源路径（非图片本地化的部分）补全为主站绝对 URL
// ★ 必须放过 /assets/：那是本站本地图片，补成主站域名就 404 了
function absolutizeUrls(content) {
    return String(content)
        .replace(/\]\((\/(?!\/)[^)][^)]*)\)/g, (m, p) => (isLocalAsset(p) ? m : `](${MAIN_SITE}${p})`))
        .replace(/src="(\/(?!\/)[^"]*)"/g, (m, p) => (isLocalAsset(p) ? m : `src="${MAIN_SITE}${p}"`))
        .replace(/href="(\/(?!\/)[^"]*)"/g, (m, p) => (isLocalAsset(p) ? m : `href="${MAIN_SITE}${p}"`));
}

// ---------- 图片本地化 ----------

/** 从一段内容里收集所有 /api/blob/<key> 的 key */
function collectBlobKeys(content, into) {
    if (!content) return into;
    for (const m of String(content).matchAll(BLOB_RE)) {
        const key = decodeURIComponent(m[1]);
        if (key) into.add(key);
    }
    return into;
}

function extOf(key) {
    const m = String(key).match(/\.([A-Za-z0-9]+)$/);
    return m ? m[1].toLowerCase() : '';
}

/** key → 扁平化文件名主干（不含扩展名），保证只含安全字符 */
function localBase(key) {
    return String(key)
        .replace(/[^A-Za-z0-9._-]/g, '_')
        .replace(/\.[A-Za-z0-9]+$/, '')
        .replace(/^_+|_+$/g, '') || 'img';
}

let sharpMod = null;
async function getSharp() {
    if (sharpMod !== null) return sharpMod;
    try {
        sharpMod = (await import('sharp')).default;
    } catch {
        if (process.env.RIN_REQUIRE_WEBP === '1') {
            throw new Error('已要求统一转 webp（RIN_REQUIRE_WEBP=1），但 sharp 未安装；请先 npm install --no-save sharp');
        }
        console.warn('[img] sharp 未安装，图片按原格式落盘（体积不受控，建议在流水线里 npm i sharp）');
        sharpMod = false;
    }
    return sharpMod;
}

/** 从 R2 源站直取对象（走 CF API，不经过站点前端，不会被 CF 挑战拦住） */
async function fetchR2(key) {
    const encoded = String(key).split('/').map(encodeURIComponent).join('/');
    const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/r2/buckets/${encodeURIComponent(R2_BUCKET)}/objects/${encoded}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}` } });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`R2 HTTP ${res.status} ${body.slice(0, 100)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) throw new Error('R2 返回空对象');
    // 防呆：万一取回的是错误页 HTML，宁可报失败也不要把它当图片存进仓库
    const head = buf.subarray(0, 64).toString('latin1').toLowerCase();
    if (head.includes('<!doctype html') || head.includes('<html')) throw new Error('R2 返回 HTML 而非图片');
    return buf;
}

/** 下载 + 转 webp；成功返回本地文件名，失败返回 null（调用方保留原地址，宁可跨站也不裂图） */
async function materializeImage(key, stats) {
    const ext = extOf(key);
    const base = localBase(key);
    const rawName = ext ? `${base}.${ext}` : base;

    const sharp = await getSharp(); // RIN_REQUIRE_WEBP 下缺 sharp 会抛出，直接中断整个同步
    const wantWebp = Boolean(sharp) && (RASTER_TO_WEBP.has(ext) || ext === 'gif');
    const wantName = wantWebp ? `${base}.webp` : rawName;

    // 已存在同名且非空的成品 → 直接复用（内容哈希命名，天然去重）
    const existing = join(IMG_DIR, wantName);
    if (existsSync(existing) && statSync(existing).size > 0) {
        stats.cached++;
        stats.bytesOut += statSync(existing).size;
        return wantName;
    }
    const fallbackExisting = join(IMG_DIR, rawName);
    if (!wantWebp && existsSync(fallbackExisting) && statSync(fallbackExisting).size > 0) {
        stats.cached++;
        stats.bytesOut += statSync(fallbackExisting).size;
        return rawName;
    }

    if (!R2_BUCKET) {
        console.warn(`[img] 未设 R2_BUCKET_NAME，跳过下载：${key}`);
        stats.failed++;
        return null;
    }

    let buf;
    try {
        buf = await fetchR2(key);
    } catch (e) {
        console.warn(`[img] 下载失败 ${key}: ${String(e.message || e).slice(0, 120)}`);
        stats.failed++;
        return null;
    }
    stats.bytesIn += buf.length;

    if (wantWebp) {
        const dest = join(IMG_DIR, `${base}.webp`);
        // 先编到系统临时目录：转码结果若不划算/不合格，直接丢弃，绝不污染 assets/img/rin
        const tmpOut = join(tmpdir(), `rin-webp-${process.pid}-${Date.now()}-${base}.webp`);
        try {
            const isGif = ext === 'gif';
            const src = sharp(buf, isGif ? { animated: true } : undefined);
            if (!isGif) src.rotate();
            await src.webp({ quality: WEBP_QUALITY, effort: 4 }).toFile(tmpOut);
            if (isGif) {
                // 动图必须还是动图：帧数对不上说明退化成静图了，宁可存原 gif 也不接受
                const inMeta = await sharp(buf, { animated: true }).metadata();
                const outMeta = await sharp(tmpOut, { animated: true }).metadata();
                if ((outMeta.pages || 1) < (inMeta.pages || 1)) {
                    throw new Error(`动图帧数丢失 ${inMeta.pages}→${outMeta.pages}`);
                }
            }
            const outSize = statSync(tmpOut).size;
            if (outSize >= buf.length) {
                // 小图/已高度压缩的图转 webp 反而变大，属于负优化，保留原格式
                console.warn(`[img] webp 反而更大（${fmtKB(buf.length)} → ${fmtKB(outSize)}），保留原格式：${key}`);
            } else {
                copyFileSync(tmpOut, dest);
                stats.converted++;
                stats.bytesOut += outSize;
                return `${base}.webp`;
            }
        } catch (e) {
            console.warn(`[img] 转 webp 失败，改用原格式 ${key}: ${String(e.message || e).slice(0, 100)}`);
        } finally {
            try { if (existsSync(tmpOut)) unlinkSync(tmpOut); } catch { /* 系统临时目录，残留无害 */ }
        }
    }

    // 原格式落盘（webp/avif/svg 或不支持转码时）
    try {
        writeFileSync(join(IMG_DIR, rawName), buf);
        stats.copied++;
        stats.bytesOut += buf.length;
        return rawName;
    } catch (e) {
        console.warn(`[img] 写入失败 ${key}: ${String(e.message || e).slice(0, 100)}`);
        stats.failed++;
        return null;
    }
}

/** 把内容里的 /api/blob/<key> 全部替换成本地根相对路径；下载失败的保持原样（后面会被补成主站绝对地址） */
function rewriteBlobRefs(content, nameByKey) {
    return String(content).replace(BLOB_RE, (full, rawKey) => {
        const key = decodeURIComponent(rawKey);
        const local = nameByKey.get(key);
        return local ? LOCAL_IMG_PREFIX + local : full;
    });
}

/** 清理 assets/img/rin 下不再被引用的图片 */
function pruneImages(usedNames) {
    if (!existsSync(IMG_DIR)) return 0;
    let removed = 0;
    for (const f of readdirSync(IMG_DIR)) {
        if (!LOCAL_NAME_RE.test(f)) continue;
        if (usedNames.has(f)) continue;
        try {
            unlinkSync(join(IMG_DIR, f));
            removed++;
        } catch { /* 忽略 */ }
    }
    return removed;
}

function fmtMB(bytes) {
    return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

function fmtKB(bytes) {
    return `${(bytes / 1024).toFixed(1)}KB`;
}

async function main() {
    for (const key of ['CF_API_TOKEN', 'CF_ACCOUNT_ID', 'D1_DATABASE_ID']) {
        if (!process.env[key]) {
            throw new Error(`Missing env: ${key}`);
        }
    }
    console.log(`[cfg] 主站域名 ${MAIN_SITE}　图片前缀 ${LOCAL_IMG_PREFIX}　R2 ${R2_BUCKET || '(未设置)'}`);

    // 拉全量文章（公开 + unlisted + 私密），可见性由 front matter 控制
    const posts = await d1Query(
        'SELECT id, alias, title, summary, content, listed, draft, created_at FROM feeds'
    );
    const tags = await d1Query(
        'SELECT fh.feed_id AS feedId, h.name AS name FROM feed_hashtags fh JOIN hashtags h ON fh.hashtag_id = h.id'
    );
    // 动态 moments（主站无权限过滤，全量公开）
    const moments = await d1Query(
        'SELECT id, content, created_at FROM moments ORDER BY created_at DESC'
    );

    const tagsByPost = new Map();
    for (const t of tags) {
        if (!tagsByPost.has(t.feedId)) tagsByPost.set(t.feedId, []);
        tagsByPost.get(t.feedId).push(t.name);
    }

    // ---- 第一步：先摸清所有被引用的图片，统一下载（先图后文，正文改写才有映射）----
    const allKeys = new Set();
    for (const p of posts) collectBlobKeys(p.content, allKeys);
    for (const m of moments) collectBlobKeys(m.content, allKeys);

    mkdirSync(IMG_DIR, { recursive: true });
    // 占位文件：保证 assets/img/rin/ 在「一篇带图文章都没有」时也非空，
    // 否则 workflow 里 git add assets/img/rin/ 会因目录为空而报 pathspec 错误
    const keeper = join(IMG_DIR, '.gitkeep');
    if (!existsSync(keeper)) writeFileSync(keeper, '');
    const nameByKey = new Map();
    const stats = { converted: 0, copied: 0, cached: 0, failed: 0, bytesIn: 0, bytesOut: 0 };
    if (allKeys.size) {
        console.log(`[img] 正文引用图片 ${allKeys.size} 张，开始本地化…`);
        const CONCURRENCY = 4;
        const keyList = [...allKeys];
        let cursor = 0;
        await Promise.all(
            Array.from({ length: Math.min(CONCURRENCY, keyList.length) }, async () => {
                while (cursor < keyList.length) {
                    const key = keyList[cursor++];
                    const name = await materializeImage(key, stats);
                    if (name) nameByKey.set(key, name);
                }
            })
        );
        console.log(
            `[img] 转 webp ${stats.converted} / 原样 ${stats.copied} / 复用 ${stats.cached} / 失败 ${stats.failed}` +
            `　本轮下载 ${fmtMB(stats.bytesIn)} → 落盘 ${fmtMB(stats.bytesOut)}`
        );
        if (stats.failed) {
            console.warn(`[img] 有 ${stats.failed} 张未能本地化，正文保留主站绝对地址（会跨站，需复查日志）`);
        }
    } else {
        console.log('[img] 正文没有引用任何图片');
    }

    // 清掉旧的同源生成文件（仅限带标记的）
    if (existsSync(POSTS_DIR)) {
        for (const f of readdirSync(POSTS_DIR)) {
            const p = join(POSTS_DIR, f);
            if (f.endsWith('.md') && readFileSync(p, 'utf8').includes(MARKER)) {
                try {
                    unlinkSync(p);
                    console.log(`removed stale: ${f}`);
                } catch (e) {
                    console.log(`remove stale attempted: ${f} (${e.message?.slice(0, 60)})`);
                }
            }
        }
    } else {
        mkdirSync(POSTS_DIR, { recursive: true });
    }

    let count = 0;
    let hiddenCount = 0;
    for (const post of posts) {
        const date = toDateObj(post.created_at);
        const slug = post.alias ? slugify(post.alias) : slugify(post.title);
        const name = `${date.file}-${slug}.md`;
        const listed = Number(post.listed) === 1;
        const draft = Number(post.draft) === 1;
        const hidden = !(listed && !draft); // 非「公开」一律降曝光

        const tagList = tagsByPost.get(post.id) || [];
        if (draft) tagList.push(PRIVATE_TAG);

        const fm = [
            '---',
            'layout: post',
            `title: ${yamlQuote(post.title)}`,
            `date: ${date.front}`,
            tagList.length ? `tags: [${tagList.map(yamlQuote).join(', ')}]` : 'tags: []',
            `canonical: ${MAIN_SITE}/feed/${post.alias || post.id}`,
        ];
        if (hidden) {
            fm.push('hidden: true', 'sitemap: false');
        }
        fm.push('---', '', MARKER, '');

        // ★ 先本地化图片，再补全其余相对链接
        const localized = rewriteBlobRefs(String(post.content).trim(), nameByKey);

        writeFileSync(
            join(POSTS_DIR, name),
            fm.join('\n') + absolutizeUrls(localized) + '\n',
            'utf8'
        );
        console.log(`generated: ${name}${hidden ? ' (hidden)' : ''}`);
        count++;
        if (hidden) hiddenCount++;
    }

    // 动态 → _data/rin-moments.json
    mkdirSync(DATA_DIR, { recursive: true });
    const momentsData = moments.map((m) => ({
        id: m.id,
        created_at: Number(m.created_at),
        content: absolutizeUrls(rewriteBlobRefs(String(m.content), nameByKey)),
    }));
    writeFileSync(MOMENTS_FILE, JSON.stringify(momentsData, null, 2) + '\n', 'utf8');
    console.log(`moments: ${momentsData.length} entries -> _data/rin-moments.json`);

    // 清理未被引用的旧图（只动 assets/img/rin 下符合命名规则的文件）
    const pruned = pruneImages(new Set(nameByKey.values()));
    if (pruned) console.log(`[img] 清理未引用图片 ${pruned} 张`);

    console.log(`done: ${count} posts (${hiddenCount} hidden), ${momentsData.length} moments, ${nameByKey.size} images`);
}

main().catch((e) => { console.error(e); process.exit(1); });
