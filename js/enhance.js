/* 主题切换、代码一键复制、图片灯箱、懒加载、外链新窗口 */
(function() {
  'use strict';

  // ============================== 主题切换 ==============================
  var themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    var icon = themeBtn.querySelector('i');
    var syncIcon = function() {
      if (document.documentElement.classList.contains('theme-dark')) {
        icon.className = 'fa fa-sun-o';
        themeBtn.setAttribute('title', '切换到浅色模式');
      } else {
        icon.className = 'fa fa-moon-o';
        themeBtn.setAttribute('title', '切换到深色模式');
      }
    };
    syncIcon();
    themeBtn.addEventListener('click', function() {
      var isDark = document.documentElement.classList.toggle('theme-dark');
      try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch (e) {}
      syncIcon();
    });
  }

  // ============================== 代码块一键复制 ==============================
  var preList = document.querySelectorAll('.post pre, .post-container pre');
  preList.forEach(function(pre) {
    if (pre.parentNode.classList.contains('code-block-wrapper')) return;
    var wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(pre);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-code-btn';
    btn.textContent = '复制';
    wrapper.appendChild(btn);

    btn.addEventListener('click', function() {
      var code = pre.querySelector('code') || pre;
      var text = code.innerText;
      var done = function() {
        btn.textContent = '已复制';
        btn.classList.add('copied');
        setTimeout(function() {
          btn.textContent = '复制';
          btn.classList.remove('copied');
        }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function() { fallbackCopy(text, done); });
      } else {
        fallbackCopy(text, done);
      }
    });
  });

  function fallbackCopy(text, cb) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); cb(); } catch (e) {}
    document.body.removeChild(ta);
  }

  // ============================== 图片灯箱 ==============================
  var mask = document.getElementById('lightbox-mask');
  if (mask) {
    document.querySelectorAll('.post img, .post-container img').forEach(function(img) {
      img.addEventListener('click', function(e) {
        if (!img.getAttribute('src')) return;
        e.preventDefault();
        mask.innerHTML = '';
        var big = document.createElement('img');
        big.src = img.getAttribute('src');
        big.alt = img.alt || '';
        mask.appendChild(big);
        mask.classList.add('show');
        mask.setAttribute('aria-hidden', 'false');
      });
    });
    mask.addEventListener('click', function() {
      mask.classList.remove('show');
      mask.setAttribute('aria-hidden', 'true');
      mask.innerHTML = '';
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && mask.classList.contains('show')) mask.click();
    });
  }

  // ============================== 文章图片懒加载 ==============================
  document.querySelectorAll('.post img, .post-container img').forEach(function(img) {
    if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
    if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
  });

  // ============================== 外链自动新窗口 ==============================
  var host = location.hostname;
  document.querySelectorAll('.post a, .post-container a').forEach(function(a) {
    var href = a.getAttribute('href');
    if (!href) return;
    if (/^(https?:)?\/\//i.test(href) && a.hostname !== host) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  });
})();
