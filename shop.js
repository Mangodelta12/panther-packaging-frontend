// shop.js - Shared cart functionality for all shop pages

const API_BASE = 'https://panther-packaging-backend-production.up.railway.app';

// Cart Management
function getCart() {
  const cart = localStorage.getItem('panther-cart');
  return cart ? JSON.parse(cart) : [];
}

function saveCart(cart) {
  localStorage.setItem('panther-cart', JSON.stringify(cart));
  updateCartBadge();
}

function addToCart(productId, productName, price, maxStock) {
  const cart = getCart();
  const existingItem = cart.find(item => item.id === productId);

  if (existingItem) {
    // Check if adding one more exceeds stock
    if (maxStock && existingItem.quantity >= maxStock) {
      showToast(`Cannot add more - only ${maxStock} available!`, 'warning');
      return;
    }
    existingItem.quantity++;
  } else {
    cart.push({
      id: productId,
      name: productName,
      price: price,
      quantity: 1,
      maxStock: maxStock
    });
  }

  saveCart(cart);
  showToast(`${productName} added to cart!`, 'success');
}

function removeFromCart(productId) {
  let cart = getCart();
  cart = cart.filter(item => item.id !== productId);
  saveCart(cart);
}

function updateCartQuantity(productId, newQuantity) {
  const cart = getCart();
  const item = cart.find(item => item.id === productId);
  
  if (item) {
    // Check stock limit
    if (item.maxStock && newQuantity > item.maxStock) {
      showToast(`Only ${item.maxStock} available`, 'warning');
      return false;
    }
    
    if (newQuantity <= 0) {
      removeFromCart(productId);
    } else {
      item.quantity = newQuantity;
      saveCart(cart);
    }
    return true;
  }
  return false;
}

function clearCart() {
  localStorage.removeItem('panther-cart');
  updateCartBadge();
}

function getCartTotal() {
  const cart = getCart();
  return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

function getCartItemCount() {
  const cart = getCart();
  return cart.reduce((count, item) => count + item.quantity, 0);
}

function updateCartBadge() {
  const badge = document.getElementById('cart-count');
  if (badge) {
    const count = getCartItemCount();
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
}


function updateCartTotals() {
  const cart = getCart();
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const subtotalEl = document.getElementById('cart-subtotal');
  const totalEl = document.getElementById('cart-total');
  
  if (subtotalEl) subtotalEl.textContent = `£${subtotal.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `£${subtotal.toFixed(2)}`;
}

// Toast Notifications
function showToast(message, type = 'success') {
  const toast = document.getElementById('cart-toast');
  const messageEl = document.getElementById('toast-message');
  
  if (!toast || !messageEl) return;

  messageEl.textContent = message;
  toast.className = `cart-toast ${type}`;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Validation helpers
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validatePhone(phone) {
  // UK phone number - basic validation
  const cleaned = phone.replace(/\s/g, '');
  return cleaned.length >= 10 && /^[\d\s\-\+\(\)]+$/.test(phone);
}

function validatePostcode(postcode) {
  // Basic UK postcode validation
  const re = /^[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}$/i;
  return re.test(postcode.trim());
}

// Date helpers
function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMinDeliveryDate() {
  // Minimum 2 days from now for delivery
  const date = new Date();
  date.setDate(date.getDate() + 2);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMinCollectionDate() {
  // Minimum next day for collection
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', { 
    weekday: 'long',
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
}

// Format currency
function formatPrice(amount) {
  return `£${amount.toFixed(2)}`;
}

// ============================================
// PRODUCT LOADING FUNCTIONS (CRITICAL!)
// ============================================

// Load and display products from API
async function loadProducts() {
  const container = document.getElementById('products-container');
  const loading = document.getElementById('products-loading');
  const searchInput = document.getElementById('search-input');
  const filterSelect = document.getElementById('filter-in-stock');
  
  if (!container) return; // Not on products page
  
  try {
    if (loading) loading.style.display = 'block';
    
    // Fetch products from backend API
    const response = await fetch(`${API_BASE}/api/packaging`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const products = await response.json();
    
    if (loading) loading.style.display = 'none';
    
    // Store products globally for filtering
    window.allProducts = products;
    
    // Display products
    displayProducts(products);
    
    // Setup search and filter handlers
    if (searchInput) {
      searchInput.addEventListener('input', filterProducts);
    }
    if (filterSelect) {
      filterSelect.addEventListener('change', filterProducts);
    }
    
  } catch (error) {
    console.error('Error loading products:', error);
    if (loading) loading.style.display = 'none';
    if (container) {
      container.innerHTML = `
        <div style="text-align:center;padding:40px;color:#ef4444;">
          <p style="font-size:18px;margin-bottom:10px;">⚠️ Error Loading Products</p>
          <p style="color:#6b7280;">Could not connect to server. Please try again later.</p>
        </div>
      `;
    }
  }
}

// Display products on page
function displayProducts(products) {
  const container = document.getElementById('products-container');
  if (!container) return;
  
  if (!products || products.length === 0) {
    container.innerHTML = '<p style="text-align:center;padding:40px;color:#6b7280;">No products found.</p>';
    return;
  }
  
  container.innerHTML = products.map(product => createProductCard(product)).join('');
}

// Create HTML for a single product card
function createProductCard(product) {
  const stockBadge = getStockBadge(product.stock, product.lowStockThreshold);
  const imageUrl = product.image || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f3f4f6" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="40" fill="%239ca3af"%3E📦%3C/text%3E%3C/svg%3E';
  
  return `
    <div class="product-card" data-product-id="${product.id}">
      <div class="product-image">
        <img src="${imageUrl}" alt="${product.name}" loading="lazy">
        ${stockBadge}
      </div>
      <div class="product-info">
        <h3 class="product-name">${product.name}</h3>
        <p class="product-description">${product.description || ''}</p>
        <div class="product-footer">
          <span class="product-price">£${product.price.toFixed(2)}</span>
          ${product.stock > 0 
            ? `<button class="add-to-cart-btn" onclick="addToCart('${product.id}', '${product.name.replace(/'/g, "\\'")}', ${product.price}, ${product.stock})">
                 Add to Cart
               </button>`
            : `<button class="add-to-cart-btn" disabled style="background:#9ca3af;cursor:not-allowed;">
                 Out of Stock
               </button>`
          }
        </div>
      </div>
    </div>
  `;
}

// Get stock badge HTML
function getStockBadge(stock, threshold = 10) {
  if (stock === 0) {
    return '<span class="stock-badge out-of-stock">Out of Stock</span>';
  } else if (stock < threshold) {
    return `<span class="stock-badge low-stock">Only ${stock} left!</span>`;
  } else if (stock < threshold * 2) {
    return `<span class="stock-badge limited-stock">Limited Stock</span>`;
  } else {
    return '<span class="stock-badge in-stock">In Stock</span>';
  }
}

// Filter products based on search and stock filter
function filterProducts() {
  const searchInput = document.getElementById('search-input');
  const filterSelect = document.getElementById('filter-in-stock');
  
  if (!window.allProducts) return;
  
  let filtered = window.allProducts;
  
  // Apply search filter
  if (searchInput && searchInput.value) {
    const searchTerm = searchInput.value.toLowerCase();
    filtered = filtered.filter(product => 
      product.name.toLowerCase().includes(searchTerm) ||
      (product.description && product.description.toLowerCase().includes(searchTerm))
    );
  }
  
  // Apply stock filter
  if (filterSelect && filterSelect.value === 'in-stock') {
    filtered = filtered.filter(product => product.stock > 0);
  }
  
  displayProducts(filtered);
}
