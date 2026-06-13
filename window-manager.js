/* ═══════════════════════════════════════════════════════
   AI Nav Window Manager — Vanilla JS 桌面窗口管理
   参考: fnOS 飞牛 Task/Window 状态模型
   无依赖, 纯原生 JS
   ═══════════════════════════════════════════════════════ */
(function() {
  'use strict';

  var WIN = window.WindowManager = {};
  var _windows = [];           // 窗口状态数组
  var _nextId = 1;            // 自增 ID
  var _nextZ = 10;            // 自增 z-index 基数
  var _ACTIVE_Z = 10000;      // 活跃窗口 z-index 加成
  var _allMinimized = false;  // 全局最小化状态

  var _isDragging = false, _isResizing = false;
  var _dragWin = null, _dragStartX, _dragStartY, _dragWinX, _dragWinY;
  var _resizeWin = null, _resizeDir = '', _resizeStartX, _resizeStartY, _resizeStartW, _resizeStartH, _resizeStartLX, _resizeStartLY;

  var MIN_W = 320, MIN_H = 240;

  /* ── 内部: 创建窗口 DOM ── */
  function _createDOM(win) {
    var el = document.createElement('div');
    el.className = 'window inactive';
    el.setAttribute('data-window-id', win.id);
    el.style.left = win.x + 'px';
    el.style.top = win.y + 'px';
    el.style.width = win.w + 'px';
    el.style.height = win.h + 'px';
    el.style.zIndex = win.zIndex;
    el.innerHTML =
      '<div class="window-titlebar" data-win-action="drag-start">' +
        '<span class="window-icon">' + win.icon + '</span>' +
        '<span class="window-title">' + _esc(win.title) + '</span>' +
        '<div class="window-ctrls">' +
          '<button class="win-min" data-win-action="minimize" title="最小化">─</button>' +
          '<button class="win-max" data-win-action="maximize" title="最大化">□</button>' +
          '<button class="win-close" data-win-action="close" title="关闭">✕</button>' +
        '</div>' +
      '</div>' +
      '<div class="window-body" id="window-body-' + win.contentId + '"></div>' +
      // 8 resize handles
      '<div class="win-resize-n" data-win-action="resize-start" data-resize-dir="n"></div>' +
      '<div class="win-resize-s" data-win-action="resize-start" data-resize-dir="s"></div>' +
      '<div class="win-resize-e" data-win-action="resize-start" data-resize-dir="e"></div>' +
      '<div class="win-resize-w" data-win-action="resize-start" data-resize-dir="w"></div>' +
      '<div class="win-resize-ne" data-win-action="resize-start" data-resize-dir="ne"></div>' +
      '<div class="win-resize-nw" data-win-action="resize-start" data-resize-dir="nw"></div>' +
      '<div class="win-resize-se" data-win-action="resize-start" data-resize-dir="se"></div>' +
      '<div class="win-resize-sw" data-win-action="resize-start" data-resize-dir="sw"></div>';
    return el;
  }

  function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* ── 内部: 更新 DOM 位置/尺寸 ── */
  function _updateDOM(win) {
    var el = win.el;
    if (!el) return;
    el.style.left = win.x + 'px';
    el.style.top = win.y + 'px';
    el.style.width = win.w + 'px';
    el.style.height = win.h + 'px';
    el.style.zIndex = win.zIndex;
    el.className = 'window' +
      (win.activated ? ' active' : ' inactive') +
      (win.maximized ? ' maximized' : '') +
      (win.minimized ? ' minimizing' : '');
  }

  /* ── 内部: 找到最高 z-index 的非最小化窗口 ── */
  function _findTop() {
    var top = null;
    for (var i = 0; i < _windows.length; i++) {
      var w = _windows[i];
      if (w.minimized) continue;
      if (!top || w.zIndex > top.zIndex) top = w;
    }
    return top;
  }

  /* ── 内部: 去激活所有窗口 ── */
  function _deactivateAll() {
    for (var i = 0; i < _windows.length; i++) {
      _windows[i].activated = false;
      _updateDOM(_windows[i]);
    }
  }

  /* ═══ 公共 API ═══ */

  /** 打开 (或恢复) 一个窗口
   *  @param contentId - 唯一标识, 如 'overview', 'papers', 'tools'
   *  @param title     - 窗口标题
   *  @param icon      - emoji 图标
   *  @param contentFn - function(el) 把内容渲染到窗口 body 中
   *  @param opts      - { x, y, w, h } 可选初始位置/尺寸
   */
  WIN.open = function(contentId, title, icon, contentFn, opts) {
    opts = opts || {};
    // 如果已存在, 恢复并聚焦
    var existing = WIN.get(contentId);
    if (existing) {
      if (existing.minimized) {
        existing.minimized = false;
        existing.activated = true;
        _deactivateAll();
        existing.activated = true;
        existing.zIndex = _ACTIVE_Z + (_nextZ++);
        _allMinimized = false;
      }
      WIN.focus(contentId);
      _updateDOM(existing);
      _updateTaskbar();
      return existing;
    }

    // 计算默认位置 (层叠偏移)
    var count = _windows.length;
    var defX = 60 + (count % 4) * 40;
    var defY = 50 + (count % 4) * 30;
    var defW = Math.min(720, window.innerWidth - 40);
    var defH = Math.min(480, window.innerHeight - 130);

    var win = {
      id: _nextId++,
      contentId: contentId,
      title: title,
      icon: icon,
      x: opts.x || defX, y: opts.y || defY,
      w: opts.w || defW, h: opts.h || defH,
      zIndex: _ACTIVE_Z + (_nextZ++),
      activated: true,
      minimized: false,
      maximized: false,
      el: null
    };

    // 去激活其他窗口
    _deactivateAll();

    // 创建 DOM
    var el = _createDOM(win);
    win.el = el;
    document.body.appendChild(el);

    // 执行内容渲染
    if (contentFn) {
      var body = el.querySelector('.window-body');
      contentFn(body);
    }

    // 移动端全屏
    if (window.innerWidth <= 800) {
      win.maximized = true;
      _updateDOM(win);
    }

    _windows.push(win);
    _updateTaskbar();

    // 显示桌面时打开窗口: 取消全局最小化
    if (_allMinimized) {
      _allMinimized = false;
      // 恢复其他窗口
      for (var i = 0; i < _windows.length; i++) {
        if (_windows[i].id !== win.id && _windows[i].minimized) {
          _windows[i].minimized = false;
          _windows[i].activated = false;
          _updateDOM(_windows[i]);
        }
      }
    }

    return win;
  };

  /** 聚焦窗口 (提升到最前) */
  WIN.focus = function(contentId) {
    var win = WIN.get(contentId);
    if (!win) return;
    if (win.minimized) {
      win.minimized = false;
    }
    if (!win.activated) {
      _deactivateAll();
      win.activated = true;
      win.zIndex = _ACTIVE_Z + (_nextZ++);
    }
    _updateDOM(win);
    _updateTaskbar();
  };

  /** 最小化窗口 */
  WIN.minimize = function(contentId) {
    var win = WIN.get(contentId);
    if (!win) return;
    win.minimized = true;
    win.activated = false;
    _updateDOM(win);
    // 聚焦下一个窗口
    var top = _findTop();
    if (top) {
      _deactivateAll();
      top.activated = true;
      top.zIndex = _ACTIVE_Z + (_nextZ++);
      _updateDOM(top);
    }
    _updateTaskbar();
  };

  /** 最大化/恢复窗口 */
  WIN.maximize = function(contentId) {
    var win = WIN.get(contentId);
    if (!win) return;
    if (win.maximized) {
      // 恢复
      win.maximized = false;
      win.x = win._prevX || 60;
      win.y = win._prevY || 50;
      win.w = win._prevW || 680;
      win.h = win._prevH || 460;
    } else {
      // 保存当前状态
      win._prevX = win.x; win._prevY = win.y;
      win._prevW = win.w; win._prevH = win.h;
      win.maximized = true;
    }
    if (!win.activated) {
      _deactivateAll();
      win.activated = true;
      win.zIndex = _ACTIVE_Z + (_nextZ++);
    }
    _updateDOM(win);
  };

  /** 关闭窗口 */
  WIN.close = function(contentId) {
    var win = WIN.get(contentId);
    if (!win) return;
    if (win.el && win.el.parentNode) {
      win.el.parentNode.removeChild(win.el);
    }
    _windows = _windows.filter(function(w) { return w.id !== win.id; });
    // 聚焦下一个
    var top = _findTop();
    if (top) {
      _deactivateAll();
      top.activated = true;
      top.zIndex = _ACTIVE_Z + (_nextZ++);
      _updateDOM(top);
    }
    _updateTaskbar();
  };

  /** 全部最小化 (显示桌面) */
  WIN.minimizeAll = function() {
    if (_allMinimized) {
      // 取消全部最小化
      _allMinimized = false;
      var top = _findTop();
      // 恢复所有
      for (var i = 0; i < _windows.length; i++) {
        _windows[i].minimized = false;
        _windows[i].activated = false;
        _updateDOM(_windows[i]);
      }
      if (top) {
        top.activated = true;
        top.zIndex = _ACTIVE_Z + (_nextZ++);
        _updateDOM(top);
      }
    } else {
      _allMinimized = true;
      for (var i = 0; i < _windows.length; i++) {
        _windows[i].minimized = true;
        _windows[i].activated = false;
        _updateDOM(_windows[i]);
      }
    }
    _updateTaskbar();
  };

  /** 获取窗口对象 */
  WIN.get = function(contentId) {
    for (var i = 0; i < _windows.length; i++) {
      if (_windows[i].contentId === contentId) return _windows[i];
    }
    return null;
  };

  /** 获取所有窗口 */
  WIN.list = function() { return _windows.slice(); };

  /** 获取窗口 DOM */
  WIN.getDOM = function(contentId) {
    var win = WIN.get(contentId);
    return win ? win.el : null;
  };

  /* ═══ 任务栏更新 ═══ */
  function _updateTaskbar() {
    var center = document.querySelector('.taskbar-center');
    if (!center) return;
    center.innerHTML = '';
    for (var i = 0; i < _windows.length; i++) {
      var w = _windows[i];
      if (w.minimized && _allMinimized) continue; // 全局最小化时不显示
      var btn = document.createElement('button');
      btn.className = 'tb-window-btn' + (w.activated && !w.minimized ? ' active' : '');
      btn.title = w.title + (w.minimized ? ' (已最小化)' : '');
      btn.textContent = w.icon;
      btn.setAttribute('data-win-target', w.contentId);
      btn.addEventListener('click', function(targetId) {
        return function() {
          var tw = WIN.get(targetId);
          if (tw && tw.minimized) {
            tw.minimized = false;
            _allMinimized = false;
            WIN.focus(targetId);
          } else if (tw && tw.activated) {
            WIN.minimize(targetId);
          } else {
            WIN.focus(targetId);
          }
        };
      }(w.contentId));
      center.appendChild(btn);
    }
  }

  /* ═══ 全局事件: 拖拽 + 缩放 + 点击聚焦 ═══ */
  document.addEventListener('mousedown', function(e) {
    // 查找最近的 [data-win-action] 元素
    var actionEl = e.target.closest('[data-win-action]');
    if (!actionEl) {
      // 点击在窗口外 → 不做处理 (用户可以点击桌面图标)
      return;
    }

    var action = actionEl.getAttribute('data-win-action');
    var winEl = actionEl.closest('.window');
    if (!winEl) return;
    var winId = parseInt(winEl.getAttribute('data-window-id'));
    var win = null;
    for (var i = 0; i < _windows.length; i++) {
      if (_windows[i].id === winId) { win = _windows[i]; break; }
    }
    if (!win) return;

    // 先聚焦
    if (!win.activated) {
      WIN.focus(win.contentId);
    }

    if (action === 'minimize') {
      e.preventDefault(); e.stopPropagation();
      WIN.minimize(win.contentId);
      return;
    }
    if (action === 'maximize') {
      e.preventDefault(); e.stopPropagation();
      WIN.maximize(win.contentId);
      return;
    }
    if (action === 'close') {
      e.preventDefault(); e.stopPropagation();
      WIN.close(win.contentId);
      return;
    }

    // 拖拽 (桌面端)
    if (action === 'drag-start' && window.innerWidth > 800 && !win.maximized) {
      e.preventDefault();
      _isDragging = true;
      _dragWin = win;
      _dragStartX = e.clientX;
      _dragStartY = e.clientY;
      _dragWinX = win.x;
      _dragWinY = win.y;
    }

    // 缩放 (桌面端)
    if (action === 'resize-start' && window.innerWidth > 800 && !win.maximized) {
      e.preventDefault(); e.stopPropagation();
      _isResizing = true;
      _resizeWin = win;
      _resizeDir = actionEl.getAttribute('data-resize-dir');
      _resizeStartX = e.clientX;
      _resizeStartY = e.clientY;
      _resizeStartW = win.w;
      _resizeStartH = win.h;
      _resizeStartLX = win.x;
      _resizeStartLY = win.y;
    }
  });

  document.addEventListener('mousemove', function(e) {
    if (_isDragging && _dragWin) {
      var dx = e.clientX - _dragStartX;
      var dy = e.clientY - _dragStartY;
      _dragWin.x = Math.max(-_dragWin.w + 80, Math.min(window.innerWidth - 80, _dragWinX + dx));
      _dragWin.y = Math.max(0, Math.min(window.innerHeight - 100, _dragWinY + dy));
      _updateDOM(_dragWin);
    }
    if (_isResizing && _resizeWin) {
      var dx = e.clientX - _resizeStartX;
      var dy = e.clientY - _resizeStartY;
      var rw = _resizeWin, d = _resizeDir;
      var newW = rw.w, newH = rw.h, newX = rw.x, newY = rw.y;

      if (d.indexOf('e') >= 0) newW = Math.max(MIN_W, _resizeStartW + dx);
      if (d.indexOf('w') >= 0) { newW = Math.max(MIN_W, _resizeStartW - dx); newX = _resizeStartLX + dx; }
      if (d.indexOf('s') >= 0) newH = Math.max(MIN_H, _resizeStartH + dy);
      if (d.indexOf('n') >= 0) { newH = Math.max(MIN_H, _resizeStartH - dy); newY = _resizeStartLY + dy; }

      rw.w = newW; rw.h = newH; rw.x = newX; rw.y = newY;
      _updateDOM(rw);
    }
  });

  document.addEventListener('mouseup', function() {
    _isDragging = false; _dragWin = null;
    _isResizing = false; _resizeWin = null;
  });

  /* ═══ 移动端触摸支持 ═══ */
  document.addEventListener('touchstart', function(e) {
    var actionEl = e.target.closest('[data-win-action]');
    if (!actionEl) return;
    var winEl = actionEl.closest('.window');
    if (!winEl) return;
    var winId = parseInt(winEl.getAttribute('data-window-id'));
    var win = null;
    for (var i = 0; i < _windows.length; i++) {
      if (_windows[i].id === winId) { win = _windows[i]; break; }
    }
    if (!win) return;

    if (!win.activated) WIN.focus(win.contentId);

    // 移动端仅在非最大化时允许拖拽
    if (actionEl.classList.contains('window-titlebar') && window.innerWidth <= 800 && !win.maximized) {
      _isDragging = true; _dragWin = win;
      var t = e.touches[0];
      _dragStartX = t.clientX; _dragStartY = t.clientY;
      _dragWinX = win.x; _dragWinY = win.y;
    }
  }, { passive: false });

  document.addEventListener('touchmove', function(e) {
    if (_isDragging && _dragWin) {
      var t = e.touches[0];
      var dx = t.clientX - _dragStartX;
      var dy = t.clientY - _dragStartY;
      _dragWin.x = Math.max(-_dragWin.w + 80, Math.min(window.innerWidth - 80, _dragWinX + dx));
      _dragWin.y = Math.max(0, Math.min(window.innerHeight - 100, _dragWinY + dy));
      _updateDOM(_dragWin);
    }
  }, { passive: false });

  document.addEventListener('touchend', function() {
    _isDragging = false; _dragWin = null;
  });

  /* ═══ 响应式: 窗口尺寸跟随 ═══ */
  window.addEventListener('resize', function() {
    var isMobile = window.innerWidth <= 800;
    for (var i = 0; i < _windows.length; i++) {
      var w = _windows[i];
      if (isMobile) {
        w.maximized = true;
      }
      // 确保窗口不完全在屏幕外
      if (w.x + w.w > window.innerWidth + 20) w.x = Math.max(0, window.innerWidth - w.w - 20);
      if (w.y + w.h > window.innerHeight) w.y = Math.max(0, window.innerHeight - w.h - 80);
      _updateDOM(w);
    }
  });

  /* ═══ 键盘快捷键 ═══ */
  document.addEventListener('keydown', function(e) {
    // Cmd+K 或 Ctrl+K → 启动器
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      var launcher = document.querySelector('.launcher-overlay');
      if (launcher) {
        launcher.classList.toggle('show');
        var input = launcher.querySelector('input');
        if (input && launcher.classList.contains('show')) {
          input.focus(); input.select();
        }
      }
    }
    // Escape → 关闭启动器 或 关闭活跃窗口
    if (e.key === 'Escape') {
      var launcher = document.querySelector('.launcher-overlay');
      if (launcher && launcher.classList.contains('show')) {
        launcher.classList.remove('show');
        return;
      }
    }
  });

  /* ═══ 启动器搜索 ═══ */
  WIN.initLauncher = function(items) {
    var input = document.querySelector('.launcher-search input');
    var results = document.querySelector('.launcher-results');
    if (!input || !results) return;

    function render(filtered) {
      results.innerHTML = '';
      for (var i = 0; i < filtered.length; i++) {
        var item = filtered[i];
        var div = document.createElement('div');
        div.className = 'launcher-item';
        div.innerHTML = '<span class="launcher-icon">' + item.icon + '</span>' + _esc(item.title);
        div.addEventListener('click', function(it) {
          return function() {
            var lo = document.querySelector('.launcher-overlay');
            if (lo) lo.classList.remove('show');
            input.value = '';
            results.innerHTML = '';
            if (it.action) it.action();
          };
        }(item));
        results.appendChild(div);
      }
    }

    render(items);

    input.addEventListener('input', function() {
      var q = input.value.toLowerCase().trim();
      if (!q) { render(items); return; }
      var filtered = items.filter(function(item) {
        return item.title.toLowerCase().indexOf(q) >= 0 ||
               (item.keywords || '').toLowerCase().indexOf(q) >= 0;
      });
      render(filtered);
    });

    // 点击覆盖层关闭
    var overlay = document.querySelector('.launcher-overlay');
    if (overlay) {
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.classList.remove('show');
      });
    }
  };

  /* ═══ 初始化 ═══ */
  console.log('[WindowManager] ready — open/focus/minimize/maximize/close/drag/resize');
})();
