const state = {
  categories: [],
  products: [],
  shops: new Map(),
  editingId: null,
  deletingId: null,
  view: 'categories',
};

const elements = {
  notice: document.querySelector('#notice'),
  connection: document.querySelector('#connection-status'),
  connectionLabel: document.querySelector('#connection-label'),
  categoryRows: document.querySelector('#category-rows'),
  categoryCount: document.querySelector('#category-count'),
  listSummary: document.querySelector('#list-summary'),
  categorySearch: document.querySelector('#category-search'),
  shopFilter: document.querySelector('#shop-filter'),
  statusFilter: document.querySelector('#status-filter'),
  form: document.querySelector('#category-form'),
  formPanel: document.querySelector('.form-panel'),
  formTitle: document.querySelector('#form-title'),
  formKicker: document.querySelector('#form-kicker'),
  formShop: document.querySelector('#form-shop'),
  shopOptions: document.querySelector('#shop-options'),
  formName: document.querySelector('#form-name'),
  formDescription: document.querySelector('#form-description'),
  formStatus: document.querySelector('#form-status'),
  formMessage: document.querySelector('#form-message'),
  saveButton: document.querySelector('#save-category'),
  cancelEdit: document.querySelector('#cancel-edit'),
  productGrid: document.querySelector('#product-grid'),
  productSearch: document.querySelector('#product-search'),
  productCategoryFilter: document.querySelector('#product-category-filter'),
  productShopFilter: document.querySelector('#product-shop-filter'),
};

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

const getId = (value) => value && typeof value === 'object' ? String(value._id || value) : String(value || '');

async function api(path, options = {}) {
  const token = sessionStorage.getItem('fruitToken');
  const url = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Yêu cầu thất bại (${response.status})`);
  return body;
}

function showNotice(message, type = 'success') {
  elements.notice.textContent = message;
  elements.notice.className = `notice is-${type}`;
  elements.notice.hidden = false;
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => { elements.notice.hidden = true; }, 5200);
}

function setConnection(stateName, label) {
  elements.connection.dataset.state = stateName;
  elements.connectionLabel.textContent = label;
}

function getShopName(shopId) {
  return state.shops.get(getId(shopId)) || `Shop ${getId(shopId).slice(-5)}`;
}

function buildShops() {
  state.shops = new Map();
  state.products.forEach((product) => {
    const id = getId(product.shopId);
    if (id) state.shops.set(id, product.shopName || getShopName(id));
  });
  state.categories.forEach((category) => {
    const id = getId(category.shopId);
    if (id && !state.shops.has(id)) state.shops.set(id, getShopName(id));
  });

  const options = [...state.shops.entries()].sort((a, b) => a[1].localeCompare(b[1], 'vi'));
  const currentCategoryShop = elements.shopFilter.value;
  const currentProductShop = elements.productShopFilter.value;
  const shopOptions = options.map(([id, name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join('');

  elements.shopFilter.innerHTML = `<option value="">Tất cả shop</option>${shopOptions}`;
  elements.productShopFilter.innerHTML = `<option value="">Tất cả shop</option>${shopOptions}`;
  if (state.shops.has(currentCategoryShop)) elements.shopFilter.value = currentCategoryShop;
  if (state.shops.has(currentProductShop)) elements.productShopFilter.value = currentProductShop;
  elements.shopOptions.innerHTML = options
    .map(([id, name]) => `<option value="${escapeHtml(id)}" label="${escapeHtml(name)}"></option>`)
    .join('');

  const currentCategory = elements.productCategoryFilter.value;
  const categoryOptions = [...state.categories]
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName, 'vi'))
    .map((category) => `<option value="${escapeHtml(category._id)}">${escapeHtml(category.categoryName)}</option>`)
    .join('');
  elements.productCategoryFilter.innerHTML = `<option value="">Tất cả danh mục</option>${categoryOptions}`;
  if (state.categories.some((category) => category._id === currentCategory)) {
    elements.productCategoryFilter.value = currentCategory;
  }
}

function categoryProductCount(categoryId) {
  const id = getId(categoryId);
  return state.products.filter((product) => getId(product.categoryId) === id).length;
}

function getVisibleCategories() {
  const query = elements.categorySearch.value.trim().toLocaleLowerCase('vi');
  const shopId = elements.shopFilter.value;
  const status = elements.statusFilter.value;
  return state.categories.filter((category) => {
    const matchesName = !query || `${category.categoryName} ${category.description || ''}`.toLocaleLowerCase('vi').includes(query);
    return matchesName
      && (!shopId || getId(category.shopId) === shopId)
      && (!status || category.status === status);
  });
}

function renderMetrics() {
  document.querySelector('#metric-total').textContent = state.categories.length;
  document.querySelector('#metric-active').textContent = state.categories.filter((category) => category.status === 'ACTIVE').length;
  document.querySelector('#metric-products').textContent = state.products.length;
  document.querySelector('#product-view-total').textContent = state.products.length;
}

function renderCategories() {
  const categories = getVisibleCategories();
  elements.categoryCount.textContent = `${state.categories.length} danh mục trong hệ thống`;
  elements.listSummary.textContent = `Đang hiển thị ${categories.length} / ${state.categories.length}`;

  if (!categories.length) {
    elements.categoryRows.innerHTML = '<tr><td class="empty-row" colspan="5"><strong>Chưa có kết quả phù hợp</strong><span>Thử đổi bộ lọc hoặc tạo danh mục mới.</span></td></tr>';
    return;
  }

  elements.categoryRows.innerHTML = categories.map((category) => {
    const id = escapeHtml(category._id);
    const active = category.status === 'ACTIVE';
    const actions = state.deletingId === category._id
      ? `<div class="row-confirm"><span>Xóa?</span><button class="table-action danger" data-action="confirm-delete" data-id="${id}" type="button">Có</button><button class="table-action" data-action="cancel-delete" type="button">Không</button></div>`
      : `<div class="row-actions"><button class="table-action" data-action="edit" data-id="${id}" type="button">Sửa</button><button class="table-action danger" data-action="delete" data-id="${id}" type="button">Xóa</button></div>`;

    return `<tr class="category-row${state.editingId === category._id ? ' is-editing' : ''}">
      <td><span class="category-name" title="${escapeHtml(category.categoryName)}">${escapeHtml(category.categoryName)}</span><span class="category-description" title="${escapeHtml(category.description || '')}">${escapeHtml(category.description || 'Chưa có mô tả')}</span></td>
      <td><span class="shop-name" title="${escapeHtml(getShopName(category.shopId))}">${escapeHtml(getShopName(category.shopId))}</span></td>
      <td><span class="product-count">${categoryProductCount(category._id)}</span></td>
      <td><span class="status-pill ${active ? 'status-active' : 'status-inactive'}">${active ? 'Hoạt động' : 'Đã ẩn'}</span></td>
      <td>${actions}</td>
    </tr>`;
  }).join('');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function productStatus(product) {
  if (product.productStatus === 'HIDDEN') return 'Đã ẩn';
  if (product.productStatus === 'OUT_OF_STOCK' || Number(product.stockQuantity) <= 0) return 'Hết hàng';
  return 'Đang bán';
}

function renderProducts() {
  const query = elements.productSearch.value.trim().toLocaleLowerCase('vi');
  const categoryId = elements.productCategoryFilter.value;
  const shopId = elements.productShopFilter.value;
  const products = state.products.filter((product) => {
    const matchesName = !query || `${product.productName} ${product.description || ''}`.toLocaleLowerCase('vi').includes(query);
    return matchesName
      && (!categoryId || getId(product.categoryId) === categoryId)
      && (!shopId || getId(product.shopId) === shopId);
  });

  if (!products.length) {
    elements.productGrid.innerHTML = '<div class="product-empty"><strong>Không tìm thấy sản phẩm</strong>Hãy thử thay đổi từ khóa hoặc bộ lọc.</div>';
    return;
  }

  elements.productGrid.innerHTML = products.map((product) => {
    const image = Array.isArray(product.images) ? product.images.find((url) => /^https?:\/\//i.test(url)) : '';
    const status = productStatus(product);
    const outOfStock = status === 'Hết hàng' || status === 'Đã ẩn';
    const imageMarkup = image
      ? `<img class="product-photo" src="${escapeHtml(image)}" alt="${escapeHtml(product.productName)}" loading="lazy" />`
      : '<div class="product-placeholder" aria-hidden="true">✿</div>';
    return `<article class="product-card" data-product-id="${escapeHtml(product._id)}">
      <div class="product-image-wrap">${imageMarkup}<span class="product-image-tag">${escapeHtml(status)}</span></div>
      <div class="product-info">
        <p class="product-category">${escapeHtml(product.categoryName || 'Chưa phân loại')}</p>
        <h3>${escapeHtml(product.productName)}</h3>
        <p class="product-shop">${escapeHtml(product.shopName || 'Chưa có shop')}</p>
        <div class="product-bottom"><strong class="product-price">${formatCurrency(product.price)}</strong><span class="stock-note${outOfStock ? ' is-out' : ''}"><i class="stock-dot"></i>${Number(product.stockQuantity) || 0} còn</span></div>
      </div>
    </article>`;
  }).join('');

  elements.productGrid.querySelectorAll('.product-photo').forEach((image) => {
    image.addEventListener('error', () => {
      const placeholder = document.createElement('div');
      placeholder.className = 'product-placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.textContent = '✿';
      image.replaceWith(placeholder);
    }, { once: true });
  });
}

function renderAll() {
  buildShops();
  renderMetrics();
  renderCategories();
  renderProducts();
}

async function loadData({ quiet = false } = {}) {
  const refresh = document.querySelector('#refresh-data');
  refresh.disabled = true;
  if (!quiet) elements.categoryRows.innerHTML = '<tr><td class="table-loading" colspan="5">Đang lấy danh mục…</td></tr>';

  const [categoryResult, productResult] = await Promise.allSettled([
    api('/categories?limit=100'),
    api('/products'),
  ]);

  if (categoryResult.status === 'fulfilled') {
    state.categories = Array.isArray(categoryResult.value.data) ? categoryResult.value.data : [];
  }
  if (productResult.status === 'fulfilled') {
    const val = productResult.value;
    const pData = val && val.data;
    state.products = Array.isArray(pData && pData.items) ? pData.items : (Array.isArray(pData) ? pData : (Array.isArray(val) ? val : []));
  }

  const failures = [categoryResult, productResult].filter((result) => result.status === 'rejected');
  if (!failures.length) {
    setConnection('connected', 'API đã kết nối');
    if (!quiet) elements.notice.hidden = true;
  } else {
    setConnection('error', 'Lỗi kết nối API');
    showNotice(failures.map((failure) => failure.reason.message).join(' · '), 'error');
  }

  renderAll();
  if (categoryResult.status === 'rejected' && !state.categories.length) {
    elements.categoryRows.innerHTML = '<tr><td class="empty-row" colspan="5"><strong>Không tải được danh mục</strong><span>Kiểm tra server và kết nối MongoDB rồi thử tải lại.</span></td></tr>';
  }
  if (productResult.status === 'rejected' && !state.products.length) {
    elements.productGrid.innerHTML = '<div class="product-empty"><strong>Không tải được sản phẩm</strong>Kiểm tra API Product rồi thử tải lại.</div>';
  }
  refresh.disabled = false;
}

function resetForm() {
  state.editingId = null;
  elements.form.reset();
  elements.formStatus.value = 'ACTIVE';
  elements.formShop.value = '';
  elements.formTitle.textContent = 'Thêm danh mục';
  elements.formKicker.textContent = 'Tạo mới';
  elements.saveButton.innerHTML = 'Lưu danh mục <span aria-hidden="true">↗</span>';
  elements.cancelEdit.hidden = true;
  elements.formMessage.textContent = '';
  elements.formMessage.className = 'form-message';
  elements.formPanel.classList.remove('is-open');
  buildShops();
}

function startEdit(id) {
  const category = state.categories.find((item) => item._id === id);
  if (!category) return;
  state.editingId = id;
  state.deletingId = null;
  elements.formShop.value = getId(category.shopId);
  elements.formName.value = category.categoryName || '';
  elements.formDescription.value = category.description || '';
  elements.formStatus.value = category.status || 'ACTIVE';
  elements.formTitle.textContent = 'Chỉnh sửa danh mục';
  elements.formKicker.textContent = 'Cập nhật';
  elements.saveButton.innerHTML = 'Lưu thay đổi <span aria-hidden="true">↗</span>';
  elements.cancelEdit.hidden = false;
  elements.formMessage.textContent = '';
  elements.formPanel.classList.add('is-open');
  renderCategories();
  elements.formName.focus();
  elements.formPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

elements.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const shopId = elements.formShop.value;
  const categoryName = elements.formName.value.trim();
  const description = elements.formDescription.value.trim();
  const status = elements.formStatus.value;

  if (!shopId || !categoryName) {
    elements.formMessage.textContent = 'Chọn shop và nhập tên danh mục.';
    return;
  }

  elements.saveButton.disabled = true;
  elements.formMessage.textContent = '';
  try {
    if (state.editingId) {
      await api(`/categories/${encodeURIComponent(state.editingId)}`, {
        method: 'PUT',
        body: JSON.stringify({ categoryName, description, status }),
      });
      resetForm();
      await loadData({ quiet: true });
      showNotice('Đã cập nhật danh mục.');
    } else {
      await api('/categories', {
        method: 'POST',
        body: JSON.stringify({ shopId, categoryName, description, status }),
      });
      resetForm();
      await loadData({ quiet: true });
      showNotice('Đã tạo danh mục mới.');
    }
  } catch (error) {
    elements.formMessage.textContent = error.message;
  } finally {
    elements.saveButton.disabled = false;
  }
});

elements.categoryRows.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;

  if (action === 'edit') return startEdit(id);
  if (action === 'delete') {
    state.deletingId = id;
    renderCategories();
    return;
  }
  if (action === 'cancel-delete') {
    state.deletingId = null;
    renderCategories();
    return;
  }
  if (action === 'confirm-delete') {
    button.disabled = true;
    try {
      await api(`/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
      state.deletingId = null;
      if (state.editingId === id) resetForm();
      await loadData({ quiet: true });
      showNotice('Đã xóa danh mục.');
    } catch (error) {
      state.deletingId = null;
      renderCategories();
      showNotice(error.message, 'error');
    }
  }
});

document.querySelector('#new-category').addEventListener('click', () => {
  resetForm();
  elements.formPanel.classList.add('is-open');
  elements.formName.focus();
  elements.formPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

elements.cancelEdit.addEventListener('click', resetForm);
document.querySelector('#refresh-data').addEventListener('click', () => loadData());
elements.categorySearch.addEventListener('input', renderCategories);
elements.shopFilter.addEventListener('change', renderCategories);
elements.statusFilter.addEventListener('change', renderCategories);
elements.productSearch.addEventListener('input', renderProducts);
elements.productCategoryFilter.addEventListener('change', renderProducts);
elements.productShopFilter.addEventListener('change', renderProducts);

document.querySelectorAll('.nav-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    state.view = tab.dataset.view;
    document.querySelectorAll('.nav-tab').forEach((item) => {
      const active = item === tab;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.view').forEach((view) => {
      const active = view.id === `${state.view}-view`;
      view.classList.toggle('is-visible', active);
      view.hidden = !active;
    });
  });
});

loadData();
