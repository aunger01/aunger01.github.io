# 安杰的个人博客

博客线上地址：<https://10000101.xyz>

基于 Jekyll + GitHub Pages 搭建的个人博客，记录技术笔记与实践心得。

## 本地预览

```bash
gem install jekyll bundler
bundle install
bundle exec jekyll server
```

浏览器打开 <http://127.0.0.1:4000> 即可预览。

## 写新文章

在 `_posts/` 目录下新建 `YYYY-MM-DD-文章标题.md` 文件，文件头部使用 front matter：

```markdown
---
layout: post
title: "文章标题"
date: 2026-08-22 12:00:00
tags: [技术]
---
正文内容（支持 Markdown）...
```

推送到 `master` 分支后 GitHub Pages 会自动构建发布。

## 致谢

本博客基于 [leopardpan](https://github.com/leopardpan/leopardpan.github.io) 的开源博客主题修改，感谢原作者的分享。
