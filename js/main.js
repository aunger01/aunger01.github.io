/* 导航栏交互、阅读进度条、回到顶部 */
(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', function() {

    // ============================== 移动端汉堡菜单 ==============================
    var toggleBtn = document.getElementById('navbar-toggle');
    var nav = document.getElementById('navbar-nav');
    if (toggleBtn && nav) {
      toggleBtn.addEventListener('click', function() {
        var open = nav.classList.toggle('open');
        toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggleBtn.innerHTML = open ? '<i class="fa fa-times"></i>' : '<i class="fa fa-bars"></i>';
      });
    }

    // ============================== 当前页导航高亮 ==============================
    var path = location.pathname.replace(/\/index\.html$/, '/');
    document.querySelectorAll('.navbar-nav .nav-link').forEach(function(a) {
      var href = a.getAttribute('href');
      if (!href) return;
      var linkPath = href.replace(/\/index\.html$/, '/');
      if (linkPath === '/' ? path === '/' : path.indexOf(linkPath) === 0) {
        a.classList.add('active');
      }
    });

    // ============================== 阅读进度条 + 回到顶部 ==============================
    var progressBar = document.getElementById('reading-progress');
    var backToTop = document.getElementById('back-to-top');

    function onScroll() {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      if (progressBar) progressBar.style.width = progress + '%';
      if (backToTop) {
        if (scrollTop > 400) backToTop.classList.add('show');
        else backToTop.classList.remove('show');
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (backToTop) {
      backToTop.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return false;
      });
    }
  });
})();
