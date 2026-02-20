// track.js - Order Tracking Functionality

document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  setupTrackingForm();
  
  // Check if order number in URL
  const urlParams = new URLSearchParams(window.location.search);
  const orderNumber = urlParams.get('order');
  if (orderNumber) {
    document.getElementById('order-number-input').value = orderNumber;
    trackOrder();
  }
});

function setupTrackingForm() {
  const input = document.getElementById('order-number-input');
  const button = document.getElementById('track-button');

  // Track on button click
  button.addEventListener('click', trackOrder);

  // Track on Enter key
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      trackOrder();
    }
  });

  // Auto-format order number
  input.addEventListener('input', (e) => {
    let value = e.target.value.toUpperCase();
    // Remove any non-alphanumeric except hyphens
    value = value.replace(/[^A-Z0-9-]/g, '');
    e.target.value = value;
  });
}

async function trackOrder() {
  const orderNumber = document.getElementById('order-number-input').value.trim();
  const errorEl = document.getElementById('search-error');

  errorEl.textContent = '';

  if (!orderNumber) {
    errorEl.textContent = 'Please enter an order number';
    return;
  }

  // Validate format (PKG-YYYYMMDD-XXXX)
  if (!/^PKG-\d{8}-\d{4}$/.test(orderNumber)) {
    errorEl.textContent = 'Invalid order number format (should be PKG-YYYYMMDD-XXXX)';
    return;
  }

  showLoading(true);

  try {
    const response = await fetch(`${API_BASE}/api/packaging-shop/orders/${orderNumber}`);
    
    if (response.status === 404) {
      showNotFound();
      return;
    }

    if (!response.ok) {
      throw new Error('Failed to fetch order');
    }

    const order = await response.json();
    displayOrder(order);

  } catch (error) {
    console.error('Tracking error:', error);
    errorEl.textContent = 'Error loading order. Please try again.';
    showLoading(false);
  }
}

function showLoading(show) {
  document.getElementById('loading-state').style.display = show ? 'block' : 'none';
  document.getElementById('order-not-found').style.display = 'none';
  document.getElementById('order-details').style.display = 'none';
  document.querySelector('.track-search').style.display = show ? 'none' : 'block';
}

function showNotFound() {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('order-not-found').style.display = 'block';
  document.getElementById('order-details').style.display = 'none';
  document.querySelector('.track-search').style.display = 'none';
}

function displayOrder(order) {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('order-not-found').style.display = 'none';
  document.getElementById('order-details').style.display = 'block';
  document.querySelector('.track-search').style.display = 'none';

  // Order header
  document.getElementById('detail-order-number').textContent = order.orderNumber;
  
  const orderDate = new Date(order.createdAt);
  document.getElementById('detail-order-date').textContent = formatDate(orderDate.toISOString().split('T')[0]);

  // Status badge
  const statusBadge = document.getElementById('detail-status-badge');
  statusBadge.className = `order-status-badge ${order.orderStatus}`;
  statusBadge.textContent = order.orderStatus.toUpperCase();

  // Status timeline
  renderTimeline(order);

  // Customer details
  document.getElementById('detail-customer-name').textContent = order.customerName;
  document.getElementById('detail-customer-email').textContent = order.customerEmail;
  document.getElementById('detail-customer-phone').textContent = order.customerPhone || 'Not provided';

  // Fulfillment details
  renderFulfillmentDetails(order);

  // Order items
  renderOrderItems(order);
}

function renderTimeline(order) {
  const timeline = document.getElementById('status-timeline');
  
  const statuses = [
    { key: 'new', icon: '📝', label: 'Order Placed' },
    { key: 'confirmed', icon: '✓', label: 'Order Confirmed' },
    { key: 'preparing', icon: '📦', label: 'Preparing Order' },
    { key: 'ready', icon: '✓', label: 'Ready for ' + (order.fulfillmentType === 'delivery' ? 'Delivery' : 'Collection') },
    { key: 'dispatched', icon: order.fulfillmentType === 'delivery' ? '🚚' : '🏢', label: order.fulfillmentType === 'delivery' ? 'Out for Delivery' : 'Ready for Pickup' },
    { key: 'completed', icon: '✓', label: 'Completed' }
  ];

  const currentStatusIndex = statuses.findIndex(s => s.key === order.orderStatus);

  timeline.innerHTML = statuses.map((status, index) => {
    const isActive = index === currentStatusIndex;
    const isCompleted = index < currentStatusIndex;
    const statusClass = isCompleted ? 'completed' : isActive ? 'active' : '';

    // Find update for this status
    const update = order.trackingUpdates?.find(u => u.status === status.key);
    const dateText = update ? new Date(update.timestamp).toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : '';

    return `
      <div class="timeline-step ${statusClass}">
        <div class="timeline-icon">${status.icon}</div>
        <div class="timeline-content">
          <div class="timeline-title">${status.label}</div>
          ${dateText ? `<div class="timeline-date">${dateText}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderFulfillmentDetails(order) {
  const card = document.getElementById('fulfillment-card');
  
  if (order.fulfillmentType === 'delivery') {
    card.innerHTML = `
      <h4>🚚 Delivery Details</h4>
      <div class="info-content">
        <p><strong>Address:</strong></p>
        <p>
          ${order.deliveryAddress.line1}<br>
          ${order.deliveryAddress.line2 ? order.deliveryAddress.line2 + '<br>' : ''}
          ${order.deliveryAddress.city}, ${order.deliveryAddress.postcode}
        </p>
        <p><strong>Delivery Date:</strong> ${formatDate(order.deliveryDate)}</p>
        <p><strong>Time Slot:</strong> ${order.deliveryTimeSlot}</p>
        ${order.deliveryInstructions ? `<p><strong>Instructions:</strong> ${order.deliveryInstructions}</p>` : ''}
      </div>
    `;
  } else {
    card.innerHTML = `
      <h4>🏢 Collection Details</h4>
      <div class="info-content">
        <p><strong>Collection Date:</strong> ${formatDate(order.collectionDate)}</p>
        <p><strong>Time Slot:</strong> ${order.collectionTimeSlot}</p>
        <div class="collection-address">
          <strong>📍 Collect From:</strong><br>
          Panther Truck Rental Ltd<br>
          Quarry Lane Industrial Estate<br>
          Chichester, West Sussex, PO19 8PQ
        </div>
      </div>
    `;
  }
}

function renderOrderItems(order) {
  const itemsList = document.getElementById('detail-items-list');
  
  itemsList.innerHTML = order.items.map(item => `
    <div class="item-row">
      <div class="item-info">
        <div class="item-name">${item.name}</div>
        <div class="item-quantity">Quantity: ${item.quantity} × £${item.price.toFixed(2)}</div>
      </div>
      <div class="item-price">£${(item.price * item.quantity).toFixed(2)}</div>
    </div>
  `).join('');

  document.getElementById('detail-subtotal').textContent = `£${order.subtotal.toFixed(2)}`;
  document.getElementById('detail-delivery-fee').textContent = order.deliveryFee > 0 ? `£${order.deliveryFee.toFixed(2)}` : 'Free';
  document.getElementById('detail-total').textContent = `£${order.total.toFixed(2)}`;
}

function resetSearch() {
  document.getElementById('order-number-input').value = '';
  document.querySelector('.track-search').style.display = 'block';
  document.getElementById('order-not-found').style.display = 'none';
  document.getElementById('order-details').style.display = 'none';
  document.getElementById('search-error').textContent = '';
  
  // Remove order parameter from URL
  const url = new URL(window.location);
  url.searchParams.delete('order');
  window.history.replaceState({}, '', url);
}
