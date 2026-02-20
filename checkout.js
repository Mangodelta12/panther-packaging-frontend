// checkout.js - Checkout page functionality with Stripe
// Note: API_BASE is defined in shop.js

// Stripe configuration
const stripe = Stripe('pk_test_tdh8yqcE2gcOtwEaXIrCHfKz');
const elements = stripe.elements();

// Create card element
const cardElement = elements.create('card', {
  hidePostalCode: true,  // ← ADD THIS LINE
  style: {
    base: {
      fontSize: '16px',
      color: '#111827',
      '::placeholder': {
        color: '#9ca3af',
      },
    },
  },
});

let cardMounted = false;
let formData = {};

document.addEventListener('DOMContentLoaded', () => {
  initCheckout();
});

function initCheckout() {
  const cart = getCart();
  
  // Hide empty cart message and show checkout content
  const emptyCartDiv = document.getElementById('empty-cart');
  const checkoutContent = document.getElementById('checkout-content');
  
  if (cart.length === 0) {
    if (emptyCartDiv) emptyCartDiv.style.display = 'block';
    if (checkoutContent) checkoutContent.style.display = 'none';
    return;
  }

  // Cart has items - hide empty message, show checkout
  if (emptyCartDiv) emptyCartDiv.style.display = 'none';
  if (checkoutContent) checkoutContent.style.display = 'block';
  
  // Mount Stripe card element
  if (!cardMounted) {
    cardElement.mount('#card-element');
    cardMounted = true;
  }

  // Handle card errors
  cardElement.on('change', (event) => {
    const displayError = document.getElementById('card-errors');
    if (event.error) {
      displayError.textContent = event.error.message;
    } else {
      displayError.textContent = '';
    }
    validateForm();
  });

  renderOrderSummary(cart);
  setupEventListeners();
  setMinDates();
  
  // Show delivery section if delivery is selected by default
  toggleDeliverySection();
  updateOrderTotal();
  
  // Update cart badge - do this last to ensure DOM is ready
  setTimeout(() => {
    updateCartBadge();
  }, 100);
}

function renderOrderSummary(cart) {
  const itemsList = document.getElementById('order-items');
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  itemsList.innerHTML = cart.map(item => `
    <div class="order-item">
      <div class="item-details">
        <div class="item-name">${item.name}</div>
        <div class="item-quantity">Qty: ${item.quantity} × £${item.price.toFixed(2)}</div>
      </div>
      <div class="item-price">£${(item.price * item.quantity).toFixed(2)}</div>
    </div>
  `).join('');

  updateOrderTotal();
}

function setupEventListeners() {
  // Delivery method toggle - FIXED to use correct name
  document.querySelectorAll('input[name="delivery-method"]').forEach(radio => {
    radio.addEventListener('change', () => {
      toggleDeliverySection();
      updateOrderTotal();
    });
  });

  // Form validation on input
  const inputs = document.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.addEventListener('input', validateForm);
    input.addEventListener('blur', validateForm);
  });

  // Same as billing checkbox
  const sameAsBillingCheckbox = document.getElementById('same-as-billing');
  if (sameAsBillingCheckbox) {
    sameAsBillingCheckbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        // Copy billing address to delivery address
        const billingAddress = document.getElementById('billing-address');
        const billingCity = document.getElementById('billing-city');
        const billingPostcode = document.getElementById('billing-postcode');
        
        const deliveryAddress = document.getElementById('delivery-address');
        const deliveryCity = document.getElementById('delivery-city');
        const deliveryPostcode = document.getElementById('delivery-postcode');
        
        if (billingAddress && deliveryAddress) deliveryAddress.value = billingAddress.value;
        if (billingCity && deliveryCity) deliveryCity.value = billingCity.value;
        if (billingPostcode && deliveryPostcode) deliveryPostcode.value = billingPostcode.value;
        
        validateForm();
      }
    });
  }

  // Submit button
  const submitBtn = document.getElementById('submit-order');
  if (submitBtn) {
    submitBtn.addEventListener('click', handleSubmit);
  }
}

function toggleDeliverySection() {
  const deliveryMethod = document.querySelector('input[name="delivery-method"]:checked');
  const deliverySection = document.getElementById('delivery-address-section');
  
  if (deliveryMethod && deliveryMethod.value === 'delivery' && deliverySection) {
    deliverySection.style.display = 'block';
  } else if (deliverySection) {
    deliverySection.style.display = 'none';
  }
}

function updateOrderTotal() {
  const cart = getCart();
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Check if delivery method radio exists, default to delivery
  const deliveryMethodEl = document.querySelector('input[name="delivery-method"]:checked');
  let deliveryFee = 0;
  if (deliveryMethodEl && deliveryMethodEl.value === 'delivery') {
    deliveryFee = subtotal >= 50 ? 0 : 6.99;  // Free delivery over £50
  }
  const total = subtotal + deliveryFee;

  // Update subtotal
  const subtotalEl = document.getElementById('summary-subtotal');
  if (subtotalEl) subtotalEl.textContent = `£${subtotal.toFixed(2)}`;
  
  // Update delivery fee row
  const deliveryFeeRow = document.getElementById('delivery-fee-row');
  const deliveryEl = document.getElementById('summary-delivery');
  
  if (deliveryFee > 0) {
    if (deliveryFeeRow) deliveryFeeRow.style.display = 'flex';
    if (deliveryEl) deliveryEl.textContent = `£${deliveryFee.toFixed(2)}`;
  } else {
    if (deliveryFeeRow) deliveryFeeRow.style.display = 'none';
  }
  
  // Update total
  const totalEl = document.getElementById('summary-total');
  if (totalEl) totalEl.textContent = `£${total.toFixed(2)}`;
}

function setMinDates() {
  const collectionDate = document.getElementById('collection-date');
  
  
  if (collectionDate) {
    const minDate = getMinCollectionDate();
    collectionDate.min = minDate;
    collectionDate.value = minDate;
  }
}

function validateForm() {
  let isValid = true;

  // Clear all errors
  document.querySelectorAll('.error-message').forEach(el => el.textContent = '');

  // Customer details
  const name = document.getElementById('customer-name').value.trim();
  const email = document.getElementById('customer-email').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();

  if (!name) {
    isValid = false;
  }

  if (!email || !validateEmail(email)) {
    if (email && !validateEmail(email)) {
      document.getElementById('email-error').textContent = 'Please enter a valid email';
    }
    isValid = false;
  }

  if (!phone || !validatePhone(phone)) {
    if (phone && !validatePhone(phone)) {
      document.getElementById('phone-error').textContent = 'Please enter a valid UK phone number';
    }
    isValid = false;
  }

  // Delivery method specific validation
  const deliveryMethodEl = document.querySelector('input[name="delivery-method"]:checked');
  const deliveryMethod = deliveryMethodEl ? deliveryMethodEl.value : 'collection';

  if (deliveryMethod === 'delivery') {
    const deliveryAddress = document.getElementById('delivery-address');
    const deliveryCity = document.getElementById('delivery-city');
    const deliveryPostcode = document.getElementById('delivery-postcode');
    const deliveryTime = document.getElementById('delivery-time');

    if (deliveryAddress && !deliveryAddress.value.trim()) isValid = false;
    if (deliveryCity && !deliveryCity.value.trim()) isValid = false;
    if (deliveryPostcode && !deliveryPostcode.value.trim()) isValid = false;
    if (deliveryTime && !deliveryTime.value) isValid = false;
  }

  // Enable/disable submit button
  document.getElementById('submit-order').disabled = !isValid;

  return isValid;
}

async function handleSubmit(e) {
  e.preventDefault();

  if (!validateForm()) {
    alert('Please fill in all required fields correctly');
    return;
  }

  setLoading(true);

  try {
    // Collect form data
    const cart = getCart();
    const deliveryMethodEl = document.querySelector('input[name="delivery-method"]:checked');
    const deliveryMethod = deliveryMethodEl ? deliveryMethodEl.value : 'collection';
    
    const orderData = {
      customerName: document.getElementById('customer-name').value.trim(),
      customerEmail: document.getElementById('customer-email').value.trim(),
      customerPhone: document.getElementById('customer-phone').value.trim(),
      items: cart.map(item => ({
        productId: item.id,  // Backend expects 'productId' not 'id'
        name: item.name,
        price: item.price,
        quantity: item.quantity
      })),
      subtotal: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      deliveryFee: deliveryMethod === 'delivery' ? 6.99 : 0,  // Free delivery over £50
      total: 0, // Will be calculated
      fulfillmentType: deliveryMethod  // Backend expects 'fulfillmentType'
    };

    orderData.total = orderData.subtotal + orderData.deliveryFee;

    // Add delivery-specific data
    if (deliveryMethod === 'delivery') {
      const deliveryAddressEl = document.getElementById('delivery-address');
      const deliveryCityEl = document.getElementById('delivery-city');
      const deliveryPostcodeEl = document.getElementById('delivery-postcode');
      const deliveryTimeEl = document.getElementById('delivery-time');
      
      if (deliveryAddressEl && deliveryCityEl && deliveryPostcodeEl) {
        orderData.deliveryAddress = {
          line1: deliveryAddressEl.value.trim(),
          city: deliveryCityEl.value.trim(),
          postcode: deliveryPostcodeEl.value.trim().toUpperCase()
        };
      }
      if (deliveryTimeEl) orderData.deliveryTimeSlot = deliveryTimeEl.value;
    } else {
      // Collection - add dummy date to satisfy backend validation (you'll confirm actual date later)
      orderData.collectionDate = new Date().toISOString().split('T')[0]; // Today's date
      orderData.collectionTimeSlot = 'TBC'; // To be confirmed
    }

    // Create payment intent with Stripe
    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
      await createPaymentIntent(orderData.total),
      {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: orderData.customerName,
            email: orderData.customerEmail,
          }
        }
      }
    );

    if (stripeError) {
      throw new Error(stripeError.message);
    }

    // Payment successful - submit order
    orderData.paymentStatus = 'paid';
    orderData.stripePaymentIntentId = paymentIntent.id;

    const response = await fetch(`${API_BASE}/api/packaging-shop/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create order');
    }

    const result = await response.json();

    // Clear cart
    clearCart();

    // Redirect to success page with order number
    window.location.href = `confirmation.html?order=${result.order.orderNumber}`;

  } catch (error) {
    console.error('Order error:', error);
    alert(`Error: ${error.message}`);
    setLoading(false);
  }
}

async function createPaymentIntent(amount) {
  try {
    const response = await fetch('https://panther-packaging-backend-production.up.railway.app/api/create-payment-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100) // Convert to pence
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create payment intent');
    }

    const data = await response.json();
    // Backend returns 'client_secret' (underscore) not 'clientSecret' (camelCase)
    return data.client_secret || data.clientSecret;
  } catch (error) {
    console.error('Payment intent error:', error);
    throw new Error('Unable to process payment. Please try again.');
  }
}

function setLoading(loading) {
  const button = document.getElementById('submit-order');
  const buttonText = document.getElementById('button-text');
  const spinner = document.getElementById('button-spinner');

  button.disabled = loading;

  if (loading) {
    buttonText.textContent = 'Processing...';
    spinner.classList.remove('spinner-hidden');
  } else {
    buttonText.textContent = 'Place Order';
    spinner.classList.add('spinner-hidden');
  }
}
