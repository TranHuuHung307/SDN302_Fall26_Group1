/**
 * Customer Shopping & Order Management
 * Implements UC30 to UC37 for Fruit Fresh Commerce Platform
 */
(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  const tokenKey = 'fruitToken';
  const token = () => sessionStorage.getItem(tokenKey);
  const role = () => sessionStorage.getItem('fruitRole');
  const userFullName = () => sessionStorage.getItem('fruitName');
  const userPhone = () => sessionStorage.getItem('fruitPhone') || '';

  const escapeHtml = (value = '') =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c],
    );

  const money = (value) =>
    new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString('vi-VN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
  };

  async function api(path, options = {}) {
    const url = path.startsWith('/api')
      ? path
      : `/api${path.startsWith('/') ? path : '/' + path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        ...options.headers,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || `Yêu cầu thất bại (${response.status})`);
    }
    return data;
  }

  function notify(message, type = 'success') {
    const box = $('#notice');
    if (!box) return;
    box.textContent = message;
    box.hidden = false;
    box.className = `notice is-${type}`;
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => {
      box.hidden = true;
    }, 5000);
  }

  function switchTab(viewName) {
    $$('.nav-tab').forEach((tab) => {
      const active = tab.dataset.view === viewName;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    $$('.view').forEach((view) => {
      const active = view.id === `${viewName}-view`;
      view.classList.toggle('is-visible', active);
      view.hidden = !active;
    });
  }

  /* ==========================================================================
     AUTH & ACCOUNT STATE
     ========================================================================== */
  let authMode = 'login';

  function renderAccountUI() {
    const loggedIn = Boolean(token());
    const isCustomer = role() === 'CUSTOMER';
    const isOwnerOrAdmin = ['ADMIN', 'SHOP_OWNER'].includes(role());

    const accountTrigger = $('#account-label');
    const accountLogout = $('#account-logout');
    const categoriesTab = $('#categories-tab');
    const phoneInput = $('#shipping-phone');

    if (accountTrigger) {
      if (loggedIn) {
        accountTrigger.textContent = userFullName() || 'Tài khoản';
        accountTrigger.classList.add('is-signed-in');
      } else {
        accountTrigger.textContent = 'Đăng nhập / Đăng ký';
        accountTrigger.classList.remove('is-signed-in');
      }
    }

    if (accountLogout) accountLogout.hidden = !loggedIn;
    if (categoriesTab) categoriesTab.hidden = !loggedIn || !isOwnerOrAdmin;

    if (phoneInput && userPhone() && !phoneInput.value) {
      phoneInput.value = userPhone();
    }
  }

  function setAuthMode(mode) {
    authMode = mode;
    const registering = mode === 'register';
    $('#name-row').hidden = !registering;
    $('#phone-row').hidden = !registering;
    $('#account-name').required = registering;
    $('#account-submit').textContent = registering
      ? 'Tạo tài khoản'
      : 'Đăng nhập';
    $('#auth-title').textContent = registering
      ? 'Tạo tài khoản của bạn'
      : 'Chào mừng bạn trở lại';
    $('#auth-intro').textContent = registering
      ? 'Đăng ký tài khoản để mua sắm và theo dõi đơn hàng.'
      : 'Đăng nhập để mua trái cây và quản lý đơn hàng.';
    $('#auth-message').textContent = '';
    $('#login-mode').classList.toggle('is-active', !registering);
    $('#register-mode').classList.toggle('is-active', registering);
    $('#login-mode').setAttribute('aria-selected', String(!registering));
    $('#register-mode').setAttribute('aria-selected', String(registering));
  }

  function openAuth(mode = 'login', message = '') {
    setAuthMode(mode);
    $('#auth-dialog').showModal();
    if (message) $('#auth-message').textContent = message;
    window.setTimeout(
      () =>
        (mode === 'register'
          ? $('#account-name')
          : $('#account-email')
        ).focus(),
      0,
    );
  }

  /* ==========================================================================
     UC30: THÊM SẢN PHẨM VÀO GIỎ HÀNG
     ========================================================================== */
  function enhanceProductCards() {
    const grid = $('#product-grid');
    if (!grid) return;

    grid.querySelectorAll('.product-card[data-product-id]').forEach((card) => {
      if (card.querySelector('.product-cart-action')) return;

      const productId = card.dataset.productId;
      const stockEl = card.querySelector('.stock-note');
      const isOutOfStock = stockEl && stockEl.classList.contains('is-out');

      const actionWrap = document.createElement('div');
      actionWrap.className = 'product-cart-action';

      if (isOutOfStock) {
        actionWrap.innerHTML = `
          <button class="button button-text" style="width: 100%; border: 1px solid var(--line); color: var(--muted); cursor: not-allowed;" disabled>
            Hết hàng
          </button>
        `;
      } else {
        actionWrap.innerHTML = `
          <div class="qty-stepper">
            <button type="button" class="qty-stepper-btn btn-qty-minus" aria-label="Giảm">−</button>
            <input type="number" class="qty-stepper-val input-card-qty" value="1" min="1" max="99" />
            <button type="button" class="qty-stepper-btn btn-qty-plus" aria-label="Tăng">+</button>
          </div>
          <button type="button" class="button button-primary button-add-cart" data-id="${escapeHtml(productId)}">
            Thêm vào giỏ
          </button>
        `;

        const minusBtn = actionWrap.querySelector('.btn-qty-minus');
        const plusBtn = actionWrap.querySelector('.btn-qty-plus');
        const qtyInput = actionWrap.querySelector('.input-card-qty');

        minusBtn.addEventListener('click', () => {
          const val = parseInt(qtyInput.value, 10) || 1;
          if (val > 1) qtyInput.value = val - 1;
        });

        plusBtn.addEventListener('click', () => {
          const val = parseInt(qtyInput.value, 10) || 1;
          qtyInput.value = val + 1;
        });
      }

      card.querySelector('.product-info')?.append(actionWrap);
    });
  }

  // Lắng nghe sự kiện thêm vào giỏ hàng
  $('#product-grid')?.addEventListener('click', async (event) => {
    const btn = event.target.closest('.button-add-cart');
    if (!btn) return;

    if (!token()) {
      openAuth(
        'login',
        'Vui lòng đăng nhập tài khoản khách hàng để thêm sản phẩm vào giỏ.',
      );
      return;
    }

    const card = btn.closest('.product-card');
    const productId = btn.dataset.id;
    const qtyInput = card.querySelector('.input-card-qty');
    const quantity = parseInt(qtyInput ? qtyInput.value : 1, 10) || 1;
    const productName = card.querySelector('h3')?.textContent || 'Sản phẩm';

    btn.disabled = true;
    try {
      await api('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId, quantity }),
      });
      notify(`Đã thêm ${quantity} × ${productName} vào giỏ hàng!`);
      await loadCart();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Quan sát thay đổi trên product-grid để gắn nút
  const gridEl = $('#product-grid');
  if (gridEl) {
    new MutationObserver(enhanceProductCards).observe(gridEl, {
      childList: true,
      subtree: true,
    });
  }

  /* ==========================================================================
     UC31 & UC32: XEM GIỎ HÀNG, CẬP NHẬT SỐ LƯỢNG & XÓA ITEM
     ========================================================================== */
  let currentCartData = null;

  async function loadCart() {
    if (!token() || role() !== 'CUSTOMER') {
      $('#cart-count').textContent = '0';
      $('#nav-cart-count').textContent = '0';
      return;
    }

    try {
      const res = await api('/cart');
      currentCartData = res.data;

      const totalItems = currentCartData.totalItems || 0;
      $('#cart-count').textContent = String(totalItems);
      $('#nav-cart-count').textContent = String(totalItems);

      renderCart(currentCartData);
    } catch (err) {
      console.error('Lỗi tải giỏ hàng:', err);
    }
  }

  function renderCart(cart) {
    const container = $('#cart-content');
    const checkoutSec = $('#checkout-section');
    if (!container) return;

    if (!cart || !cart.items || cart.items.length === 0) {
      container.innerHTML = `
        <div class="cart-empty-state">
          <div class="cart-empty-icon">🛒</div>
          <h3>Giỏ hàng đang trống</h3>
          <p>Hãy dạo quanh cửa hàng và chọn những loại trái cây tươi ngon bạn thích nhé!</p>
          <button class="button button-primary" id="empty-cart-shop-btn" type="button">
            Khám phá cửa hàng ngay
          </button>
        </div>
      `;
      $('#summary-items-count').textContent = '0';
      $('#summary-shops-count').textContent = '0';
      $('#summary-total-amount').textContent = '0 ₫';
      if (checkoutSec) checkoutSec.hidden = true;

      $('#empty-cart-shop-btn')?.addEventListener('click', () => {
        switchTab('products');
      });
      return;
    }

    if (checkoutSec) checkoutSec.hidden = false;

    // Render danh sách nhóm theo Shop (UC31)
    container.innerHTML = (cart.shops || [])
      .map((group) => {
        const shop = group.shop;
        const shopName = shop?.shopName || 'Cửa hàng';
        const shopAddress = shop?.address ? ` · ${shop.address}` : '';
        const isOpen =
          shop?.approvalStatus === 'APPROVED' && shop?.operationStatus === 'OPEN';
        const statusBadge = isOpen
          ? '<span class="status-tag badge-delivered">Đang mở cửa</span>'
          : '<span class="status-tag badge-cancelled">Tạm đóng</span>';

        const itemsHtml = group.items
          .map((item) => {
            const imgUrl = Array.isArray(item.images) && item.images.length
              ? item.images[0]
              : '';
            const imgTag = imgUrl
              ? `<img class="cart-item-thumb" src="${escapeHtml(imgUrl)}" alt="${escapeHtml(item.productName)}" />`
              : `<div class="cart-item-thumb" style="display:grid;place-items:center;font-size:24px;">✿</div>`;

            return `
            <div class="cart-item-row" data-product-id="${escapeHtml(item.productId)}">
              ${imgTag}
              <div class="cart-item-meta">
                <div class="cart-item-title">${escapeHtml(item.productName)}</div>
                <div class="cart-item-unit-price">${money(item.price)} · Tồn kho: ${item.stockQuantity}</div>
              </div>
              <div class="cart-item-stepper">
                <div class="qty-stepper">
                  <button type="button" class="qty-stepper-btn btn-cart-minus" data-id="${escapeHtml(item.productId)}">−</button>
                  <input type="number" class="qty-stepper-val input-cart-qty" data-id="${escapeHtml(item.productId)}" value="${item.quantity}" min="1" max="${item.stockQuantity}" />
                  <button type="button" class="qty-stepper-btn btn-cart-plus" data-id="${escapeHtml(item.productId)}">+</button>
                </div>
              </div>
              <div class="cart-item-price-wrap">
                <div class="cart-item-subtotal-price">${money(item.subtotal)}</div>
              </div>
              <div class="cart-item-remove">
                <button type="button" class="button-remove-item btn-cart-remove" data-id="${escapeHtml(item.productId)}" title="Xóa món này">
                  🗑️
                </button>
              </div>
            </div>
          `;
          })
          .join('');

        return `
        <article class="cart-shop-group">
          <header class="cart-shop-header">
            <div class="cart-shop-info">
              <div class="cart-shop-icon">🏪</div>
              <div>
                <span class="cart-shop-name">${escapeHtml(shopName)}</span>
                <span class="cart-shop-address">${escapeHtml(shopAddress)}</span>
              </div>
              ${statusBadge}
            </div>
            <div class="cart-shop-subtotal">
              Tạm tính shop: <strong>${money(group.subtotal)}</strong>
            </div>
          </header>
          <div class="cart-shop-items">
            ${itemsHtml}
          </div>
        </article>
      `;
      })
      .join('');

    // Cập nhật tổng kết sidebar
    $('#summary-items-count').textContent = String(cart.totalItems || 0);
    $('#summary-shops-count').textContent = String(cart.shops?.length || 0);
    $('#summary-total-amount').textContent = money(cart.totalAmount || 0);
  }

  // Sự kiện cập nhật số lượng và xóa item trong giỏ (UC32)
  $('#cart-content')?.addEventListener('click', async (event) => {
    const minusBtn = event.target.closest('.btn-cart-minus');
    const plusBtn = event.target.closest('.btn-cart-plus');
    const removeBtn = event.target.closest('.btn-cart-remove');

    if (minusBtn) {
      const productId = minusBtn.dataset.id;
      const input = minusBtn.parentElement.querySelector('.input-cart-qty');
      const currentVal = parseInt(input.value, 10) || 1;
      if (currentVal > 1) {
        await updateCartItemQuantity(productId, currentVal - 1);
      } else {
        if (confirm('Bạn có muốn xóa sản phẩm này khỏi giỏ hàng?')) {
          await removeCartItem(productId);
        }
      }
    } else if (plusBtn) {
      const productId = plusBtn.dataset.id;
      const input = plusBtn.parentElement.querySelector('.input-cart-qty');
      const currentVal = parseInt(input.value, 10) || 1;
      await updateCartItemQuantity(productId, currentVal + 1);
    } else if (removeBtn) {
      const productId = removeBtn.dataset.id;
      await removeCartItem(productId);
    }
  });

  $('#cart-content')?.addEventListener('change', async (event) => {
    const input = event.target.closest('.input-cart-qty');
    if (input) {
      const productId = input.dataset.id;
      const val = parseInt(input.value, 10);
      if (val >= 1) {
        await updateCartItemQuantity(productId, val);
      } else {
        await loadCart();
      }
    }
  });

  async function updateCartItemQuantity(productId, quantity) {
    try {
      await api(`/cart/items/${encodeURIComponent(productId)}`, {
        method: 'PUT',
        body: JSON.stringify({ quantity }),
      });
      await loadCart();
    } catch (err) {
      notify(err.message, 'error');
      await loadCart();
    }
  }

  async function removeCartItem(productId) {
    try {
      await api(`/cart/items/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
      });
      notify('Đã xóa sản phẩm khỏi giỏ hàng.');
      await loadCart();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  $('#clear-all-cart')?.addEventListener('click', async () => {
    if (!currentCartData || !currentCartData.items?.length) return;
    if (confirm('Bạn có chắc chắn muốn làm trống toàn bộ giỏ hàng?')) {
      try {
        await api('/cart', { method: 'DELETE' });
        notify('Đã làm trống giỏ hàng.');
        await loadCart();
      } catch (err) {
        notify(err.message, 'error');
      }
    }
  });

  $('#refresh-cart')?.addEventListener('click', loadCart);

  $('#btn-proceed-checkout')?.addEventListener('click', () => {
    const sec = $('#checkout-section');
    if (sec) {
      sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('#shipping-address')?.focus();
    }
  });

  $('#btn-back-to-shop')?.addEventListener('click', () => {
    switchTab('products');
  });

  $('#shop-request-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('/shop-requests', {
        method: 'POST',
        body: JSON.stringify({
          shopName: $('#request-shop-name').value.trim(),
          description: $('#request-shop-description').value.trim(),
        }),
      });
      notify('Đã gửi yêu cầu mở shop. Quản trị viên sẽ duyệt yêu cầu.');
      event.target.reset();
    } catch (err) {
      notify(err.message, 'error');
    }
  });

  /* ==========================================================================
     UC33: ĐẶT HÀNG (CHECKOUT)
     ========================================================================== */
  // Xử lý radio chọn phương thức thanh toán
  $$('input[name="paymentMethod"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      $$('.payment-radio-card').forEach((card) => {
        const checked = card.querySelector('input').checked;
        card.classList.toggle('is-selected', checked);
      });
    });
  });

  $('#checkout-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = $('#submit-checkout-btn');
    submitBtn.disabled = true;

    try {
      const shippingAddress = $('#shipping-address').value.trim();
      const phone = $('#shipping-phone').value.trim();
      const paymentMethodRadio = $(
        'input[name="paymentMethod"]:checked',
      );
      const paymentMethod = paymentMethodRadio ? paymentMethodRadio.value : 'COD';

      if (!shippingAddress) {
        throw new Error('Vui lòng nhập địa chỉ nhận hàng.');
      }
      if (!phone) {
        throw new Error('Vui lòng nhập số điện thoại nhận hàng.');
      }

      const res = await api('/orders/checkout', {
        method: 'POST',
        body: JSON.stringify({ shippingAddress, phone, paymentMethod }),
      });

      const totalOrdersCreated = res.data?.totalOrders || res.data?.orders?.length || 1;
      notify(
        `Đặt hàng thành công! Đã tạo ${totalOrdersCreated} đơn hàng theo từng Shop.`,
      );

      // Làm mới giỏ hàng
      await loadCart();

      // Chuyển sang màn hình quản lý đơn hàng
      switchTab('orders');
      await loadOrders();

      // Nếu là ONLINE, gợi ý thanh toán
      if (paymentMethod === 'ONLINE' && res.data?.orders?.length) {
        openPaymentModal(res.data.orders[0]);
      }
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  /* ==========================================================================
     UC34: THANH TOÁN ĐƠN HÀNG (GIẢ LẬP TRỰC TUYẾN)
     ========================================================================== */
  let activePayingOrder = null;

  function openPaymentModal(order) {
    if (!order) return;
    activePayingOrder = order;

    $('#pay-order-code').textContent = String(order._id).slice(-6).toUpperCase();
    $('#pay-shop-name').textContent = order.shopId?.shopName || 'Cửa hàng';
    $('#pay-amount').textContent = money(order.totalAmount);

    $('#pay-dialog').showModal();
  }

  $('#pay-close')?.addEventListener('click', () => $('#pay-dialog').close());
  $('#pay-cancel-btn')?.addEventListener('click', () => $('#pay-dialog').close());

  $('#pay-confirm-btn')?.addEventListener('click', async () => {
    if (!activePayingOrder) return;
    const btn = $('#pay-confirm-btn');
    btn.disabled = true;

    try {
      await api(`/orders/${encodeURIComponent(activePayingOrder._id)}/pay`, {
        method: 'POST',
      });
      notify('Thanh toán đơn hàng thành công (PAID)!');
      $('#pay-dialog').close();
      await loadOrders();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  /* ==========================================================================
     UC35: XEM LỊCH SỬ ĐƠN HÀNG
     ========================================================================== */
  let currentOrderStatusFilter = '';

  async function loadOrders() {
    if (!token() || role() !== 'CUSTOMER') return;

    const container = $('#orders-content');
    if (!container) return;

    container.innerHTML = '<div class="product-loading">Đang tải danh sách đơn hàng…</div>';

    try {
      const query = currentOrderStatusFilter
        ? `?orderStatus=${encodeURIComponent(currentOrderStatusFilter)}`
        : '';
      const res = await api(`/orders${query}`);
      const orders = res.data?.items || res.data || [];

      renderOrdersList(orders);
    } catch (err) {
      container.innerHTML = `<div class="product-empty"><strong>Không tải được đơn hàng</strong>${escapeHtml(err.message)}</div>`;
    }
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'PENDING':
        return '<span class="status-tag badge-pending">Chờ xác nhận</span>';
      case 'CONFIRMED':
        return '<span class="status-tag badge-confirmed">Đã xác nhận</span>';
      case 'PREPARING':
        return '<span class="status-tag badge-preparing">Đang đóng gói</span>';
      case 'SHIPPING':
        return '<span class="status-tag badge-shipping">Đang giao hàng</span>';
      case 'DELIVERED':
        return '<span class="status-tag badge-delivered">Đã giao thành công</span>';
      case 'CANCELLED':
        return '<span class="status-tag badge-cancelled">Đã hủy</span>';
      default:
        return `<span class="status-tag">${escapeHtml(status)}</span>`;
    }
  }

  function getPaymentBadge(status, method) {
    let methodText = method === 'ONLINE' ? 'Trực tuyến' : 'COD';
    let statusBadge = '';
    if (status === 'PAID') {
      statusBadge = '<span class="status-tag badge-paid">Đã thanh toán</span>';
    } else if (status === 'REFUNDED') {
      statusBadge = '<span class="status-tag badge-refunded">Đã hoàn tiền</span>';
    } else {
      statusBadge = '<span class="status-tag badge-unpaid">Chưa thanh toán</span>';
    }
    return `${statusBadge} <span class="status-tag" style="background:#f0f2ed;color:#556b5c;">${methodText}</span>`;
  }

  function renderOrdersList(orders) {
    const container = $('#orders-content');
    if (!container) return;

    if (!orders || orders.length === 0) {
      container.innerHTML = `
        <div class="cart-empty-state">
          <div class="cart-empty-icon">📦</div>
          <h3>Chưa có đơn hàng nào</h3>
          <p>Các đơn hàng bạn đã đặt sẽ xuất hiện tại đây để tiện theo dõi tiến trình.</p>
          <button class="button button-primary" id="orders-empty-shop-btn" type="button">
            Mua sắm ngay
          </button>
        </div>
      `;
      $('#orders-empty-shop-btn')?.addEventListener('click', () => switchTab('products'));
      return;
    }

    container.innerHTML = orders
      .map((order) => {
        const orderShortId = String(order._id).slice(-6).toUpperCase();
        const shopName = order.shopId?.shopName || 'Cửa hàng';
        const itemsPreview = (order.items || [])
          .map(
            (it) =>
              `${escapeHtml(it.productName)} <span>(×${it.quantity})</span>`,
          )
          .join(', ');

        const canPay =
          order.paymentMethod === 'ONLINE' &&
          order.paymentStatus === 'UNPAID' &&
          order.orderStatus !== 'CANCELLED';

        const canCancel = order.orderStatus === 'PENDING';

        return `
        <article class="order-card" data-order-id="${escapeHtml(order._id)}">
          <header class="order-card-top">
            <div>
              <span class="order-card-id">#${orderShortId}</span>
              <span class="order-card-date">${formatDate(order.createdAt)}</span>
            </div>
            <div class="order-card-badges">
              ${getStatusBadge(order.orderStatus)}
              ${getPaymentBadge(order.paymentStatus, order.paymentMethod)}
            </div>
          </header>

          <div class="order-card-shop">
            <span>🏪</span> <strong>${escapeHtml(shopName)}</strong>
          </div>

          <div class="order-card-items-preview">
            ${itemsPreview}
          </div>

          <footer class="order-card-bottom">
            <div class="order-card-total">
              Tổng tiền: <strong>${money(order.totalAmount)}</strong>
            </div>
            <div class="order-card-actions">
              <button type="button" class="button button-text btn-view-detail" data-id="${escapeHtml(order._id)}" style="border: 1px solid var(--line); font-size: 12px; min-height: 34px;">
                👁️ Chi tiết & Theo dõi
              </button>
              ${
                canPay
                  ? `<button type="button" class="button button-primary btn-pay-order" data-id="${escapeHtml(order._id)}" style="font-size: 12px; min-height: 34px; background: #2e7d32;">
                      💳 Thanh toán ngay
                    </button>`
                  : ''
              }
              ${
                canCancel
                  ? `<button type="button" class="button button-text btn-cancel-order" data-id="${escapeHtml(order._id)}" style="color: var(--red); font-size: 12px; min-height: 34px;">
                      Hủy đơn
                    </button>`
                  : ''
              }
            </div>
          </footer>
        </article>
      `;
      })
      .join('');
  }

  // Lọc đơn hàng theo trạng thái (UC35)
  $('#orders-filter-bar')?.addEventListener('click', (event) => {
    const pill = event.target.closest('.filter-pill');
    if (!pill) return;

    $$('.filter-pill').forEach((p) => p.classList.remove('is-active'));
    pill.classList.add('is-active');

    currentOrderStatusFilter = pill.dataset.status || '';
    loadOrders();
  });

  $('#refresh-orders')?.addEventListener('click', loadOrders);

  /* ==========================================================================
     UC36: XEM CHI TIẾT & THEO DÕI ĐƠN HÀNG
     ========================================================================== */
  async function showOrderDetail(orderId) {
    try {
      const res = await api(`/orders/${encodeURIComponent(orderId)}`);
      const order = res.data;
      if (!order) return;

      const shortId = String(order._id).slice(-6).toUpperCase();
      $('#detail-order-id').textContent = shortId;
      $('#detail-order-shop').textContent = `Cửa hàng: ${order.shopId?.shopName || '—'}${order.shopId?.phone ? ` · Hotline: ${order.shopId.phone}` : ''}`;
      $('#detail-address').textContent = order.shippingAddress || '—';
      $('#detail-phone').textContent = order.phone || '—';
      $('#detail-payment-method').textContent =
        order.paymentMethod === 'ONLINE'
          ? 'Trực tuyến (ONLINE)'
          : 'Tiền mặt khi nhận (COD)';
      $('#detail-payment-status').innerHTML = getPaymentBadge(
        order.paymentStatus,
        order.paymentMethod,
      );

      // Cập nhật Stepper theo dõi đơn hàng (UC36)
      const stepper = $('#detail-stepper');
      const cancelNotice = $('#detail-cancelled-notice');
      const steps = ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'DELIVERED'];
      const currentIdx = steps.indexOf(order.orderStatus);

      if (order.orderStatus === 'CANCELLED') {
        stepper.hidden = true;
        cancelNotice.hidden = false;
      } else {
        stepper.hidden = false;
        cancelNotice.hidden = true;

        stepper.querySelectorAll('.stepper-step').forEach((stepEl) => {
          const stepName = stepEl.dataset.step;
          const idx = steps.indexOf(stepName);
          stepEl.classList.toggle('is-done', idx < currentIdx);
          stepEl.classList.toggle('is-active', idx === currentIdx);
        });
      }

      // Danh sách món hàng
      const itemsBody = $('#detail-items-body');
      itemsBody.innerHTML = (order.items || [])
        .map(
          (it) => `
        <tr>
          <td><strong>${escapeHtml(it.productName)}</strong></td>
          <td>${money(it.price)}</td>
          <td style="text-align: center;">${it.quantity}</td>
          <td style="text-align: right; font-weight: 700;">${money(it.subtotal)}</td>
        </tr>
      `,
        )
        .join('');

      $('#detail-total-amount').textContent = money(order.totalAmount);

      // Nút hành động trong modal chi tiết
      const actionBox = $('#detail-actions');
      const canPay =
        order.paymentMethod === 'ONLINE' &&
        order.paymentStatus === 'UNPAID' &&
        order.orderStatus !== 'CANCELLED';
      const canCancel = order.orderStatus === 'PENDING';

      actionBox.innerHTML = `
        <button class="button button-text" id="btn-close-detail" type="button">Đóng</button>
        ${
          canCancel
            ? `<button class="button button-text btn-detail-cancel" data-id="${escapeHtml(order._id)}" style="color: var(--red);" type="button">Hủy đơn hàng</button>`
            : ''
        }
        ${
          canPay
            ? `<button class="button button-primary btn-detail-pay" data-id="${escapeHtml(order._id)}" style="background: #2e7d32;" type="button">Thanh toán ngay</button>`
            : ''
        }
      `;

      $('#btn-close-detail')?.addEventListener('click', () => {
        $('#order-detail-dialog').close();
      });

      actionBox.querySelector('.btn-detail-pay')?.addEventListener('click', () => {
        $('#order-detail-dialog').close();
        openPaymentModal(order);
      });

      actionBox.querySelector('.btn-detail-cancel')?.addEventListener('click', () => {
        $('#order-detail-dialog').close();
        openCancelModal(order);
      });

      $('#order-detail-dialog').showModal();
    } catch (err) {
      notify(err.message, 'error');
    }
  }

  $('#detail-close')?.addEventListener('click', () => {
    $('#order-detail-dialog').close();
  });

  /* ==========================================================================
     UC37: KHÁCH HỦY ĐƠN HÀNG
     ========================================================================== */
  let activeCancellingOrder = null;

  function openCancelModal(order) {
    if (!order) return;
    activeCancellingOrder = order;

    $('#cancel-order-code').textContent = `#${String(order._id).slice(-6).toUpperCase()}`;
    $('#cancel-dialog').showModal();
  }

  $('#cancel-close')?.addEventListener('click', () => $('#cancel-dialog').close());
  $('#cancel-abort-btn')?.addEventListener('click', () => $('#cancel-dialog').close());

  $('#cancel-confirm-btn')?.addEventListener('click', async () => {
    if (!activeCancellingOrder) return;
    const btn = $('#cancel-confirm-btn');
    btn.disabled = true;

    try {
      await api(`/orders/${encodeURIComponent(activeCancellingOrder._id)}/cancel`, {
        method: 'PATCH',
      });
      notify('Hủy đơn hàng thành công. Tồn kho đã được hoàn lại!');
      $('#cancel-dialog').close();
      await loadOrders();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Ủy quyền sự kiện trên danh sách đơn hàng
  $('#orders-content')?.addEventListener('click', (event) => {
    const detailBtn = event.target.closest('.btn-view-detail');
    const payBtn = event.target.closest('.btn-pay-order');
    const cancelBtn = event.target.closest('.btn-cancel-order');

    if (detailBtn) {
      showOrderDetail(detailBtn.dataset.id);
    } else if (payBtn) {
      const orderId = payBtn.dataset.id;
      api(`/orders/${encodeURIComponent(orderId)}`).then((res) => {
        openPaymentModal(res.data);
      });
    } else if (cancelBtn) {
      const orderId = cancelBtn.dataset.id;
      api(`/orders/${encodeURIComponent(orderId)}`).then((res) => {
        openCancelModal(res.data);
      });
    }
  });

  /* ==========================================================================
     GLOBAL EVENTS & AUTH DIALOG WIRING
     ========================================================================== */
  $('#account-label')?.addEventListener('click', () => {
    if (!token()) {
      openAuth('login');
    } else {
      switchTab('orders');
      loadOrders();
    }
  });

  $('#cart-trigger')?.addEventListener('click', () => {
    switchTab('cart');
    loadCart();
  });

  $('#account-logout')?.addEventListener('click', () => {
    sessionStorage.removeItem(tokenKey);
    sessionStorage.removeItem('fruitName');
    sessionStorage.removeItem('fruitRole');
    sessionStorage.removeItem('fruitPhone');
    renderAccountUI();
    notify('Bạn đã đăng xuất.');
    loadCart();
  });

  $('#login-mode')?.addEventListener('click', () => setAuthMode('login'));
  $('#register-mode')?.addEventListener('click', () => setAuthMode('register'));
  $('#auth-close')?.addEventListener('click', () => $('#auth-dialog').close());

  $('#account-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = $('#account-submit');
    submitBtn.disabled = true;
    $('#auth-message').textContent = '';

    try {
      const email = $('#account-email').value.trim();
      const password = $('#account-password').value;

      if (authMode === 'register') {
        const fullName = $('#account-name').value.trim();
        const phone = $('#account-phone').value.trim();
        const res = await api('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ fullName, email, password, phone }),
        });

        sessionStorage.setItem(tokenKey, res.data.token);
        sessionStorage.setItem('fruitName', res.data.user.fullName);
        sessionStorage.setItem('fruitRole', res.data.user.role);
        if (res.data.user.phone) {
          sessionStorage.setItem('fruitPhone', res.data.user.phone);
        }

        $('#auth-dialog').close();
        renderAccountUI();
        notify(`Chào mừng ${res.data.user.fullName} đến với Vườn Mùa!`);
        await loadCart();
        return;
      }

      const res = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      sessionStorage.setItem(tokenKey, res.data.token);
      sessionStorage.setItem('fruitName', res.data.user.fullName);
      sessionStorage.setItem('fruitRole', res.data.user.role);
      if (res.data.user.phone) {
        sessionStorage.setItem('fruitPhone', res.data.user.phone);
      }

      $('#auth-dialog').close();
      renderAccountUI();
      notify(`Đăng nhập thành công! Xin chào ${res.data.user.fullName}.`);
      await loadCart();
    } catch (err) {
      $('#auth-message').textContent = err.message;
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Khi click vào các nav-tab, đồng bộ tải dữ liệu tương ứng
  $$('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view;
      if (view === 'cart') loadCart();
      if (view === 'orders') loadOrders();
    });
  });

  // Khởi động
  renderAccountUI();
  enhanceProductCards();
  loadCart();
})();
