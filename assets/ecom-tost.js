/* =========================
   EventEmitter 
   ========================= */
class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
  }

  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach((cb) => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    }
  }

  off(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter((cb) => cb !== callback);
      if (this.events[event].length === 0) delete this.events[event];
    }
  }
}

/* =========================
   ShopifyCartManager
   ========================= */
class ShopifyCartManager extends EventEmitter {
  constructor() {
    super();

    // DOM elements
    this.bulletTost = document.querySelector(".bullet-tost");
    this.bulletTostInner = document.querySelector(".bullet-tost-inner");
    this.animBtn = document.querySelector(".anim-btn");
    this.overlay = document.querySelector(".overlay.bullet");
    this.cartBody = document.querySelector(".bullet-tost-body");
    this.clearCartBtn = document.querySelector(".clear-cart");

    // state
    this.cartItems = [];
    this.subtotal = {};

    // fixed gift varient id 
    this.FIXED_GIFT_ID = "50370665152807"

    // internal
    this._inited = false;
    this._listenedEvents = new Map(); // Map<eventName, handler | handler[]>

    this.handleAnimBtnClick = this.toggleCartAnimation.bind(this);
    this.handleOverlayClick = this.closeCart.bind(this);
    this.handleCartBodyClick = this.handleCartInteractions.bind(this);
    this.handleClearCartClick = this.handleClearCart.bind(this); // canonical name
    this.handleKeydown = this._onKeydown.bind(this);


    // Bound EventEmitter handlers
    this._boundOnCartItemIncreased = this.onCartItemIncreased.bind(this);
    this._boundOnCartItemDecreased = this.onCartItemDecreased.bind(this);
    this._boundOnNewItemAdded = this.onNewItemAdded.bind(this);
    this._boundOnFetchCartItem = this.onFetchCartItem.bind(this);
    this._boundOnQuantityUpdated = this.onQuantityUpdated.bind(this);

    this.handleShopifySectionLoad = this._onShopifySectionLoad.bind(this);
    this.handleShopifySectionUnload = this._onShopifySectionUnload.bind(this);

    // init
    this.init();
  }

  // ------------------------
  // Init / bind / lifecycle
  // ------------------------
  init() {
    if (this._inited) return;
    this._inited = true;
    console.log("intt")


    this.bindEvents();
    this.renderCartItems();
    this.fetchCartItems();
  }

  bindEvents() {
    // DOM ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.renderCartItems());
    }

    // animBtn
    if (this.animBtn) {
      this.animBtn.removeEventListener("click", this.handleAnimBtnClick);
      this.animBtn.addEventListener("click", this.handleAnimBtnClick);
    }

    // overlay
    if (this.overlay) {
      this.overlay.removeEventListener("click", this.handleOverlayClick);
      this.overlay.addEventListener("click", this.handleOverlayClick);
    }

    // cartBody delegation
    if (this.cartBody) {
      this.cartBody.removeEventListener("click", this.handleCartBodyClick);
      this.cartBody.addEventListener("click", this.handleCartBodyClick);
    }

    // clear cart
    if (this.clearCartBtn) {
      this.clearCartBtn.removeEventListener("click", this.handleClearCartClick);
      this.clearCartBtn.addEventListener("click", this.handleClearCartClick);
    }

    // keyboard
    window.removeEventListener("keydown", this.handleKeydown);
    window.addEventListener("keydown", this.handleKeydown);

    // EventEmitter custom events 
    if (!this._listenedEvents.has("cart:item-increased")) {
      this.on("cart:item-increased", this._boundOnCartItemIncreased);
      this._listenedEvents.set("cart:item-increased", this._boundOnCartItemIncreased);
    }
    if (!this._listenedEvents.has("cart:item-decreased")) {
      this.on("cart:item-decreased", this._boundOnCartItemDecreased);
      this._listenedEvents.set("cart:item-decreased", this._boundOnCartItemDecreased);
    }
    if (!this._listenedEvents.has("cart:new-item-added")) {
      this.on("cart:new-item-added", this._boundOnNewItemAdded);
      this._listenedEvents.set("cart:new-item-added", this._boundOnNewItemAdded);
    }
    if (!this._listenedEvents.has("cart:fetch-cart-item")) {
      this.on("cart:fetch-cart-item", this._boundOnFetchCartItem);
      this._listenedEvents.set("cart:fetch-cart-item", this._boundOnFetchCartItem);
    }
    if (!this._listenedEvents.has("cart:quantity-updated")) {
      this.on("cart:quantity-updated", this._boundOnQuantityUpdated);
      this._listenedEvents.set("cart:quantity-updated", this._boundOnQuantityUpdated);
    }
  }

  // useless functions
  _onShopifySectionLoad(event) {

    try {

      const section_id = this.bulletTost?.dataset?.sectionId;
      if (event?.detail?.sectionId === section_id) {
        console.log("Shopify section loaded -> rebind/render");
        this.bindEvents();
        this.renderCartItems();
        this.fetchCartItems();
      }
    } catch (err) {
      console.warn("section load handler error", err);
    }
  }
  _onShopifySectionUnload(event) {

    try {
      const section_id = this.bulletTost?.dataset?.sectionId;
      if (event?.detail?.sectionId === section_id) {
        console.log("Shopify section unload -> destroy");
        this.destroy();
      }
    } catch (err) {
      console.warn("section unload handler error", err);
    }
  }

  // ------------------------
  // destroy & dispose
  // ------------------------
  destroy({ clearDom = false } = {}) {
    if (!this._inited) return;

    // 1) remove DOM listeners
    try {
      if (this.animBtn) this.animBtn.removeEventListener("click", this.handleAnimBtnClick);
      if (this.overlay) this.overlay.removeEventListener("click", this.handleOverlayClick);
      if (this.cartBody) this.cartBody.removeEventListener("click", this.handleCartBodyClick);
      if (this.clearCartBtn) this.clearCartBtn.removeEventListener("click", this.handleClearCartClick);
      window.removeEventListener("keydown", this.handleKeydown);
    } catch (err) {
      console.warn("Error removing DOM listeners:", err);
    }



    // 3) remove custom EventEmitter listeners using the map
    try {

      if (typeof this.off === "function") {
        for (const [eventName, handlerOrHandlers] of this._listenedEvents.entries()) {
          if (Array.isArray(handlerOrHandlers)) {
            handlerOrHandlers.forEach((h) => this.off(eventName, h));
          } else if (handlerOrHandlers) {
            this.off(eventName, handlerOrHandlers);
          }
          this._listenedEvents.delete(eventName);
        }
      } else {
        // fallback: clear everything 
        this.events = {};
        this._listenedEvents.clear();
      }
    } catch (err) {

      console.warn("Error removing custom event listeners:", err);
      try { this.events = {}; this._listenedEvents.clear(); } catch (e) { }

    }

    // 4) optional: clear DOM content
    if (clearDom && this.cartBody) {
      try { this.cartBody.innerHTML = ""; } catch (e) { console.warn(e); }
    }

    // 5) reset UI state
    try {
      if (this.bulletTost) {
        this.bulletTost.classList.remove("animate");
        this.bulletTost.style.display = "";
      }
      if (this.bulletTostInner) this.bulletTostInner.classList.remove("bullet-tost-header");
      if (this.overlay) { this.overlay.style.visibility = "hidden"; this.overlay.style.opacity = "0"; }
      document.body.style.overflow = "";
    } catch (err) {
      console.warn("Error resetting UI:", err);
    }

    // 6) reset internal state
    this.cartItems = [];
    this.subtotal = {};
    this._inited = false;

    console.log("ShopifyCartManager destroyed");
  }

  /**
   * dispose() 
   * CLEAR CARBAGE COLLECTOR
   */
  dispose() {

    this.destroy();

    // clear references
    this.handleAnimBtnClick = null;
    this.handleOverlayClick = null;
    this.handleCartBodyClick = null;
    this.handleClearCartClick = null;
    this.handleKeydown = null;
    this.handleShopifySectionLoad = null;
    this.handleShopifySectionUnload = null;

    this._boundOnCartItemIncreased = null;
    this._boundOnCartItemDecreased = null;
    this._boundOnNewItemAdded = null;
    this._boundOnFetchCartItem = null;
    this._boundOnQuantityUpdated = null;

    console.log("ShopifyCartManager disposed (all references cleared)");
  }


  toggleCartAnimation(e) {

    if (!this.bulletTost || !this.bulletTostInner || !this.overlay) return;
    console.log(this.bulletTost.classList.contains("animate"));
    this.bulletTost.classList.toggle("animate");
    this.bulletTostInner.classList.toggle("bullet-tost-header");
    if (this.bulletTost.classList.contains("animate")) {
      this.overlay.style.visibility = "visible"; this.overlay.style.opacity = "1"; document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto"; this.overlay.style.visibility = "hidden"; this.overlay.style.opacity = "0";
    }
  }

  closeCart() {
    if (!this.bulletTost || !this.bulletTostInner || !this.overlay) return;
    this.bulletTost.classList.remove("animate");
    this.bulletTostInner.classList.remove("bullet-tost-header");
    this.overlay.style.visibility = "hidden"; this.overlay.style.opacity = "0";
    document.body.style.overflowY = "auto";
  }
  // ------------------------
  // API / core methods 
  // ------------------------
  async fetchCartItems() {
    try {
      const response = await fetch("/cart.js");
      const cartsData = await response.json();
      this.cartItems = cartsData.items || [];
      this.emit("cart:fetch-cart-item", this.cartItems);
      return this.cartItems;
    } catch (error) {
      console.error("Error fetching cart items:", error);
    }
  }

  async updateQuantity(qtyWrapper, variantId, newQuantity, qtyElement, footer) {

    if (!qtyWrapper || !variantId || !qtyElement) return;
    try {
      const priceEl = qtyWrapper?.closest(".cart-item")?.querySelector(".cart-item-price");
      const priceFooter = footer?.querySelector(".cart-item-price");

      this.setLoadingState(qtyWrapper, true);

      const response = await fetch("/cart/change.js", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ quantity: newQuantity, id: variantId }),
      });

      const data = await response.json();

      if (response.ok) {
        const item = data.items.find((i) => i.variant_id.toString() === variantId.toString());

        if (newQuantity > 0) {
          qtyElement.textContent = String(newQuantity);
          const formattedPrice = window.money_with_currency_format.replace(
            "{{amount}}",
            (item.final_line_price / 100).toFixed(2),
          );
          if (priceEl) priceEl.textContent = formattedPrice;

          // if (priceFooter) priceFooter.querySelector("span")?.innerHTML = formattedPrice;
        } else {
          const cartItem = qtyElement.closest(".cart-item");
          if (cartItem) cartItem.remove();
          this.emit("cart:item-removed", { variantId });
        }

        this.updateBulletTostCount();
        this.emit("cart:quantity-updated", { variantId, newQuantity });
        return data;
      }
    } catch (err) {
      console.error("Error updating quantity:", err);
    } finally {
      this.setLoadingState(qtyWrapper, false);
    }
  }


  async handleClearCart() {
    try {
      this.setLoadingState(this.cartBody, true);
      const response = await fetch("/cart/clear.js", { method: "POST" });
      if (response.ok) {
        if (this.cartBody) this.cartBody.innerHTML = "";
        this.updateBulletTostCount();
        await this.fetchCartItems();
        this.subtotal = { items_subtotal_price: 0, original_total_price: 0, total_discount: 0, total_price: 0, item_count: 0 };
        this.updateSubtotalDisplay();
      }
    } catch (err) {
      console.error("Error clearing cart:", err);
    } finally {
      this.setLoadingState(this.cartBody, false);
    }
  }

  async handleCartInteractions(e) {
    const target = e.target;
    if (!target.classList.contains("decrease-button") && !target.classList.contains("increase-button")) return;

    const qtyWrapper = target.closest(".cart-item-quantity");
    if (!qtyWrapper) return;

    const variantId = qtyWrapper.dataset.variantId || qtyWrapper.getAttribute("data-variant-id");
    const qtyElement = qtyWrapper.querySelector("p");
    const quantity = Number.parseInt(qtyElement.textContent, 10) || 0;

    if (target.classList.contains("increase-button")) {
      const data = await this.updateQuantity(qtyWrapper, variantId, quantity + 1, qtyElement);
      if (data) this.updateSubtotalFromResponse(data);
      this.emit("cart:item-increased", { variantId, newQuantity: quantity + 1, item: data?.items });
    }

    if (target.classList.contains("decrease-button")) {
      const data = await this.updateQuantity(qtyWrapper, variantId, quantity - 1, qtyElement);
      if (data) this.updateSubtotalFromResponse(data);

      this.emit("cart:item-decreased", { variantId, newQuantity: quantity - 1, item: data?.items });
    }
  }

  _onKeydown(e) {
    if (e.key === "Escape" && this.bulletTost?.classList.contains("animate")) {
      this.closeCart();
    }
  }

  // custom handlers 
  onNewItemAdded({ dataProduct, giftProduct }) {

    if (!dataProduct) return;
    const isDataProductInCart = this.cartItems.find((item) => item.variant_id === dataProduct.variant_id);
    const isDataProductInDOM = this.cartBody?.querySelector(`[data-variant-id="${dataProduct.variant_id}"]`);

    if (!isDataProductInCart && !isDataProductInDOM) {
      const dataProductHtml = this.generateCartItemHTML(dataProduct);
      this.cartBody?.insertAdjacentHTML("beforeend", dataProductHtml);
    }

    if (giftProduct) {
      const isGiftInCart = this.cartItems.find((item) => item.variant_id === giftProduct.variant_id);
      const isGiftInDOM = this.cartBody?.querySelector(`[data-variant-id="${giftProduct.variant_id}"]`);

      if (!isGiftInCart && !isGiftInDOM) {
        console.log('insert the gift product ')
        const giftProductHtml = this.generateCartItemHTML(giftProduct, true);
        this.cartBody?.insertAdjacentHTML("beforeend", giftProductHtml);
      }

    }
  }



  onCartItemIncreased({ variantId, newQuantity, item: EditedItem }) {
    this.emit("cart:fetch-cart-item", EditedItem);
    const updateItem = EditedItem.find((i) => i.variant_id == variantId);
    this.updateCartUI({ updateItem, variantId });
  }

  onCartItemDecreased({ variantId, newQuantity, item: EditedItem }) {
    this.cartItems = EditedItem;
    const existingElement = this.cartBody?.querySelector(`.cart-item[data-variant-id="${variantId}"]`)
    if (newQuantity === 0 && existingElement) {
      existingElement.remove();
    }
    // check  if now the md and black varient  in cart remove gift  this.FIXED_GIFT_ID
    const isGiftInCart = this.cartItems.find((item) => item.variant_id.toString() === this.FIXED_GIFT_ID.toString());
    console.log(isGiftInCart, 'isGiftInCart')
    if (isGiftInCart) {
      this.removeGiftCartOnChanges(isGiftInCart)
    }
    if (newQuantity > 0) {
      console.log('newQuantity', newQuantity, EditedItem)
      this.emit("cart:fetch-cart-item", EditedItem);
      const updateItem = EditedItem.find((i) => i.variant_id == variantId);
      this.updateCartUI({ updateItem, variantId });
    }
  }


  onQuantityUpdated({ variantId, newQuantity }) {
    const item = this.cartItems.find((it) => it.id == variantId);
    if (item) item.quantity = newQuantity;
  }

  onFetchCartItem(data) {
    this.cartItems = Array.isArray(data) ? [...data] : [];
  }

  // helpers 

  async removeGiftCartOnChanges(isGiftInCart) {

    try {
      const existingElementDOM = this.cartBody?.querySelector(`.cart-item[data-variant-id="${isGiftInCart.variant_id}"]`)
      console.log(existingElementDOM, 'existingElementDOM')
      const hasSomeMD_Black = this.cartItems.find((item) => {
        const options = item.variant_options // ["Size" , "Color"]
        return options.find((op) => op === "Black") && options.find((op) => op === "M") && (item.variant_id.toString() !== isGiftInCart.variant_id.toString())
      })
      if (!hasSomeMD_Black) {
        if (existingElementDOM) {
          const response = await fetch(`/cart/change.js`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              id: isGiftInCart.variant_id.toString(),
              quantity: 0
            }),
          });
          if (!response.ok) return;
          const CartData = await response.json();
          this.subtotal = {
            items_subtotal_price: CartData.items_subtotal_price,
            original_total_price: CartData.original_total_price,
            total_discount: CartData.total_discount,
            total_price: CartData.total_price,
            item_count: CartData.item_count,
          };
          this.updateSubtotalDisplay();
          existingElementDOM.remove();
          this.emit("cart:fetch-cart-item", CartData.items);
          const updateItem = CartData.items.find((i) => i.variant_id.toString() == isGiftInCart.variant_id.toString());
          this.updateCartUI({ updateItem, variantId: isGiftInCart.variant_id.toString() });
        }
      }
    } catch (error) {
      console.log(error)
    }

  }


  // ------------------------
  // UI helpers (render, update)
  // ------------------------
  async renderCartItems() {
    try {
      const response = await fetch("/cart?section_id=ecom-product-cart");
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      // data-variant-id="50370665152807"
      // console.log(doc.querySelector(".cart-items "));
      const newCartItems = doc.querySelector(".cart-items");

      if (this.cartBody && newCartItems) {
        this.cartBody.innerHTML = newCartItems.innerHTML;
      }

      const cartsResponse = await fetch("/cart.js");
      const cartsData = await cartsResponse.json();
      this.subtotal = {
        items_subtotal_price: cartsData.items_subtotal_price,
        original_total_price: cartsData.original_total_price,
        total_discount: cartsData.total_discount,
        total_price: cartsData.total_price,
        item_count: cartsData.item_count,
      };

      this.updateSubtotalDisplay();
      if (this.bulletTost) this.bulletTost.style.display = "block";

      this.cartItems = cartsData.items || [];
      this.emit("cart:updated", this.cartItems);
    } catch (err) {
      console.error("Error rendering cart items:", err);
    }
  }

  updateCartUI({ updateItem, variantId }) {
    const cartItemElement = this.cartBody?.querySelector(`[data-variant-id="${variantId}"]`);
    if (!cartItemElement || !updateItem) return;
    const productQuantity = cartItemElement.querySelector(".product-quantity");
    const cartItemPrice = cartItemElement.querySelector(".cart-item-price");
    if (productQuantity) productQuantity.textContent = updateItem.quantity;
    if (cartItemPrice) {
      const formattedPrice = window.money_with_currency_format.replace("{{amount}}", (updateItem.final_line_price / 100).toFixed(2));
      cartItemPrice.textContent = formattedPrice;
    }
  }

  updateSubtotalDisplay() {
    const subtotal = ((this.subtotal.total_price || 0) / 100).toFixed(2);
    const summaryItems = this.bulletTost?.querySelector("#summary-items");
    const summarySubtotal = this.bulletTost?.querySelector("#summary-subtotal");
    const countElement = this.bulletTost?.querySelector(".bullet-tost-count");

    if (summaryItems) summaryItems.textContent = this.subtotal.item_count || 0;
    if (summarySubtotal) summarySubtotal.textContent = window.money_with_currency_format.replace("{{amount}}", subtotal);

    const count = this.subtotal.item_count || 0;
    if (countElement) countElement.textContent = count >= 10 ? "9+" : count.toString();
  }

  updateBulletTostCount() {
    if (!this.cartBody) return;
    const allQtyElements = this.cartBody.querySelectorAll(".product-quantity");
    const countElement = document.querySelector(".bullet-tost-count");
    let total = 0;
    allQtyElements.forEach((itemCount) => {
      total += Number.parseInt(itemCount.textContent, 10) || 0;
    });
    if (countElement) countElement.textContent = total >= 10 ? "9+" : total.toString();
  }


  generateCartItemHTML(item, isGift) {
    console.log({ isGift, item })
    const formattedPrice = window.money_with_currency_format.replace("{{amount}}", (item.final_line_price / 100).toFixed(2));
    return `
      <div class="cart-item" data-variant-id="${item.variant_id}">
        <img src="${item.featured_image?.url || ''}" alt="${item.featured_image?.alt || ''}" width="100" height="100" class="cart-item-image" />
        <div class="cart-item-details">
        <div>

        ${isGift ? `
         <div style="width: 100%;" class="cart-item-details">
        <div class="ecom-header-product">
          <h3> ${item.title} </h3>
            <span class="gift-badge">Gift Product</span>
        </div>`:
        `<h3>${item.title}</h3>`
      }

        </div>
        ${item.variant_id == this.FIXED_GIFT_ID ?
        ` <p class="product-quantity">Quantity: ${item.quantity}</p>`
          :` <div class="cart-item-quantity" data-variant-id="${item.variant_id}">
              <button class="increase-button button-qty">+</button>
              <p class="product-quantity">${item.quantity}</p>
              <button class="decrease-button button-qty">-</button>
            </div>`
          }
          <p class="cart-item-price">${formattedPrice}</p>
        </div>
      </div>
    `;
  }

  updateSubtotalFromResponse(data) {
    if (!data) return;
    this.subtotal = {
      items_subtotal_price: data.items_subtotal_price,
      original_total_price: data.original_total_price,
      total_discount: data.total_discount,
      total_price: data.total_price,
      item_count: data.item_count,
    };
    this.updateSubtotalDisplay();
  }

  setLoadingState(element, isLoading) {
    if (!element) return;
    const buttons = element.querySelectorAll("button");
    if (isLoading) {
      element.classList.add("loading-wrapper");
      buttons.forEach((btn) => { btn.classList.add("loading"); btn.disabled = true; });
    } else {
      element.classList.remove("loading-wrapper");
      buttons.forEach((btn) => { btn.classList.remove("loading"); btn.disabled = false; });
    }
  }

  // public API
  getCartItems() { return this.cartItems; }
  refresh() { this.renderCartItems(); }
  getCartCount() {
    const countElement = document.querySelector(".bullet-tost-count");
    return countElement ? countElement.textContent : "0";
  }
  open() { if (this.bulletTost && !this.bulletTost.classList.contains("animate")) this.toggleCartAnimation(); }
  close() { if (this.bulletTost && this.bulletTost.classList.contains("animate")) this.closeCart(); }
}

/* =========================
   Instantiate
   ========================= */

const cartManager = new ShopifyCartManager();
if (!window.cartManager) {
  window.cartManager = cartManager; // or ensure created elsewhere
}

document.addEventListener("shopify:section:load", (event) => {
  console.log("Shopify section loaded -> rebind/render");


  if (window.cartManager && typeof window.cartManager.destroy === "function") {
    window.cartManager.destroy();

  }

  const cartManager = new ShopifyCartManager();
  window.cartManager = cartManager;
  console.log("cartManager initialized for section:",);
});


document.addEventListener("shopify:section:unload", (event) => {

  if (window.cartManager && typeof window.cartManager.destroy === "function") {
    window.cartManager.destroy();
    delete window.cartManager;
  }
  console.log("cartManager initialized for section:",);
});