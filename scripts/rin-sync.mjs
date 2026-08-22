// Rin 主站 D1 → Jekyll 备份站文章同步脚本
// 用法: node scripts/rin-sync.mjs
// 环境变量: CF_API_TOKEN / CF_ACCOUNT_ID / D1_DATABASE_ID
// 只管理带 rin-sync-managed 标记的 _posts 文件，手写文章不会被覆盖或删除

import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const POSTS_DIR = join(process.cwd(), '_posts');
const MARKER = '<!-- rin-sync-managed -->';
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

async function main() {
    for (const key of ['CF_API_TOKEN', 'CF_ACCOUNT_ID', 'D1_DATABASE_ID']) {
        if (!process.env[key]) {
            throw new Error(`Missing env: ${key}`);
        }
    }

    // 只取公开文章（过滤草稿与未列出/私密）
    const posts = await d1Query(
        'SELECT id, alias, title, summary, content, created_at FROM feeds WHERE draft = 0 AND listed = 1'
    );
    const tags = await d1Query(
        'SELECT fh.feed_id AS feedId, h.name AS name FROM feed_hashtags fh JOIN hashtags h ON fh.hashtag_id = h.id'
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
    for (const post of posts) {
        const date = toDateObj(post.created_at);
        const slug = post.alias ? slugify(post.alias) : slugify(post.title);
        const name = `${date.file}-${slug}.md`;
        const tagList = tagsByPost.get(post.id) || [];
        const fm = [
            '---',
            'layout: post',
            `title: ${yamlQuote(post.title)}`,
            `date: ${date.front}`,
            tagList.length ? `tags: [${tagList.map(yamlQuote).join(', ')}]` : 'tags: []',
            `canonical: https://aunger.eu.org/feed/${post.alias || post.id}`,
            '---',
            '',
            MARKER,
            '',
        ].join('\n');
        writeFileSync(join(POSTS_DIR, name), fm + String(post.content).trim() + '\n', 'utf8');
        console.log(`generated: ${name}`);
        count++;
    }
    console.log(`done: ${count} posts`);
}

main().catch((e) => { console.error(e); process.exit(1); });
