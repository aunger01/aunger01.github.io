// Rin 主站 D1 → Jekyll 备份站内容同步脚本（文章 + 动态）
// 用法: node scripts/rin-sync.mjs
// 环境变量: CF_API_TOKEN / CF_ACCOUNT_ID / D1_DATABASE_ID
// 只管理带 rin-sync-managed 标记的 _posts 文件与 _data/rin-moments.json，手写文章不会被覆盖或删除
//
// 可见性映射（与主站一致）：
//   listed=1 draft=0  公开文章  → 正常展示（首页/标签/RSS/归档）
//   listed=0 draft=0  unlisted  → front matter hidden:true + sitemap:false，首页/归档/RSS 不显，标签页可见
//   draft=1           私密      → 同上，并自动追加 private 标签（占位名，圣上定名后全局替换）

import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const POSTS_DIR = join(process.cwd(), '_posts');
const DATA_DIR = join(process.cwd(), '_data');
const MOMENTS_FILE = join(DATA_DIR, 'rin-moments.json');
const MARKER = '<!-- rin-sync-managed -->';
const MAIN_SITE = 'https://aunger.eu.org';
const PRIVATE_TAG = 'private'; // 占位：私密文章自动标签名，定名后全局替换
const CF_BASE = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/d1/database/${process.env.D1_DATABASE_ID}/query`;

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

// B6: 主站内容里的相对资源路径（/api/blob/... 图床等）补全为主站绝对 URL
function absolutizeUrls(content) {
    return String(content)
        .replace(/\]\((\/[^/)][^)]*)\)/g, `](${MAIN_SITE}$1)`)
        .replace(/src="(\/[^/][^"]*)"/g, `src="${MAIN_SITE}$1"`)
        .replace(/href="(\/[^/][^"]*)"/g, `href="${MAIN_SITE}$1"`);
}

async function main() {
    for (const key of ['CF_API_TOKEN', 'CF_ACCOUNT_ID', 'D1_DATABASE_ID']) {
        if (!process.env[key]) {
            throw new Error(`Missing env: ${key}`);
        }
    }

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

    // 清掉旧的同源生成文件（仅限带标记的）
    if (existsSync(POSTS_DIR)) {
        for (const f of readdirSync(POSTS_DIR)) {
            const p = join(POSTS_DIR, f);
            if (f.endsWith('.md') && readFileSync(p, 'utf8').includes(MARKER)) {
                try {
                    unlinkSync(p);
                    console.log(`removed stale: ${f}`);
                } catch (e) {
                    // 本机沙箱回收站 shim 可能报错但实际已删除，或删除失败交由下次运行重试
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
        const hidden = !(listed && !draft); // 非「公开」一律降曝光：首页/归档/RSS/sitemap 排除，标签页保留

        const tagList = tagsByPost.get(post.id) || [];
        if (draft) tagList.push(PRIVATE_TAG); // 私密文章打自定义标签

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

        writeFileSync(
            join(POSTS_DIR, name),
            fm.join('\n') + absolutizeUrls(String(post.content).trim()) + '\n',
            'utf8'
        );
        console.log(`generated: ${name}${hidden ? ' (hidden)' : ''}`);
        count++;
        if (hidden) hiddenCount++;
    }

    // 动态 → _data/rin-moments.json（整文件由脚本管理，每次全量重写）
    mkdirSync(DATA_DIR, { recursive: true });
    const momentsData = moments.map((m) => ({
        id: m.id,
        created_at: Number(m.created_at),
        content: absolutizeUrls(String(m.content)),
    }));
    writeFileSync(MOMENTS_FILE, JSON.stringify(momentsData, null, 2) + '\n', 'utf8');
    console.log(`moments: ${momentsData.length} entries -> _data/rin-moments.json`);

    console.log(`done: ${count} posts (${hiddenCount} hidden), ${momentsData.length} moments`);
}

main().catch((e) => { console.error(e); process.exit(1); });
