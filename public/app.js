/**
 * Fruit Fresh Commerce Platform — Comprehensive Single Page Application
 * Covers Luồng 1, 2, 3, 4, 5 (Specialized Luồng 5: Trần Hữu Hưng)
 */

(() => {
  'use strict';

  // -------------------------------------------------------------
  // STATE MANAGEMENT
  // -------------------------------------------------------------
  const state = {
    user: null,
    token: sessionStorage.getItem('fruitToken') || localStorage.getItem('fruitToken') || null,
    currentView: 'products',
    categories: [],
    shops: [],
    products: [],
    cart: null,
    customerOrders: [],
    shopOrders: [],
    inventoryTransactions: [],
    inventoryAlerts: { outOfStock: [], nearExpiry: [] },
    shopProducts: [],
    shopCategories: [],
    shopStaff: [],
    currentShop: null,
    shopStats: { revenue: [], topProducts: [] },
    adminStats: null,
    adminRequests: [],
    adminShops: [],
    adminUsers: [],
    notifications: [],
    unreadCount: 0,
  };

  // Demo user credentials for 1-click test
  const DEMO_USERS = {
    admin: { email: 'admin@fruitfresh.vn', password: 'change_me', roleName: 'Admin' },
    owner: { email: 'mai.tran@fruitfresh.vn', password: 'change_me', roleName: 'Shop Owner' },
    inventory: { email: 'ha.pham@fruitfresh.vn', password: 'change_me', roleName: 'Nhân viên Kho (L5)' },
    order: { email: 'quan.do@fruitfresh.vn', password: 'change_me', roleName: 'Nhân viên Đơn (L5)' },
    customer: { email: 'minh.dao@fruitfresh.vn', password: 'change_me', roleName: 'Khách hàng' },
  };

  // -------------------------------------------------------------
  // UTILITIES & HELPERS
  // -------------------------------------------------------------
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  const escapeHtml = (val = '') =>
    String(val).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));

  const formatVND = (num) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(num) || 0);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  };

  function toast(message, type = 'success') {
    const container = $('#toast-container');
    if (!container) return;
    const item = document.createElement('div');
    item.className = `toast-notice toast-${type}`;
    item.textContent = message;
    container.appendChild(item);
    setTimeout(() => {
      item.style.opacity = '0';
      setTimeout(() => item.remove(), 300);
    }, 4000);
  }

  // -------------------------------------------------------------
  // API CLIENT
  // -------------------------------------------------------------
  async function api(endpoint, options = {}) {
    const url = endpoint.startsWith('/api') ? endpoint : `/api${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    const headers = {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...options.headers,
    };

    const config = {
      ...options,
      headers,
    };
    if (options.body && !(options.body instanceof FormData) && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    try {
      const res = await fetch(url, config);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || `Lỗi yêu cầu (${res.status})`);
      }
      return data;
    } catch (err) {
      console.error(`API Error on ${url}:`, err);
      throw err;
    }
  }

  // -------------------------------------------------------------
  // AUTHENTICATION & PROFILE
  // -------------------------------------------------------------
  async function initAuth() {
    if (!state.token) {
      updateNavByRole(null);
      return;
    }
    try {
      const res = await api('/auth/me');
      state.user = res.data;
      updateNavByRole(state.user.role);
      loadNotifications();
    } catch (err) {
      console.warn('Token hết hạn hoặc không hợp lệ');
      logout();
    }
  }

  function setSession(token, user) {
    state.token = token;
    state.user = user;
    sessionStorage.setItem('fruitToken', token);
    localStorage.setItem('fruitToken', token);
    updateNavByRole(user.role);
    loadNotifications();
    toast(`Xin chào, ${user.fullName}!`, 'success');
  }

  function logout() {
    state.token = null;
    state.user = null;
    state.currentShop = null;
    sessionStorage.removeItem('fruitToken');
    localStorage.removeItem('fruitToken');
    updateNavByRole(null);
    switchView('products');
    toast('Đã đăng xuất tài khoản', 'info');
  }

  function updateNavByRole(role) {
    const accountNameEl = $('#account-user-name');
    const accountRoleEl = $('#account-user-role');
    const btnLogout = $('#btn-logout');
    const tabOrders = $('#tab-orders');
    const tabInv = $('#tab-inventory');
    const tabShopOrders = $('#tab-shop-orders');
    const tabShopManage = $('#tab-shop-manage');
    const tabAdmin = $('#tab-admin');
    const btnRequestShop = $('#btn-request-shop-trigger');

    if (state.user) {
      accountNameEl.textContent = state.user.fullName || state.user.email;
      accountRoleEl.textContent = state.user.role;
      accountRoleEl.hidden = false;
      btnLogout.hidden = false;

      const isStaff = state.user.role === 'STAFF';
      const isOwner = state.user.role === 'SHOP_OWNER';
      const isAdmin = state.user.role === 'ADMIN';
      const isCustomer = state.user.role === 'CUSTOMER';

      tabOrders.hidden = false;
      tabInv.hidden = !(isOwner || isStaff || isAdmin);
      tabShopOrders.hidden = !(isOwner || isStaff || isAdmin);
      tabShopManage.hidden = !(isOwner || isAdmin);
      tabAdmin.hidden = !isAdmin;
      if (btnRequestShop) btnRequestShop.hidden = !isCustomer;

      if (isOwner || isStaff || isAdmin) {
        loadMyShopInfo();
      }
    } else {
      accountNameEl.textContent = 'Đăng nhập';
      accountRoleEl.hidden = true;
      btnLogout.hidden = true;

      tabOrders.hidden = true;
      tabInv.hidden = true;
      tabShopOrders.hidden = true;
      tabShopManage.hidden = true;
      tabAdmin.hidden = true;
      if (btnRequestShop) btnRequestShop.hidden = true;
    }
  }

  async function quickLogin(roleKey) {
    const creds = DEMO_USERS[roleKey];
    if (!creds) return;
    try {
      const res = await api('/auth/login', {
        method: 'POST',
        body: { email: creds.email, password: creds.password },
      });
      setSession(res.data.token, res.data.user);
      // Automatically switch to the most relevant view for this role!
      if (roleKey === 'inventory') switchView('inventory');
      else if (roleKey === 'order') switchView('shop-orders');
      else if (roleKey === 'owner') switchView('shop-manage');
      else if (roleKey === 'admin') switchView('admin');
      else switchView('products');
    } catch (err) {
      toast(`Đăng nhập demo thất bại: ${err.message}`, 'error');
    }
  }

  async function loadMyShopInfo() {
    try {
      const res = await api('/shops');
      state.shops = res.data?.items || res.data || [];
      if (state.user.role === 'SHOP_OWNER') {
        state.currentShop = state.shops.find((s) => String(s.ownerId?._id || s.ownerId) === String(state.user._id)) || state.shops[0];
      } else {
        state.currentShop = state.shops[0];
      }
    } catch (e) {
      console.warn('Chưa lấy được thông tin shop:', e);
    }
  }

  // -------------------------------------------------------------
  // NOTIFICATIONS (LUỒNG 1)
  // -------------------------------------------------------------
  async function loadNotifications() {
    if (!state.token) return;
    try {
      const res = await api('/notifications?limit=20');
      const data = res.data || {};
      state.notifications = data.items || [];
      state.unreadCount = data.unreadCount || state.notifications.filter((n) => !n.isRead).length;

      const badge = $('#noti-unread-count');
      if (badge) {
        badge.textContent = state.unreadCount;
        badge.hidden = state.unreadCount <= 0;
      }
      renderNotificationsList();
    } catch (e) {
      console.warn('Lỗi tải thông báo:', e);
    }
  }

  function renderNotificationsList() {
    const container = $('#noti-list-container');
    if (!container) return;
    if (!state.notifications.length) {
      container.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--muted);">Không có thông báo nào.</div>';
      return;
    }
    container.innerHTML = state.notifications.map((n) => `
      <div class="noti-item ${n.isRead ? '' : 'is-unread'}" onclick="window.__readNoti('${n._id}')">
        <div style="font-size: 20px;">${n.type === 'ORDER' ? '📦' : n.type === 'INVENTORY' ? '⚠️' : '🔔'}</div>
        <div style="flex: 1;">
          <div class="noti-title">${escapeHtml(n.title)}</div>
          <div class="noti-msg">${escapeHtml(n.message)}</div>
          <div class="noti-time">${formatDate(n.createdAt)}</div>
        </div>
      </div>
    `).join('');
  }

  window.__readNoti = async (id) => {
    try {
      await api(`/notifications/${id}/read`, { method: 'PATCH' });
      loadNotifications();
    } catch (e) {}
  };

  // -------------------------------------------------------------
  // NAVIGATION & VIEW SWITCHING
  // -------------------------------------------------------------
  function switchView(viewName) {
    state.currentView = viewName;
    $$('.nav-tab').forEach((tab) => {
      const match = tab.dataset.view === viewName;
      tab.classList.toggle('is-active', match);
      tab.setAttribute('aria-selected', String(match));
    });

    $$('.view').forEach((view) => {
      const match = view.id === `${viewName}-view`;
      view.classList.toggle('is-visible', match);
    });

    // Trigger loads for active view
    if (viewName === 'products') loadProducts();
    else if (viewName === 'cart') loadCart();
    else if (viewName === 'orders') loadCustomerOrders();
    else if (viewName === 'inventory') loadInventoryView();
    else if (viewName === 'shop-orders') loadShopOrders();
    else if (viewName === 'shop-manage') loadShopManageView();
    else if (viewName === 'admin') loadAdminView();
  }

  // -------------------------------------------------------------
  // VIEW 1: STOREFRONT & PRODUCTS (LUỒNG 3 & 4)
  // -------------------------------------------------------------
  async function loadProducts() {
    const container = $('#product-grid-container');
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 48px; color: var(--muted);">Đang tải sản phẩm...</div>';

    try {
      const [prodRes, catRes, shopRes] = await Promise.all([
        api('/products?limit=50'),
        api('/categories?status=ACTIVE'),
        api('/shops'),
      ]);

      state.products = prodRes.data?.items || prodRes.data || [];
      state.categories = catRes.data?.items || catRes.data || [];
      state.shops = shopRes.data?.items || shopRes.data || [];

      // Populate filters
      const catSelect = $('#product-category-select');
      const shopSelect = $('#product-shop-select');

      if (catSelect) {
        catSelect.innerHTML = '<option value="">Tất cả danh mục</option>' +
          state.categories.map((c) => `<option value="${c._id}">${escapeHtml(c.categoryName)}</option>`).join('');
      }
      if (shopSelect) {
        shopSelect.innerHTML = '<option value="">Tất cả cửa hàng</option>' +
          state.shops.map((s) => `<option value="${s._id}">${escapeHtml(s.shopName)}</option>`).join('');
      }

      renderFilteredProducts();
    } catch (err) {
      container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 48px; color: var(--red);">Lỗi tải sản phẩm: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderFilteredProducts() {
    const container = $('#product-grid-container');
    const keyword = ($('#product-search-input')?.value || '').toLowerCase().trim();
    const catId = $('#product-category-select')?.value || '';
    const shopId = $('#product-shop-select')?.value || '';
    const sort = $('#product-sort-select')?.value || 'newest';

    let list = [...state.products];

    if (keyword) {
      list = list.filter((p) => p.productName.toLowerCase().includes(keyword) || (p.description || '').toLowerCase().includes(keyword));
    }
    if (catId) {
      list = list.filter((p) => String(p.categoryId?._id || p.categoryId) === catId);
    }
    if (shopId) {
      list = list.filter((p) => String(p.shopId?._id || p.shopId) === shopId);
    }

    if (sort === 'price-asc') list.sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') list.sort((a, b) => b.price - a.price);
    else list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    $('#store-stats-badge').textContent = `${list.length} sản phẩm sẵn có`;

    if (!list.length) {
      container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--muted);">Không tìm thấy sản phẩm trái cây nào phù hợp.</div>';
      return;
    }

    const fruitEmojis = ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝'];

    container.innerHTML = list.map((p, idx) => {
      const isOutOfStock = p.stockQuantity <= 0;
      const shopName = p.shopName || (state.shops.find((s) => String(s._id) === String(p.shopId?._id || p.shopId))?.shopName) || 'Fruit Shop';
      const emoji = fruitEmojis[idx % fruitEmojis.length];

      return `
        <article class="product-card" data-id="${p._id}">
          <div class="product-thumb-wrap">
            ${p.images && p.images[0] ? `<img src="${p.images[0]}" alt="${escapeHtml(p.productName)}" onerror="this.outerHTML='<span class=\\'product-fallback-icon\\'>${emoji}</span>'" />` : `<span class="product-fallback-icon">${emoji}</span>`}
            <div class="product-badge-wrap">
              ${isOutOfStock ? `<span class="badge badge-out-of-stock">Hết hàng</span>` : `<span class="badge badge-stock">Còn ${p.stockQuantity} kg</span>`}
            </div>
          </div>
          <div class="product-body">
            <div class="product-shop-name">🏪 ${escapeHtml(shopName)}</div>
            <h3 class="product-title">${escapeHtml(p.productName)}</h3>
            <p class="product-desc">${escapeHtml(p.description || 'Trái cây tươi ngon tự nhiên, bảo quản kỹ lưỡng.')}</p>
            <div class="product-footer">
              <div>
                <div class="product-price">${formatVND(p.price)}</div>
              </div>
              <button class="button button-primary button-sm" ${isOutOfStock ? 'disabled style="opacity: 0.5;"' : ''} onclick="window.__addToCart('${p._id}', 1)">
                ${isOutOfStock ? 'Hết hàng' : '+ Thêm giỏ'}
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  // -------------------------------------------------------------
  // VIEW 2: CART & CHECKOUT (LUỒNG 4)
  // -------------------------------------------------------------
  window.__addToCart = async (productId, quantity = 1) => {
    if (!state.token) {
      openAuthDialog('login', 'Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.');
      return;
    }
    try {
      await api('/cart/items', {
        method: 'POST',
        body: { productId, quantity },
      });
      toast('Đã thêm trái cây vào giỏ hàng!', 'success');
      loadCart();
    } catch (err) {
      toast(`Không thể thêm giỏ hàng: ${err.message}`, 'error');
    }
  };

  async function loadCart() {
    if (!state.token) {
      $('#nav-cart-count').textContent = '0';
      return;
    }
    try {
      const res = await api('/cart');
      state.cart = res.data;
      renderCartUI();
    } catch (err) {
      console.warn('Lỗi tải giỏ hàng:', err);
    }
  }

  function renderCartUI() {
    const container = $('#cart-groups-container');
    const badge = $('#nav-cart-count');
    const items = state.cart?.items || [];

    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
    if (badge) badge.textContent = totalQty;

    if (!items.length) {
      container.innerHTML = '<div style="text-align: center; padding: 48px; color: var(--muted);"><p style="font-size: 40px; margin: 0;">🛒</p><p>Giỏ hàng của bạn đang trống.</p><button class="button button-primary button-sm" onclick="window.__switchTab(\\'products\\')">Tiếp tục mua sắm</button></div>';
      $('#checkout-total-items').textContent = '0';
      $('#checkout-total-shops').textContent = '0';
      $('#checkout-total-price').textContent = '0 đ';
      return;
    }

    // Group items by shop
    const grouped = {};
    items.forEach((item) => {
      const sid = String(item.shopId?._id || item.shopId || 'default');
      const sname = item.shopId?.shopName || 'Cửa hàng';
      if (!grouped[sid]) grouped[sid] = { name: sname, items: [] };
      grouped[sid].items.push(item);
    });

    let grandTotal = 0;
    let html = '';

    Object.entries(grouped).forEach(([sid, group]) => {
      const groupSubtotal = group.items.reduce((s, it) => s + (it.price * it.quantity), 0);
      grandTotal += groupSubtotal;

      html += `
        <div class="shop-cart-group">
          <div class="shop-cart-header">
            <span>🏪 ${escapeHtml(group.name)}</span>
            <span>Tạm tính: ${formatVND(groupSubtotal)}</span>
          </div>
          ${group.items.map((item) => `
            <div class="cart-item-row">
              <div class="cart-item-img">${item.images && item.images[0] ? `<img src="${item.images[0]}" style="width:100%; height:100%; object-fit:cover; border-radius:4px;" />` : '🍎'}</div>
              <div>
                <strong>${escapeHtml(item.productName)}</strong>
                <div style="font-size: 12px; color: var(--muted);">${formatVND(item.price)} / kg</div>
              </div>
              <div class="qty-ctrl">
                <button class="qty-btn" onclick="window.__updateCartQty('${item.productId?._id || item.productId}', ${item.quantity - 1})">-</button>
                <input class="qty-input" value="${item.quantity}" readonly />
                <button class="qty-btn" onclick="window.__updateCartQty('${item.productId?._id || item.productId}', ${item.quantity + 1})">+</button>
              </div>
              <strong style="color: var(--green);">${formatVND(item.price * item.quantity)}</strong>
              <button class="button-text" style="color: var(--red); font-size: 16px;" onclick="window.__removeCartItem('${item.productId?._id || item.productId}')" title="Xóa món">✕</button>
            </div>
          `).join('')}
        </div>
      `;
    });

    container.innerHTML = html;
    $('#checkout-total-items').textContent = totalQty;
    $('#checkout-total-shops').textContent = Object.keys(grouped).length;
    $('#checkout-total-price').textContent = formatVND(grandTotal);

    if (state.user?.phone && $('#checkout-phone')) {
      $('#checkout-phone').value = state.user.phone;
    }
  }

  window.__updateCartQty = async (productId, qty) => {
    try {
      if (qty <= 0) {
        await api(`/cart/items/${productId}`, { method: 'DELETE' });
      } else {
        await api(`/cart/items/${productId}`, { method: 'PATCH', body: { quantity: qty } });
      }
      loadCart();
    } catch (e) {
      toast(`Không cập nhật được số lượng: ${e.message}`, 'error');
    }
  };

  window.__removeCartItem = async (productId) => {
    try {
      await api(`/cart/items/${productId}`, { method: 'DELETE' });
      toast('Đã xóa món khỏi giỏ', 'info');
      loadCart();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  // -------------------------------------------------------------
  // VIEW 3: CUSTOMER ORDERS (LUỒNG 4)
  // -------------------------------------------------------------
  async function loadCustomerOrders(statusFilter = '') {
    const container = $('#customer-orders-container');
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--muted);">Đang tải đơn hàng...</div>';

    try {
      const url = statusFilter ? `/orders?orderStatus=${statusFilter}&limit=30` : '/orders?limit=30';
      const res = await api(url);
      state.customerOrders = res.data?.items || res.data || [];
      renderCustomerOrders();
    } catch (err) {
      container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--red);">Lỗi tải đơn hàng: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderCustomerOrders() {
    const container = $('#customer-orders-container');
    if (!state.customerOrders.length) {
      container.innerHTML = '<div style="text-align: center; padding: 48px; color: var(--muted);"><p style="font-size: 40px; margin: 0;">📦</p><p>Bạn chưa có đơn hàng nào.</p></div>';
      return;
    }

    const statusBadge = (s) => {
      const map = {
        PENDING: '<span class="badge badge-pending">Chờ xác nhận</span>',
        CONFIRMED: '<span class="badge badge-confirmed">Đã xác nhận</span>',
        PREPARING: '<span class="badge badge-preparing">Đang chuẩn bị</span>',
        SHIPPING: '<span class="badge badge-shipping">Đang giao hàng</span>',
        DELIVERED: '<span class="badge badge-delivered">Giao thành công</span>',
        CANCELLED: '<span class="badge badge-cancelled">Đã hủy</span>',
      };
      return map[s] || `<span class="badge">${s}</span>`;
    };

    container.innerHTML = state.customerOrders.map((order) => {
      const isOnlineUnpaid = order.paymentMethod === 'ONLINE' && order.paymentStatus === 'UNPAID';
      const isPending = order.orderStatus === 'PENDING';

      return `
        <div class="cart-card" style="padding: 18px 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--line-subtle); padding-bottom: 12px; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
            <div>
              <strong>Đơn hàng #${order._id.slice(-6).toUpperCase()}</strong>
              <span style="color: var(--muted); font-size: 12.5px; margin-left: 8px;">Ngày đặt: ${formatDate(order.createdAt)}</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              ${statusBadge(order.orderStatus)}
              <span class="badge badge-${order.paymentStatus.toLowerCase()}">${order.paymentStatus === 'PAID' ? 'Đã thanh toán' : order.paymentStatus === 'REFUNDED' ? 'Đã hoàn tiền' : 'Chưa thanh toán'}</span>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
            <div>
              <div style="font-size: 13.5px; margin-bottom: 4px;">
                ${order.items.map((it) => `${escapeHtml(it.productName)} (x${it.quantity})`).join(', ')}
              </div>
              <div style="font-size: 12px; color: var(--muted);">
                Địa chỉ: ${escapeHtml(order.shippingAddress)} · SĐT: ${escapeHtml(order.phone || '—')}
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <strong class="product-price">${formatVND(order.totalAmount)}</strong>
              ${isOnlineUnpaid ? `<button class="button button-primary button-sm" onclick="window.__payOrder('${order._id}')">💳 Thanh toán ngay</button>` : ''}
              ${isPending ? `<button class="button button-danger button-sm" onclick="window.__openCancelOrderModal('${order._id}', 'customer')">Hủy đơn</button>` : ''}
              <button class="button button-secondary button-sm" onclick="window.__openOrderDetail('${order._id}')">Xem chi tiết</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  window.__payOrder = async (orderId) => {
    try {
      await api(`/orders/${orderId}/pay`, { method: 'POST' });
      toast('Thanh toán giả lập thành công! Trạng thái: PAID', 'success');
      loadCustomerOrders();
    } catch (e) {
      toast(`Thanh toán thất bại: ${e.message}`, 'error');
    }
  };

  window.__openOrderDetail = async (orderId) => {
    try {
      const res = await api(`/orders/${orderId}`);
      const order = res.data;
      $('#dlg-order-id').textContent = order._id.slice(-6).toUpperCase();
      $('#dlg-order-address').textContent = order.shippingAddress;
      $('#dlg-order-phone').textContent = order.phone || '—';
      $('#dlg-order-payment').textContent = order.paymentMethod;
      $('#dlg-order-payment-status').innerHTML = `<span class="badge badge-${order.paymentStatus.toLowerCase()}">${order.paymentStatus}</span>`;
      $('#dlg-order-total-price').textContent = formatVND(order.totalAmount);

      // Render stepper
      const steps = ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'DELIVERED'];
      const curIdx = steps.indexOf(order.orderStatus);
      const isCancelled = order.orderStatus === 'CANCELLED';

      $('#dlg-order-stepper').hidden = isCancelled;
      $('#dlg-cancelled-banner').hidden = !isCancelled;

      if (!isCancelled) {
        steps.forEach((st, idx) => {
          const el = $(`#step-${st}`);
          if (el) {
            el.classList.toggle('is-done', idx < curIdx);
            el.classList.toggle('is-current', idx === curIdx);
          }
        });
      }

      // Render items
      $('#dlg-order-items-body').innerHTML = order.items.map((it) => `
        <tr>
          <td><strong>${escapeHtml(it.productName)}</strong></td>
          <td>${formatVND(it.price)}</td>
          <td>${it.quantity}</td>
          <td><strong>${formatVND(it.subtotal || it.price * it.quantity)}</strong></td>
        </tr>
      `).join('');

      $('#order-detail-dialog').showModal();
    } catch (e) {
      toast(`Không tải được chi tiết đơn: ${e.message}`, 'error');
    }
  };

  // -------------------------------------------------------------
  // VIEW 4: INVENTORY MANAGEMENT (LUỒNG 5 - TRẦN HỮU HƯNG)
  // -------------------------------------------------------------
  async function loadInventoryView() {
    try {
      const [txRes, alertsRes, prodRes] = await Promise.all([
        api('/myshop/inventory/transactions?limit=30'),
        api('/myshop/inventory/alerts?days=3'),
        api('/myshop/products?limit=50'),
      ]);

      state.inventoryTransactions = txRes.data?.items || txRes.data || [];
      state.inventoryAlerts = alertsRes.data || { outOfStock: [], nearExpiry: [] };
      state.shopProducts = prodRes.data?.items || prodRes.data || [];

      // KPIs
      $('#kpi-inv-total-products').textContent = state.shopProducts.length;
      $('#kpi-inv-out-of-stock').textContent = state.inventoryAlerts.outOfStock?.length || 0;
      $('#kpi-inv-near-expiry').textContent = state.inventoryAlerts.nearExpiry?.length || 0;

      // Populate selects for import/export
      const importSel = $('#import-product-select');
      const exportSel = $('#export-product-select');
      const filterProdSel = $('#inv-filter-product');

      const options = state.shopProducts.map((p) => `<option value="${p._id}">${escapeHtml(p.productName)} (Tồn: ${p.stockQuantity} kg)</option>`).join('');
      if (importSel) importSel.innerHTML = options;
      if (exportSel) exportSel.innerHTML = options;
      if (filterProdSel) filterProdSel.innerHTML = '<option value="">Tất cả sản phẩm</option>' + state.shopProducts.map((p) => `<option value="${p._id}">${escapeHtml(p.productName)}</option>`).join('');

      renderInventoryTransactions();
      renderInventoryAlerts();
    } catch (err) {
      toast(`Lỗi nạp kho hàng: ${err.message}`, 'error');
    }
  }

  function renderInventoryTransactions() {
    const tbody = $('#inv-transactions-body');
    const type = $('#inv-filter-type')?.value || '';
    const prodId = $('#inv-filter-product')?.value || '';

    let list = [...state.inventoryTransactions];
    if (type) list = list.filter((t) => t.type === type);
    if (prodId) list = list.filter((t) => String(t.productId?._id || t.productId) === prodId);

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--muted); padding: 30px;">Không tìm thấy biến động kho nào.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map((tx) => `
      <tr>
        <td>${formatDate(tx.createdAt)}</td>
        <td>
          <span class="badge ${tx.type === 'IMPORT' ? 'badge-delivered' : 'badge-cancelled'}">
            ${tx.type === 'IMPORT' ? '📥 NHẬP KHO' : '📤 XUẤT KHO / HỦY'}
          </span>
        </td>
        <td><strong>${escapeHtml(tx.productId?.productName || 'Sản phẩm')}</strong></td>
        <td><strong style="font-size: 15px; color: ${tx.type === 'IMPORT' ? 'var(--green)' : 'var(--red)'};">${tx.type === 'IMPORT' ? '+' : '-'}${tx.quantity} kg</strong></td>
        <td>${escapeHtml(tx.note || '—')}</td>
        <td>${escapeHtml(tx.createdBy?.fullName || 'Hệ thống')}</td>
      </tr>
    `).join('');
  }

  function renderInventoryAlerts() {
    const outTbody = $('#alert-out-of-stock-body');
    const expTbody = $('#alert-near-expiry-body');
    const outs = state.inventoryAlerts.outOfStock || [];
    const exps = state.inventoryAlerts.nearExpiry || [];

    $('#badge-alert-out-count').textContent = `${outs.length} sản phẩm`;
    $('#badge-alert-expiry-count').textContent = `${exps.length} sản phẩm`;

    outTbody.innerHTML = outs.length ? outs.map((p) => `
      <tr>
        <td><strong>${escapeHtml(p.productName)}</strong></td>
        <td>${escapeHtml(p.categoryId?.categoryName || '—')}</td>
        <td><button class="button button-primary button-sm" onclick="window.__quickFillImport('${p._id}')">+ Nhập kho</button></td>
      </tr>
    `).join('') : '<tr><td colspan="3" style="text-align: center; color: var(--muted); padding: 20px;">Không có sản phẩm nào hết hàng.</td></tr>';

    expTbody.innerHTML = exps.length ? exps.map((p) => `
      <tr>
        <td><strong>${escapeHtml(p.productName)}</strong></td>
        <td><strong style="color: var(--red);">${formatDate(p.expiryDate)}</strong></td>
        <td>Còn ${p.stockQuantity} kg</td>
      </tr>
    `).join('') : '<tr><td colspan="3" style="text-align: center; color: var(--muted); padding: 20px;">Không có sản phẩm nào cận hạn.</td></tr>';
  }

  window.__quickFillImport = (productId) => {
    switchInvTab('import');
    $('#import-product-select').value = productId;
    $('#import-quantity').focus();
  };

  function switchInvTab(tabName) {
    $$('#inv-subnav .subnav-btn').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.invTab === tabName);
    });
    $$('.inv-tab-content').forEach((c) => {
      c.hidden = c.id !== `inv-tab-${tabName}`;
    });
  }

  // -------------------------------------------------------------
  // VIEW 5: SHOP ORDERS PROCESSING (LUỒNG 5 - TRẦN HỮU HƯNG)
  // -------------------------------------------------------------
  async function loadShopOrders(status = '') {
    const tbody = $('#shop-orders-table-body');
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--muted); padding: 30px;">Đang tải danh sách đơn hàng của shop...</td></tr>';

    try {
      const url = status ? `/myshop/orders?orderStatus=${status}&limit=50` : '/myshop/orders?limit=50';
      const res = await api(url);
      state.shopOrders = res.data?.items || res.data || [];
      renderShopOrdersTable();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--red); padding: 30px;">Lỗi tải đơn shop: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderShopOrdersTable() {
    const tbody = $('#shop-orders-table-body');
    if (!state.shopOrders.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--muted); padding: 40px;">Không có đơn hàng nào trong mục này.</td></tr>';
      return;
    }

    tbody.innerHTML = state.shopOrders.map((order) => {
      let actionButtons = '';
      const isPending = order.orderStatus === 'PENDING';
      const isConfirmed = order.orderStatus === 'CONFIRMED';
      const isPreparing = order.orderStatus === 'PREPARING';
      const isShipping = order.orderStatus === 'SHIPPING';
      const canCancel = ['PENDING', 'CONFIRMED', 'PREPARING'].includes(order.orderStatus);

      if (isPending) {
        actionButtons += `<button class="button button-primary button-sm" onclick="window.__confirmShopOrder('${order._id}')" title="Xác nhận đơn và trừ kho">✓ Xác nhận đơn (UC43)</button> `;
      } else if (isConfirmed) {
        actionButtons += `<button class="button button-secondary button-sm" onclick="window.__advanceShopOrderStatus('${order._id}', 'PREPARING')">📦 Đóng gói xong</button> `;
      } else if (isPreparing) {
        actionButtons += `<button class="button button-secondary button-sm" onclick="window.__advanceShopOrderStatus('${order._id}', 'SHIPPING')">🚚 Bắt đầu giao</button> `;
      } else if (isShipping) {
        actionButtons += `<button class="button button-primary button-sm" onclick="window.__advanceShopOrderStatus('${order._id}', 'DELIVERED')">🎉 Đã giao xong</button> `;
      }

      if (canCancel) {
        actionButtons += `<button class="button button-danger button-sm" onclick="window.__openCancelOrderModal('${order._id}', 'shop')">Hủy đơn (UC45)</button>`;
      }

      return `
        <tr>
          <td><strong>#${order._id.slice(-6).toUpperCase()}</strong></td>
          <td>${formatDate(order.createdAt)}</td>
          <td>
            <strong>${escapeHtml(order.customerId?.fullName || 'Khách vãng lai')}</strong>
            <div style="font-size: 11.5px; color: var(--muted);">${escapeHtml(order.customerId?.email || '')}</div>
          </td>
          <td>
            ${escapeHtml(order.shippingAddress)}
            <div style="font-size: 11.5px; color: var(--muted);">Hotline: ${escapeHtml(order.phone || '—')}</div>
          </td>
          <td><strong style="color: var(--green);">${formatVND(order.totalAmount)}</strong></td>
          <td>
            <span class="badge badge-${order.paymentStatus.toLowerCase()}">${order.paymentStatus}</span>
            <div style="font-size: 11px; color: var(--muted);">${order.paymentMethod}</div>
          </td>
          <td><span class="badge badge-${order.orderStatus.toLowerCase()}">${order.orderStatus}</span></td>
          <td style="white-space: nowrap;">${actionButtons || '<span style="color: var(--muted);">Hoàn tất</span>'}</td>
        </tr>
      `;
    }).join('');
  }

  // UC43: Xác nhận đơn
  window.__confirmShopOrder = async (orderId) => {
    try {
      await api(`/myshop/orders/${orderId}/confirm`, { method: 'PATCH' });
      toast('Đã xác nhận đơn hàng! Hệ thống đã tự động xuất kho trừ số lượng tồn.', 'success');
      loadShopOrders();
    } catch (e) {
      toast(`Không thể xác nhận đơn: ${e.message}`, 'error');
    }
  };

  // UC44: Cập nhật giao hàng
  window.__advanceShopOrderStatus = async (orderId, newStatus) => {
    try {
      await api(`/myshop/orders/${orderId}/status`, {
        method: 'PATCH',
        body: { orderStatus: newStatus },
      });
      toast(`Đã cập nhật đơn sang trạng thái: ${newStatus}`, 'success');
      loadShopOrders();
    } catch (e) {
      toast(`Lỗi cập nhật: ${e.message}`, 'error');
    }
  };

  // UC45: Shop Hủy đơn
  window.__openCancelOrderModal = (orderId, actor = 'customer') => {
    $('#cancel-target-id').value = orderId;
    $('#cancel-target-actor').value = actor;
    $('#cancel-dialog-order-id').textContent = orderId.slice(-6).toUpperCase();
    $('#cancel-reason-input').value = '';
    $('#cancel-order-dialog').showModal();
  };

  // -------------------------------------------------------------
  // VIEW 6: SHOP MANAGEMENT (LUỒNG 2 & 3)
  // -------------------------------------------------------------
  async function loadShopManageView() {
    try {
      const [shopRes, prodRes, catRes, staffRes, statsRes] = await Promise.all([
        api('/shops'),
        api('/myshop/products?limit=50'),
        api('/myshop/categories?limit=50'),
        api(`/shops/${state.currentShop?._id || 'all'}/staff`).catch(() => ({ data: [] })),
        api('/myshop/statistics/revenue').catch(() => ({ data: [] })),
      ]);

      state.shops = shopRes.data?.items || shopRes.data || [];
      if (!state.currentShop && state.shops.length) state.currentShop = state.shops[0];

      state.shopProducts = prodRes.data?.items || prodRes.data || [];
      state.shopCategories = catRes.data?.items || catRes.data || [];
      state.shopStaff = staffRes.data?.items || staffRes.data || [];
      state.shopStats.revenue = statsRes.data || [];

      if (state.currentShop) {
        $('#manage-shop-heading').textContent = `Quản lý Shop: ${state.currentShop.shopName}`;
        $('#shop-operation-status-badge').textContent = state.currentShop.operationStatus === 'OPEN' ? 'Đang mở cửa' : 'Đang đóng cửa';
        $('#shop-operation-status-badge').className = `badge ${state.currentShop.operationStatus === 'OPEN' ? 'badge-delivered' : 'badge-cancelled'}`;
        $('#btn-toggle-shop-op-status').textContent = state.currentShop.operationStatus === 'OPEN' ? 'Tạm đóng cửa' : 'Mở cửa shop';

        $('#shop-edit-name').value = state.currentShop.shopName || '';
        $('#shop-edit-address').value = state.currentShop.address || '';
        $('#shop-edit-phone').value = state.currentShop.phone || '';
        $('#shop-edit-logo').value = state.currentShop.logoUrl || '';
      }

      renderShopProductsTable();
      renderShopCategoriesTable();
      renderShopStaffTable();
      renderShopStats();
    } catch (e) {
      console.warn('Lỗi tải quản lý shop:', e);
    }
  }

  function renderShopProductsTable() {
    const tbody = $('#sm-products-table-body');
    tbody.innerHTML = state.shopProducts.map((p) => `
      <tr>
        <td>${p.images && p.images[0] ? `<img src="${p.images[0]}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;" />` : '🍎'}</td>
        <td><strong>${escapeHtml(p.productName)}</strong></td>
        <td>${escapeHtml(p.categoryId?.categoryName || '—')}</td>
        <td><strong>${formatVND(p.price)}</strong></td>
        <td><strong style="color: ${p.stockQuantity > 0 ? 'var(--green)' : 'var(--red)'};">${p.stockQuantity} kg</strong></td>
        <td>${formatDate(p.expiryDate)}</td>
        <td><span class="badge ${p.productStatus === 'AVAILABLE' ? 'badge-delivered' : 'badge-cancelled'}">${p.productStatus}</span></td>
        <td style="white-space: nowrap;">
          <button class="button button-secondary button-sm" onclick="window.__toggleProductStatus('${p._id}', '${p.productStatus}')">${p.productStatus === 'AVAILABLE' ? 'Ẩn' : 'Hiện'}</button>
          <button class="button button-text button-sm" onclick="window.__editProduct('${p._id}')">Sửa</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="8" style="text-align: center; color: var(--muted); padding: 30px;">Shop chưa có sản phẩm nào.</td></tr>';
  }

  window.__toggleProductStatus = async (id, curStatus) => {
    try {
      const nextStatus = curStatus === 'AVAILABLE' ? 'HIDDEN' : 'AVAILABLE';
      await api(`/myshop/products/${id}/status`, {
        method: 'PATCH',
        body: { productStatus: nextStatus },
      });
      toast(`Đã đổi trạng thái sản phẩm sang: ${nextStatus}`, 'success');
      loadShopManageView();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  function renderShopCategoriesTable() {
    const tbody = $('#sm-categories-table-body');
    tbody.innerHTML = state.shopCategories.map((c) => `
      <tr>
        <td><strong>${escapeHtml(c.categoryName)}</strong></td>
        <td>${escapeHtml(c.description || '—')}</td>
        <td><span class="badge ${c.status === 'ACTIVE' ? 'badge-delivered' : 'badge-cancelled'}">${c.status}</span></td>
        <td>
          <button class="button button-text button-sm" onclick="window.__editCategory('${c._id}')">Sửa</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="4" style="text-align: center; color: var(--muted); padding: 30px;">Chưa có danh mục nào.</td></tr>';
  }

  function renderShopStaffTable() {
    const tbody = $('#sm-staff-table-body');
    tbody.innerHTML = state.shopStaff.map((st) => `
      <tr>
        <td><strong>${escapeHtml(st.userId?.fullName || 'Nhân viên')}</strong></td>
        <td>${escapeHtml(st.userId?.email || '—')}</td>
        <td>${escapeHtml(st.userId?.phone || '—')}</td>
        <td><span class="badge ${st.role === 'INVENTORY_STAFF' ? 'badge-confirmed' : 'badge-preparing'}">${st.role}</span></td>
        <td>${formatDate(st.createdAt)}</td>
        <td>
          <button class="button button-danger button-sm" onclick="window.__removeStaff('${st.userId?._id || st.userId}')">Xóa</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align: center; color: var(--muted); padding: 30px;">Shop chưa có nhân viên nào.</td></tr>';
  }

  window.__removeStaff = async (userId) => {
    if (!confirm('Bạn chắc chắn muốn xóa nhân viên này khỏi shop?')) return;
    try {
      await api(`/shops/${state.currentShop._id}/staff/${userId}`, { method: 'DELETE' });
      toast('Đã xóa nhân viên khỏi shop', 'success');
      loadShopManageView();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  async function renderShopStats() {
    try {
      const topRes = await api('/myshop/statistics/topProducts');
      const topProds = topRes.data || [];
      const totalRev = state.shopStats.revenue.reduce((sum, r) => sum + (r.revenue || 0), 0);
      const totalOrders = state.shopStats.revenue.reduce((sum, r) => sum + (r.orders || r.orderCount || 0), 0);

      $('#kpi-shop-revenue').textContent = formatVND(totalRev);
      $('#kpi-shop-orders-count').textContent = totalOrders;

      $('#sm-top-products-body').innerHTML = topProds.length ? topProds.map((p) => `
        <tr>
          <td><strong>${escapeHtml(p.productName || p.name || 'Sản phẩm')}</strong></td>
          <td><strong style="color: var(--green);">${p.quantity || 0} kg</strong></td>
          <td><strong>${formatVND(p.revenue || 0)}</strong></td>
        </tr>
      `).join('') : '<tr><td colspan="3" style="text-align: center; color: var(--muted); padding: 20px;">Chưa có dữ liệu đơn hoàn tất.</td></tr>';
    } catch (e) {}
  }

  function switchShopManageTab(tabName) {
    $$('#shop-manage-subnav .subnav-btn').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.smTab === tabName);
    });
    $$('.sm-tab-content').forEach((c) => {
      c.hidden = c.id !== `sm-tab-${tabName}`;
    });
  }

  // -------------------------------------------------------------
  // VIEW 7: ADMIN PORTAL (LUỒNG 1 & 2)
  // -------------------------------------------------------------
  async function loadAdminView() {
    try {
      const [reqRes, shopRes, userRes, dashRes] = await Promise.all([
        api('/admin/shop-requests?status=PENDING'),
        api('/admin/shops?limit=50'),
        api('/admin/users?limit=50'),
        api('/admin/dashboard').catch(() => ({ data: {} })),
      ]);

      state.adminRequests = reqRes.data?.items || reqRes.data || [];
      state.adminShops = shopRes.data?.items || shopRes.data || [];
      state.adminUsers = userRes.data?.items || userRes.data || [];
      state.adminStats = dashRes.data || {};

      $('#kpi-admin-users').textContent = state.adminStats.totalUsers || state.adminUsers.length;
      $('#kpi-admin-shops').textContent = state.adminStats.totalShops || state.adminShops.length;
      $('#kpi-admin-orders').textContent = state.adminStats.totalOrders || '—';
      $('#kpi-admin-revenue').textContent = formatVND(state.adminStats.totalRevenue || 0);

      renderAdminRequests();
      renderAdminShops();
      renderAdminUsers();
    } catch (err) {
      toast(`Lỗi nạp trang Admin: ${err.message}`, 'error');
    }
  }

  function renderAdminRequests() {
    const tbody = $('#admin-requests-table-body');
    tbody.innerHTML = state.adminRequests.length ? state.adminRequests.map((r) => `
      <tr>
        <td><strong>${escapeHtml(r.customerId?.fullName || 'Khách hàng')}</strong></td>
        <td>${escapeHtml(r.customerId?.email || '—')}</td>
        <td><strong style="color: var(--green);">${escapeHtml(r.shopName)}</strong></td>
        <td>${escapeHtml(r.description || '—')}</td>
        <td>${formatDate(r.createdAt)}</td>
        <td><span class="badge badge-pending">PENDING</span></td>
        <td>
          <button class="button button-primary button-sm" onclick="window.__approveShopRequest('${r._id}')">✓ Phê duyệt</button>
          <button class="button button-danger button-sm" onclick="window.__openRejectRequestModal('${r._id}')">Từ chối</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="7" style="text-align: center; color: var(--muted); padding: 30px;">Hiện không có yêu cầu mở shop nào đang chờ duyệt.</td></tr>';
  }

  window.__approveShopRequest = async (id) => {
    try {
      await api(`/admin/shop-requests/${id}/review`, {
        method: 'PATCH',
        body: { status: 'APPROVED' },
      });
      toast('Đã phê duyệt yêu cầu mở shop! Shop đã được tạo tự động.', 'success');
      loadAdminView();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  window.__openRejectRequestModal = (id) => {
    $('#reject-req-id').value = id;
    $('#reject-reason-input').value = '';
    $('#reject-request-dialog').showModal();
  };

  function renderAdminShops() {
    const tbody = $('#admin-shops-table-body');
    tbody.innerHTML = state.adminShops.map((s) => `
      <tr>
        <td><strong>${escapeHtml(s.shopName)}</strong></td>
        <td>${escapeHtml(s.ownerId?.fullName || s.ownerId?.email || '—')}</td>
        <td>${escapeHtml(s.phone || '—')} · ${escapeHtml(s.address || '—')}</td>
        <td><span class="badge ${s.approvalStatus === 'APPROVED' ? 'badge-delivered' : 'badge-cancelled'}">${s.approvalStatus}</span></td>
        <td><span class="badge ${s.operationStatus === 'OPEN' ? 'badge-delivered' : 'badge-unpaid'}">${s.operationStatus}</span></td>
        <td>
          <button class="button ${s.approvalStatus === 'APPROVED' ? 'button-danger' : 'button-primary'} button-sm" onclick="window.__toggleShopApproval('${s._id}', '${s.approvalStatus}')">
            ${s.approvalStatus === 'APPROVED' ? 'Khóa Shop' : 'Mở lại Shop'}
          </button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align: center; color: var(--muted); padding: 30px;">Chưa có shop nào trên sàn.</td></tr>';
  }

  window.__toggleShopApproval = async (shopId, curStatus) => {
    const nextStatus = curStatus === 'APPROVED' ? 'SUSPENDED' : 'APPROVED';
    try {
      await api(`/admin/shops/${shopId}/status`, {
        method: 'PATCH',
        body: { approvalStatus: nextStatus },
      });
      toast(`Đã cập nhật trạng thái shop: ${nextStatus}`, 'success');
      loadAdminView();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  function renderAdminUsers() {
    const tbody = $('#admin-users-table-body');
    const roleFilter = $('#admin-user-role-filter')?.value || '';
    const statusFilter = $('#admin-user-status-filter')?.value || '';
    const keyword = ($('#admin-user-search')?.value || '').toLowerCase().trim();

    let list = [...state.adminUsers];
    if (roleFilter) list = list.filter((u) => u.role === roleFilter);
    if (statusFilter) list = list.filter((u) => u.accountStatus === statusFilter);
    if (keyword) list = list.filter((u) => (u.fullName || '').toLowerCase().includes(keyword) || u.email.toLowerCase().includes(keyword));

    tbody.innerHTML = list.map((u) => `
      <tr>
        <td><strong>${escapeHtml(u.fullName)}</strong></td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.phone || '—')}</td>
        <td><span class="badge badge-confirmed">${u.role}</span></td>
        <td><span class="badge ${u.accountStatus === 'ACTIVE' ? 'badge-delivered' : 'badge-cancelled'}">${u.accountStatus}</span></td>
        <td>${formatDate(u.createdAt)}</td>
        <td>
          ${u.role !== 'ADMIN' ? `
            <button class="button ${u.accountStatus === 'ACTIVE' ? 'button-danger' : 'button-primary'} button-sm" onclick="window.__toggleUserStatus('${u._id}', '${u.accountStatus}')">
              ${u.accountStatus === 'ACTIVE' ? 'Khóa TK' : 'Mở khóa'}
            </button>
          ` : '<span style="color: var(--muted); font-size: 12px;">Admin tối cao</span>'}
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="text-align: center; color: var(--muted); padding: 30px;">Không có tài khoản nào.</td></tr>';
  }

  window.__toggleUserStatus = async (userId, curStatus) => {
    const nextStatus = curStatus === 'ACTIVE' ? 'BANNED' : 'ACTIVE';
    try {
      await api(`/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: { accountStatus: nextStatus },
      });
      toast(`Đã đổi trạng thái người dùng sang: ${nextStatus}`, 'success');
      loadAdminView();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  function switchAdminTab(tabName) {
    $$('#admin-subnav .subnav-btn').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.adminTab === tabName);
    });
    $$('.admin-tab-content').forEach((c) => {
      c.hidden = c.id !== `admin-tab-${tabName}`;
    });
  }

  // -------------------------------------------------------------
  // DIALOGS & FORMS SETUP
  // -------------------------------------------------------------
  function openAuthDialog(mode = 'login', msg = '') {
    const dlg = $('#auth-dialog');
    if (!dlg) return;

    $('#btn-auth-mode-login').classList.toggle('is-active', mode === 'login');
    $('#btn-auth-mode-register').classList.toggle('is-active', mode === 'register');
    $('#btn-auth-mode-profile').classList.toggle('is-active', mode === 'profile');

    $('#form-auth-login').hidden = mode !== 'login';
    $('#form-auth-register').hidden = mode !== 'register';
    $('#profile-container').hidden = mode !== 'profile';

    if (state.user && mode === 'profile') {
      $('#prof-name').value = state.user.fullName || '';
      $('#prof-phone').value = state.user.phone || '';
    }

    if (msg) toast(msg, 'info');
    dlg.showModal();
  }

  function setupEventListeners() {
    // Navigation
    $('#main-nav').addEventListener('click', (e) => {
      const btn = e.target.closest('.nav-tab');
      if (btn && btn.dataset.view) switchView(btn.dataset.view);
    });

    window.__switchTab = switchView;

    // Quick Demo Role Switcher
    $('#quick-demo-select').addEventListener('change', (e) => {
      const roleKey = e.target.value;
      if (roleKey) quickLogin(roleKey);
      e.target.value = '';
    });

    // Account Buttons
    $('#account-btn').addEventListener('click', () => {
      if (state.user) openAuthDialog('profile');
      else openAuthDialog('login');
    });

    $('#btn-logout').addEventListener('click', logout);

    // Notification bell
    $('#btn-notifications').addEventListener('click', () => {
      if (!state.token) {
        openAuthDialog('login', 'Vui lòng đăng nhập để xem thông báo');
        return;
      }
      renderNotificationsList();
      $('#notifications-dialog').showModal();
    });

    $('#btn-read-all-noti').addEventListener('click', async () => {
      try {
        await api('/notifications/read-all', { method: 'PATCH' });
        loadNotifications();
        toast('Đã đánh dấu tất cả thông báo là đã đọc', 'success');
      } catch (e) {}
    });

    // Auth Switcher Buttons in Modal
    $('#btn-auth-mode-login').addEventListener('click', () => openAuthDialog('login'));
    $('#btn-auth-mode-register').addEventListener('click', () => openAuthDialog('register'));
    $('#btn-auth-mode-profile').addEventListener('click', () => openAuthDialog('profile'));

    // Login Form Submit
    $('#form-auth-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await api('/auth/login', {
          method: 'POST',
          body: {
            email: $('#login-email').value.trim(),
            password: $('#login-password').value,
          },
        });
        setSession(res.data.token, res.data.user);
        $('#auth-dialog').close();
      } catch (err) {
        toast(`Đăng nhập thất bại: ${err.message}`, 'error');
      }
    });

    // Register Form Submit
    $('#form-auth-register').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await api('/auth/register', {
          method: 'POST',
          body: {
            fullName: $('#reg-name').value.trim(),
            email: $('#reg-email').value.trim(),
            phone: $('#reg-phone').value.trim(),
            password: $('#reg-password').value,
          },
        });
        setSession(res.data.token, res.data.user);
        $('#auth-dialog').close();
      } catch (err) {
        toast(`Đăng ký thất bại: ${err.message}`, 'error');
      }
    });

    // Profile Form Submit
    $('#form-update-profile').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await api('/auth/me', {
          method: 'PATCH',
          body: {
            fullName: $('#prof-name').value.trim(),
            phone: $('#prof-phone').value.trim(),
          },
        });
        state.user = res.data;
        updateNavByRole(state.user.role);
        toast('Đã cập nhật thông tin cá nhân thành công!', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // Change Password Form Submit
    $('#form-change-password').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/auth/me', {
          method: 'PATCH',
          body: {
            currentPassword: $('#pwd-current').value,
            newPassword: $('#pwd-new').value,
          },
        });
        toast('Đã đổi mật khẩu thành công!', 'success');
        $('#pwd-current').value = '';
        $('#pwd-new').value = '';
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // Storefront search & filters
    $('#product-search-input')?.addEventListener('input', renderFilteredProducts);
    $('#product-category-select')?.addEventListener('change', renderFilteredProducts);
    $('#product-shop-select')?.addEventListener('change', renderFilteredProducts);
    $('#product-sort-select')?.addEventListener('change', renderFilteredProducts);
    $('#btn-refresh-products')?.addEventListener('click', loadProducts);

    // Checkout Form Submit
    $('#checkout-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.token) {
        openAuthDialog('login', 'Vui lòng đăng nhập để hoàn tất đặt hàng.');
        return;
      }
      const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'COD';
      const address = $('#checkout-address').value.trim();
      const phone = $('#checkout-phone').value.trim();

      try {
        await api('/orders', {
          method: 'POST',
          body: {
            shippingAddress: address,
            phone,
            paymentMethod,
          },
        });
        toast('🎉 Đặt hàng thành công! Đơn hàng đã được gửi tới người bán.', 'success');
        loadCart();
        switchView('orders');
      } catch (err) {
        toast(`Đặt hàng thất bại: ${err.message}`, 'error');
      }
    });

    $('#btn-clear-cart').addEventListener('click', async () => {
      if (!confirm('Bạn có chắc muốn xóa toàn bộ giỏ hàng?')) return;
      try {
        await api('/cart', { method: 'DELETE' });
        loadCart();
        toast('Đã dọn sạch giỏ hàng', 'info');
      } catch (e) {
        toast(e.message, 'error');
      }
    });

    // Customer order filter buttons
    $('#customer-order-filters')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.subnav-btn');
      if (!btn) return;
      $$('#customer-order-filters .subnav-btn').forEach((b) => b.classList.toggle('is-active', b === btn));
      loadCustomerOrders(btn.dataset.status);
    });

    $('#btn-refresh-customer-orders')?.addEventListener('click', () => loadCustomerOrders());

    // Inventory subtabs
    $('#inv-subnav')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.subnav-btn');
      if (btn && btn.dataset.invTab) switchInvTab(btn.dataset.invTab);
    });

    $('#btn-quick-import-trigger')?.addEventListener('click', () => switchInvTab('import'));
    $('#inv-filter-type')?.addEventListener('change', renderInventoryTransactions);
    $('#inv-filter-product')?.addEventListener('change', renderInventoryTransactions);
    $('#btn-refresh-inventory')?.addEventListener('click', loadInventoryView);

    // Import Stock Form (UC38)
    $('#form-import-stock')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/myshop/inventory/import', {
          method: 'POST',
          body: {
            productId: $('#import-product-select').value,
            quantity: Number($('#import-quantity').value),
            note: $('#import-note').value.trim(),
          },
        });
        toast('Nhập kho thành công! Số lượng tồn kho đã được cộng thêm.', 'success');
        $('#import-quantity').value = '';
        $('#import-note').value = '';
        switchInvTab('transactions');
        loadInventoryView();
      } catch (err) {
        toast(`Nhập kho thất bại: ${err.message}`, 'error');
      }
    });

    // Export Stock Form (UC39)
    $('#form-export-stock')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/myshop/inventory/export', {
          method: 'POST',
          body: {
            productId: $('#export-product-select').value,
            quantity: Number($('#export-quantity').value),
            note: $('#export-note').value.trim(),
          },
        });
        toast('Xuất hủy hàng thành công! Đã trừ số lượng tồn kho.', 'success');
        $('#export-quantity').value = '';
        $('#export-note').value = '';
        switchInvTab('transactions');
        loadInventoryView();
      } catch (err) {
        toast(`Xuất hủy thất bại: ${err.message}`, 'error');
      }
    });

    // Shop order filters
    $('#shop-order-filters')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.subnav-btn');
      if (!btn) return;
      $$('#shop-order-filters .subnav-btn').forEach((b) => b.classList.toggle('is-active', b === btn));
      loadShopOrders(btn.dataset.shopStatus);
    });

    $('#btn-refresh-shop-orders')?.addEventListener('click', () => loadShopOrders());

    // Cancel order form submit (for both Customer and Shop)
    $('#form-confirm-cancel-order')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const orderId = $('#cancel-target-id').value;
      const actor = $('#cancel-target-actor').value;
      const reason = $('#cancel-reason-input').value.trim();

      try {
        if (actor === 'shop') {
          await api(`/myshop/orders/${orderId}/cancel`, {
            method: 'PATCH',
            body: { reason },
          });
          toast('Shop đã hủy đơn thành công! Hệ thống đã tự động nhập lại kho và hoàn tiền.', 'success');
          loadShopOrders();
        } else {
          await api(`/orders/${orderId}/cancel`, {
            method: 'PATCH',
            body: { reason },
          });
          toast('Đã hủy đơn hàng thành công.', 'success');
          loadCustomerOrders();
        }
        $('#cancel-order-dialog').close();
      } catch (err) {
        toast(`Hủy đơn thất bại: ${err.message}`, 'error');
      }
    });

    // Shop Manage subnav
    $('#shop-manage-subnav')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.subnav-btn');
      if (btn && btn.dataset.smTab) switchShopManageTab(btn.dataset.smTab);
    });

    // Shop toggle open / closed
    $('#btn-toggle-shop-op-status')?.addEventListener('click', async () => {
      if (!state.currentShop) return;
      const nextOp = state.currentShop.operationStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
      try {
        await api(`/shops/${state.currentShop._id}`, {
          method: 'PATCH',
          body: { operationStatus: nextOp },
        });
        state.currentShop.operationStatus = nextOp;
        toast(`Cửa hàng hiện: ${nextOp === 'OPEN' ? 'Mở cửa' : 'Tạm đóng cửa'}`, 'success');
        loadShopManageView();
      } catch (e) {
        toast(e.message, 'error');
      }
    });

    // Shop profile form submit
    $('#form-update-shop-profile')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.currentShop) return;
      try {
        await api(`/shops/${state.currentShop._id}`, {
          method: 'PATCH',
          body: {
            shopName: $('#shop-edit-name').value.trim(),
            address: $('#shop-edit-address').value.trim(),
            phone: $('#shop-edit-phone').value.trim(),
            logoUrl: $('#shop-edit-logo').value.trim(),
          },
        });
        toast('Đã lưu thông tin cửa hàng thành công!', 'success');
        loadShopManageView();
      } catch (e) {
        toast(e.message, 'error');
      }
    });

    // Add product modal trigger
    $('#btn-add-product-modal')?.addEventListener('click', () => {
      $('#product-dlg-title').textContent = 'Thêm sản phẩm mới';
      $('#prod-edit-id').value = '';
      $('#prod-name').value = '';
      $('#prod-price').value = '';
      $('#prod-expiry').value = '';
      $('#prod-image-url').value = '';
      $('#prod-desc').value = '';

      $('#prod-category').innerHTML = state.shopCategories.map((c) => `<option value="${c._id}">${escapeHtml(c.categoryName)}</option>`).join('');
      $('#product-form-dialog').showModal();
    });

    // Manage product form submit
    $('#form-manage-product')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = $('#prod-edit-id').value;
      const body = {
        productName: $('#prod-name').value.trim(),
        categoryId: $('#prod-category').value,
        price: Number($('#prod-price').value),
        expiryDate: $('#prod-expiry').value || null,
        productStatus: $('#prod-status').value,
        description: $('#prod-desc').value.trim(),
        images: $('#prod-image-url').value.trim() ? [$('#prod-image-url').value.trim()] : [],
        shopId: state.currentShop?._id,
      };

      try {
        if (editId) {
          await api(`/myshop/products/${editId}`, { method: 'PUT', body });
          toast('Cập nhật sản phẩm thành công!', 'success');
        } else {
          await api('/myshop/products', { method: 'POST', body });
          toast('Thêm sản phẩm mới thành công!', 'success');
        }
        $('#product-form-dialog').close();
        loadShopManageView();
      } catch (err) {
        toast(`Lưu sản phẩm thất bại: ${err.message}`, 'error');
      }
    });

    // Add category modal trigger
    $('#btn-add-category-modal')?.addEventListener('click', () => {
      $('#category-dlg-title').textContent = 'Thêm danh mục mới';
      $('#cat-edit-id').value = '';
      $('#cat-name').value = '';
      $('#cat-desc').value = '';
      $('#category-form-dialog').showModal();
    });

    // Manage category form submit
    $('#form-manage-category')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editId = $('#cat-edit-id').value;
      const body = {
        categoryName: $('#cat-name').value.trim(),
        description: $('#cat-desc').value.trim(),
        shopId: state.currentShop?._id,
      };
      try {
        if (editId) {
          await api(`/myshop/categories/${editId}`, { method: 'PUT', body });
          toast('Cập nhật danh mục thành công!', 'success');
        } else {
          await api('/myshop/categories', { method: 'POST', body });
          toast('Thêm danh mục mới thành công!', 'success');
        }
        $('#category-form-dialog').close();
        loadShopManageView();
      } catch (err) {
        toast(`Lưu danh mục thất bại: ${err.message}`, 'error');
      }
    });

    // Add staff modal trigger
    $('#btn-add-staff-modal')?.addEventListener('click', () => {
      $('#staff-email-input').value = '';
      $('#staff-form-dialog').showModal();
    });

    // Add staff form submit
    $('#form-add-staff')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.currentShop) return;
      try {
        await api(`/shops/${state.currentShop._id}/staff`, {
          method: 'POST',
          body: {
            email: $('#staff-email-input').value.trim(),
            role: $('#staff-role-select').value,
          },
        });
        toast('Đã thêm nhân viên vào shop thành công!', 'success');
        $('#staff-form-dialog').close();
        loadShopManageView();
      } catch (err) {
        toast(`Thêm nhân viên thất bại: ${err.message}`, 'error');
      }
    });

    // Admin subtabs
    $('#admin-subnav')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.subnav-btn');
      if (btn && btn.dataset.adminTab) switchAdminTab(btn.dataset.adminTab);
    });

    $('#btn-refresh-admin')?.addEventListener('click', loadAdminView);

    // Reject request form submit
    $('#form-reject-request')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const reqId = $('#reject-req-id').value;
      const reason = $('#reject-reason-input').value.trim();
      try {
        await api(`/admin/shop-requests/${reqId}/review`, {
          method: 'PATCH',
          body: { status: 'REJECTED', reason },
        });
        toast('Đã từ chối yêu cầu mở shop', 'info');
        $('#reject-request-dialog').close();
        loadAdminView();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // Customer request shop modal
    $('#btn-request-shop-trigger')?.addEventListener('click', () => {
      if (!state.token) {
        openAuthDialog('login', 'Vui lòng đăng nhập để gửi yêu cầu mở shop');
        return;
      }
      $('#req-shop-name').value = '';
      $('#req-shop-desc').value = '';
      $('#shop-request-dialog').showModal();
    });

    // Customer request shop form submit
    $('#form-submit-shop-request')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/shop-requests', {
          method: 'POST',
          body: {
            shopName: $('#req-shop-name').value.trim(),
            description: $('#req-shop-desc').value.trim(),
          },
        });
        toast('Yêu cầu mở shop đã gửi tới Admin phê duyệt!', 'success');
        $('#shop-request-dialog').close();
      } catch (err) {
        toast(`Gửi yêu cầu thất bại: ${err.message}`, 'error');
      }
    });

    // Admin user filters
    $('#admin-user-search')?.addEventListener('input', renderAdminUsers);
    $('#admin-user-role-filter')?.addEventListener('change', renderAdminUsers);
    $('#admin-user-status-filter')?.addEventListener('change', renderAdminUsers);
  }

  // -------------------------------------------------------------
  // INITIALIZATION
  // -------------------------------------------------------------
  async function init() {
    setupEventListeners();
    await initAuth();
    loadProducts();
    loadCart();

    // Periodic notifications check
    setInterval(loadNotifications, 30000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
