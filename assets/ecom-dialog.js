
/**

 * PRODUCT DIALOG CLASS
 * ================================================
 * Handles product quick view dialog functionality
 */
class Dialog {
  constructor(options = {}) {
    // keep original passed options
    this.overlaySelector = options.overlaySelector || ".overlay";
    this.dialogContentSelector = options.dialogContentSelector || ".dialog-content";
    this.dialogTriggerSelector = options.dialogTriggerSelector || ".trigger-dialog";
    this.productItemSelector = options.productItemSelector || ".product-item";
    this.productGridSelector = options.productGridSelector || ".product-grid-section";

    // cart manager (expect global variable cartManager)
    this.cartManager = window.cartManager;

    // DOM refs (resolved in setup)
    this.productsgrid = null;
    this.dialogContent = null;
    this.overlay = null;

    // state
    this.product = null;
    this.isInitialized = false;
    this.isOpen = false;
    this.cartItems = [];
    this.selectedColor = null;
    this.selectedSize = null;

    // internal bookkeeping for listeners
    // array of {el, type, handler, options}
    this._dialogListeners = [];
    // Map of cartManager eventName -> handlerFn
    this._cartBoundHandlers = new Map();
    // bound references for top-level handlers so removeEventListener works
    this._boundHandleClickGrid = null;
    this._boundHandleCloseDialog = null;
    this._boundHandleKeydown = null;

    // flags
    this._eventsBound = false;

    // bind the instance methods that exist in the rest of your class
    // these methods (handleClickGrid, handleCloseDialog, handleAddToCart, etc.)
    // are expected to be present elsewhere in the class body.
    this.handleCloseDialog = this.handleCloseDialog.bind(this);
    this.handleAddToCart = this.handleAddToCart.bind(this);
    this.handleItemQtyBtns = this.handleItemQtyBtns.bind(this);
    this.onCartUpdated = this.onCartUpdated.bind(this);

    // init
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setup());
    } else {
      this.setup();
    }
  }

  // ================================================
  // INITIALIZATION METHODS
  // ================================================
  setup() {
    // resolve DOM elements (safe re-resolution)
    this.productsgrid = document.querySelector(this.productGridSelector) || this.productsgrid;
    this.dialogContent = document.querySelector(this.dialogContentSelector) || this.dialogContent;
    this.overlay = document.querySelector(this.overlaySelector) || this.overlay;

    // load initial cart items snapshot from cartManager if available
    if (this.cartManager && typeof this.cartManager.getCartItems === "function") {
      this.cartItems = this.cartManager.getCartItems() || [];
    }

    this.cartManager = window.cartManager;

    // bind all listeners (idempotent)
    this.bindAll();
    this.isInitialized = true;
  }


  /* --------------------------------
     bindAll - attach top-level and cart events
     --------------------------------
      Attach product grid, overlay, window keydown and CartManager events.
     Stores handler refs for safe removal later.
  */
  bindAll() {
    try {

      if (this._eventsBound) return;

      const attach = (el, type, handler, options) => {
        if (!el || typeof handler !== "function") return;
        el.addEventListener(type, handler, options);
        this._dialogListeners.push({ el, type, handler, options });
      };

      // top-level handlers (use stable bound refs)
      if (!this._boundHandleClickGrid) this._boundHandleClickGrid = this.handleClickGrid.bind(this);
      if (!this._boundHandleCloseDialog) this._boundHandleCloseDialog = this.handleCloseDialog.bind(this);
      if (!this._boundHandleKeydown) {
        this._boundHandleKeydown = (e) => {
          if (e.key === "Escape" && this.isOpen) this.handleCloseDialog();
        };
      }

      // attach to product grid (delegated click)
      if (this.productsgrid) attach(this.productsgrid, "click", this._boundHandleClickGrid);

      // overlay click to close
      if (this.overlay) attach(this.overlay, "click", this._boundHandleCloseDialog);

      // global keydown
      attach(window, "keydown", this._boundHandleKeydown);

      // attach CartManager custom events (only the ones this dialog uses)
      if (this.cartManager && typeof this.cartManager.on === "function") {
        const handlers = {
          "cart:updated": this.onCartUpdated.bind(this),
          "cart:rendered": this.onCartUpdated.bind(this),
          "cart:quantity-updated": this.onQuantityUpdated?.bind(this) || (() => { }),
          "cart:item-removed": this.onItemRemoved?.bind(this) || (() => { }),
          "cart:fetch-cart-item": this.onFetchCartItem?.bind(this) || (() => { }),
        };

        for (const [ename, handler] of Object.entries(handlers)) {
          if (!this._cartBoundHandlers.has(ename) && typeof handler === "function") {
            this.cartManager.on(ename, handler);
            this._cartBoundHandlers.set(ename, handler);
          }
        }
      }

      this._eventsBound = true;
    } catch (error) {
      console.warn("bindAll error", error);

    }
    // helper to attach + store

  }




  /* --------------------------------
     unbind - remove dialog DOM listeners and cartManager handlers
     --------------------------------
     (English) Removes all listeners registered via bindAll / bindDialogEvents.
  */
  unbind() {
    // remove DOM listeners we stored
    for (const { el, type, handler, options } of this._dialogListeners) {
      try { el.removeEventListener(type, handler, options); } catch (e) { /* ignore */ }
    }
    this._dialogListeners = [];

    // remove top-level bound refs
    try {
      if (this.productsgrid && this._boundHandleClickGrid) this.productsgrid.removeEventListener("click", this._boundHandleClickGrid);
      if (this.overlay && this._boundHandleCloseDialog) this.overlay.removeEventListener("click", this._boundHandleCloseDialog);
      if (this._boundHandleKeydown) window.removeEventListener("keydown", this._boundHandleKeydown);
    } catch (e) { /* ignore */ }

    // remove cartManager custom handlers
    if (this.cartManager && typeof this.cartManager.off === "function") {
      for (const [ename, handler] of this._cartBoundHandlers.entries()) {
        try { this.cartManager.off(ename, handler); } catch (e) { /* ignore */ }
      }
      this._cartBoundHandlers.clear();
    } else {
      // fallback: do not mutate cartManager.events by default (dangerous)
      this._cartBoundHandlers.clear();
    }

    this._eventsBound = false;
  }



  /* --------------------------------
   destroy - safe teardown
   --------------------------------
   (English) Unbind listeners, hide dialog and reset small state.
   Optionally clear entire cartManager.events by passing clearCartManagerEvents=true (use carefully).
*/
  destroy({ clearCartManagerEvents = false } = {}) {
    // unbind everything we created
    this.unbind();

    // optionally wipe all cartManager.events (dangerous for shared instance)
    if (clearCartManagerEvents && this.cartManager) {
      try { this.cartManager.events = {}; } catch (e) { console.warn("clear cartManager.events failed:", e); }
    }

    // hide dialog UI safely
    try { this.handleCloseDialog(); } catch (e) { /* ignore */ }

    // reset state snapshot
    this.product = null;
    this.cartItems = [];
    this.isOpen = false;
    this.isInitialized = false;

    console.log("Dialog destroyed (listeners removed)");
  }


  // ================================================
  // EVENT HANDLERS
  // ================================================

  /**
   * Handle ESC key to close dialog
   */
  handleKeyEsc() {
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) {
        this.handleCloseDialog();
      }
    });
  }

  /**
   * Handle dialog close
   */
  handleCloseDialog(ev) {
    const dialogContent = document.querySelector(this.dialogContentSelector);
    if (this.overlay) {
      this.overlay.style.visibility = "hidden";
      this.overlay.style.opacity = "0";
    }
    if (dialogContent) {
      dialogContent.style.visibility = "hidden";
      dialogContent.style.opacity = "0";
    }
    document.body.style.overflowX = "hidden";
    document.body.style.overflowY = "auto";
    this.isOpen = false;
  }

  /**
   * Handle product grid clicks
   * @param {Event} e - Click event
   */
  handleClickGrid(e) {
    console.log(e.target)
    const trigger = e.target.closest(this.dialogTriggerSelector);
    if (!trigger) return;

    const card = trigger.closest(this.productItemSelector);
    if (!card) return;

    const productId = card.dataset.productId;
    if (!productId) return;

    const dataEl = document.getElementById(`product-data-${productId}`);
    if (!dataEl) return;

    try {
      const product = JSON.parse(dataEl.textContent);
      this.product = product;
      if (!product) return;

      const firstAvailableVariant = product.variants.find((v) => v.available);
      if (!firstAvailableVariant) return;

      this.selectedColor = firstAvailableVariant.options[1];
      this.selectedSize = firstAvailableVariant.options[0];

      const dialogContent = document.querySelector(this.dialogContentSelector);
      const overlay = this.overlay;

      dialogContent.innerHTML = this.buildDialog(product, firstAvailableVariant);
      this.showDialog(dialogContent, overlay);
      this.bindDialogEvents(product, firstAvailableVariant);
      this.isOpen = true;
    } catch (error) {
      console.error("Error handling grid click:", error);
    }
  }

  /**
   * Handle quantity button clicks
   * @param {HTMLElement} e - Button element
   */
  async handleItemQtyBtns(e) {
    const qtyWrapper = e.closest(".cart-item-quantity");
    const footer = e.closest(".dialog-footer");
    if (!qtyWrapper) return;

    const variantId = qtyWrapper.dataset.variantId;
    const qtyElement = qtyWrapper.querySelector("p");
    const quantity = parseInt(qtyElement.textContent, 10);

    if (e.classList.contains("increase-button")) {
      const item = await this.cartManager.updateQuantity(qtyWrapper, variantId, quantity + 1, qtyElement, footer);
      this.handleQuantityUpdate(item, variantId, quantity + 1, "increase");
    }

    if (e.classList.contains("decrease-button")) {
      const item = await this.cartManager.updateQuantity(qtyWrapper, variantId, quantity - 1, qtyElement, footer);
      this.handleQuantityUpdate(item, variantId, quantity - 1, "decrease");
    }
  }

  /**
   * Handle add to cart form submission
   * @param {Event} e - Form submit event
   */
  async handleAddToCart(e) {
    e.preventDefault();
    e.stopPropagation();

    const form = e.target;
    const variantInput = form.querySelector(".variant-id-input");
    const submitter = e.submitter;
    this.cartManager.setLoadingState(submitter, true);
    if (submitter && submitter.closest(".cart-item-quantity")) {
      await this.handleItemQtyBtns(submitter);
      return;
    }

    if (!variantInput) return;
    try {
      // console.log("submitter:", submitter , form , e.target , e.currentTarget , e.submitter) ; 


      // Add main product to cart
      const response = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: variantInput.value, quantity: 1 }),
      });

      const dataProduct = await response.json();
      let giftProduct;

      // Handle gift product logic
      if (this.shouldAddGiftProduct()) {
        giftProduct = await this.addGiftProduct();
      }

      if (response.ok) {
        this.handleSuccessfulAddToCart(dataProduct, giftProduct);
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
    }
    finally {
      this.cartManager.setLoadingState(submitter, false);
    }
  }

  // ================================================
  // CART EVENT HANDLERS
  // ================================================

  /**
   * Handle cart updated event
   * @param {Object} cartItemsUpdated - Updated cart data
   */
  onCartUpdated(cartItemsUpdated) {
    const { dataProduct, giftProduct } = cartItemsUpdated;
    if (!dataProduct || !giftProduct) return;

    const existingElement = this.cartManager.cartBody.querySelector(`[data-variant-id="${dataProduct.variant_id}"]`);
    console.log("existingElement" , existingElement)
    // const renderedItem = this.renderCartItem(dataProduct);
    // const parser = new DOMParser();
    // const parsed = parser.parseFromString(renderedItem, "text/html");
    
    if (dataProduct.quantity <= 0) {
      if (existingElement) existingElement.remove();
      return;
    }

    if(giftProduct.quantity <= 0) {
      const existingElementGigt = this.cartManager.cartBody.querySelector(`[data-variant-id="${giftProduct.variant_id}"]`);
      if (existingElementGigt) existingElementGigt.remove();
      return
    }

  
  
  }

  /**
   * Handle quantity updated event
   * @param {Object} data - Update data
   */
  onQuantityUpdated({ variantId, newQuantity }) {
    const item = this.cartItems.find((item) => item.id == variantId);
    if (item) {
      item.quantity = newQuantity;
    }
  }

  /**
   * Handle item removed event
   * @param {Object} data - Remove data
   */
  onItemRemoved({ variantId }) {
    this.cartItems = this.cartItems.filter((item) => item.id != variantId);
  }

  /**
   * Handle fetch cart item event
   * @param {Array} data - Cart items data
   */
  onFetchCartItem(data) {
    this.cartItems = [...data];
  }

  // ================================================
  // DIALOG BUILDING METHODS
  // ================================================

  /**
   * Build dialog HTML
   * @param {Object} product - Product data
   * @param {Object} firstVariant - First available variant
   * @returns {string} Dialog HTML
   */
  buildDialog(product, firstVariant) {
    const cartItems = this.getCurrentCartItems();
    const cartItem = cartItems.find((item) => item.id === firstVariant.id);

    let optionsHtml = "";

    // Build options HTML
    product.options_with_values.slice().reverse().forEach((option) => {
      if (option.name === "Color") {
        optionsHtml += `
          <div class="dialog-colors">
            <p>Color</p>
            <div class="dialog-color-options" style="position: relative;">
              ${option.values.map(value => `
                <div class="btn-color-container">
                  <div class="btn-color-marker" style="background-color: ${value};"><span></span></div>
                  <button
                    data-color="${value}"
                    type="button"
                    class="dialog-color-btn ${firstVariant.options[1].toLowerCase() === value.toLowerCase() ? "selected" : ""}"
                    style="width: 100%;">
                    ${value}
                  </button>
                </div>
              `).join("")}
            </div>
          </div>
        `;
      }

      if (option.name === "Size") {
        optionsHtml += `
          <div class="dialog-sizes">
            <p>Sizes</p>
            <div class="select-wrapper">
              <img 
                width="16px"
                height="16px" 
                class="select-custom-arrow"
                src="${window.headerAssets.arrowDown}"
              />
              <select class="dialog-size-select">
                <option value="">Choose your size</option>
                ${option.values.map((value, i) =>
          `<option value="${value}" ${i === 0 ? "selected" : ""}>${value}</option>`
        ).join("")}
              </select>
            </div>
          </div>
        `;
      }
    });

    // Build price display
    const formattedPrice = window.money_with_currency_format?.replace(
      "{{amount}}",
      (cartItem?.final_line_price / 100).toFixed(2),
    );
    const price = `<p class="cart-item-price" style="margin-top: .5rem; font-size: 1.6rem;">Total price: <span style="font-weight: bold;"> ${formattedPrice} </span></p>`;

    return `
      <form method="post" action="/cart/add" class="form-add-product" id="QuickAddForm-${product.id}">
        <div class="dialog-body">
          <div class="dialog-header">
            <span></span>
             <button   class="dialog-close-btn" >
              <img src="${window.headerAssets.menuIcon}" height="14" width="14" alt="close-icon" />
            </button>
          </div>

          <div class="dialog-product">
            <img class="dialog-product-img" alt="feature-img" width="140" height="160"
                 src="${this.shopifyImageUrl(product.featured_image, 160, 140)}" />
            <div class="dialog-product-info">
              <h3 class="dialog-product-title">${product.title}</h3>
              <h3 class="dialog-product-price">${product.price}</h3>
              <p class="dialog-product-desc inline-wrap-5">${product.description}</p>
            </div>
          </div>

          ${optionsHtml}
        </div>

        <div class="dialog-footer" style="display: flex; flex-direction: column; align-items: start; margin-top: 1rem;">
          ${cartItem ? this.buildQuantityControls(cartItem, firstVariant, price) : this.buildAddToCartButton()}
        </div>
        
        <input type="hidden" name="id" class="variant-id-input" value="${firstVariant.id}">
      </form>
    `;
  }

  /**
   * Build quantity controls HTML
   * @param {Object} cartItem - Cart item data
   * @param {Object} variant - Product variant
   * @param {string} price - Formatted price HTML
   * @returns {string} Quantity controls HTML
   */
  buildQuantityControls(cartItem, variant, price) {
    return `
      <div 
        style="width: 100%; justify-content: space-around; align-items: center;"
        class="cart-item-quantity ${variant.available ? "" : "loading-wrapper"}" 
        data-variant-id="${cartItem.id}">
        <button  style="flex:1;" class="increase-button button-qty">
        +</button>
        <p style="flex:1; display:flex; justify-content: center;" class="product-quantity">
           ${cartItem.quantity}
        </p>
         <button  ${variant.available ? "" : "disabled"} 
                 style="flex:1; display: flex; justify-content: center;" 
                class="decrease-button button-qty">
          -
        </button>
      </div>
      ${price}
    `;
  }

  /**
   * Build add to cart button HTML
   * @returns {string} Add to cart button HTML
   */
  buildAddToCartButton() {
    return `
       <button  class="secondary ecom-expert-button AddCart-dialog" >
        <div class="content-btn">
          Add To Cart
          <img class="arrow-icon" src="${window.headerAssets.Arrow1}" height="24" width="24" alt="arrow" />
        </div>
      </button>
    `;
  }

  /**
   * Show dialog with animation
   * @param {HTMLElement} dialogContent - Dialog content element
   * @param {HTMLElement} overlay - Overlay element
   */
  showDialog(dialogContent, overlay) {
    if (dialogContent && overlay) {
      dialogContent.style.visibility = "visible";
      dialogContent.style.opacity = "1";
      overlay.style.visibility = "visible";
      overlay.style.opacity = "1";
      document.body.style.overflow = "hidden";
    }
  }

  /**
   bindDialogEvents - attach listeners for dynamic dialog content
   --------------------------------
   (English) Called after buildDialog sets innerHTML. Attaches form, color/select, close button, add-btn handlers.
   It records them into _dialogListeners for removal.

   * Bind dialog-specific events
   * @param {Object} product - Product data
   */
    bindDialogEvents(product) {
    // re-resolve dialogContent in case it was replaced
    this.dialogContent = document.querySelector(this.dialogContentSelector);
    if (!this.dialogContent) return;

    const attach = (el, type, handler, options) => {
      if (!el || typeof handler !== "function") return;
      el.addEventListener(type, handler, options);
      this._dialogListeners.push({ el, type, handler, options });
    };

    // close button inside dialog
    const closeBtn = this.dialogContent.querySelector(".dialog-close-btn");
    if (closeBtn) {
      // reuse bound method
      attach(closeBtn, "click", this._boundHandleCloseDialog);
    }

    // color options (delegated)
    const colorOptions = this.dialogContent.querySelector(".dialog-color-options");
    if (colorOptions) {
      if (!this._boundColorClick) {
        this._boundColorClick = (e) => {
          const btn = e.target.closest(".dialog-color-btn");
          if (!btn) return;
          colorOptions.querySelectorAll(".dialog-color-btn").forEach((b) => b.classList.remove("selected"));
          btn.classList.add("selected");
          this.selectedColor = btn.dataset.color;
          const variantInput = this.dialogContent.querySelector(".variant-id-input");
          const footer = this.dialogContent.querySelector(".dialog-footer");
          this.updateChanges?.(product, variantInput, this.dialogContent, footer);
        };
      }
      attach(colorOptions, "click", this._boundColorClick);
    }

    // size select
    const select = this.dialogContent.querySelector(".dialog-size-select");
    if (select) {
      if (!this._boundSelectChange) {
        this._boundSelectChange = (e) => {
          this.selectedSize = e.target.value;
   
          this.refreshDialogUI()
        };
      }
      attach(select, "change", this._boundSelectChange);
    }

    // form submit
    const form = this.dialogContent.querySelector("form[action='/cart/add']");
    if (form) {
      if (!this._boundFormSubmit) this._boundFormSubmit = this.handleAddToCart.bind(this);
      attach(form, "submit", this._boundFormSubmit);
    }

    // Add button (non-submit fallback)
    const addBtn = this.dialogContent.querySelector(".AddCart-dialog");
    if (addBtn) {
      if (!this._boundAddBtnClick) {
        this._boundAddBtnClick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const formEl = this.dialogContent.querySelector("form[action='/cart/add']");
          const fakeEvent = { target: formEl, submitter: addBtn, preventDefault() { }, stopPropagation() { } };
          this.handleAddToCart(fakeEvent);
        };
      }
      attach(addBtn, "click", this._boundAddBtnClick);
    }
  }


  // ================================================
  // DIALOG UPDATE METHODS
  // ================================================

  /**
   * Update dialog when variant selection changes
   * @param {Object} product - Product data
   * @param {HTMLElement} variantInput - Variant input element
   * @param {HTMLElement} dialogContent - Dialog content element
   * @param {HTMLElement} footer - Footer element
   */
  updateChanges(product, variantInput, dialogContent, footer) {
    const currentCartItems = this.cartItems;

    if (!this.selectedColor || !this.selectedSize) return;

    const selectedVariant = product.variants.find((v) => {
      const [size, color] = v.options;
      return (
        size.toLowerCase() === this.selectedSize.toLowerCase() &&
        color.toLowerCase() === this.selectedColor.toLowerCase()
      );
    });

    if (!selectedVariant) return;

    variantInput.value = selectedVariant.id;
    const addButton = dialogContent.querySelector(".AddCart-dialog");
    const findIsInCart = currentCartItems.find((item) => item.id === selectedVariant.id);

    if (findIsInCart) {
      this.updateFooterWithQuantityControls(footer, findIsInCart, selectedVariant);
    } else {
      this.updateFooterWithAddButton(footer);
    }

    // Update button availability
    if (selectedVariant.available && addButton) {
      addButton.classList.remove("disabled");
    } else if (addButton) {
      addButton.classList.add("disabled");
    }
  }

  /**
   * Update footer with quantity controls
   * @param {HTMLElement} footer - Footer element
   * @param {Object} cartItem - Cart item data
   * @param {Object} variant - Product variant
   */
  updateFooterWithQuantityControls(footer, cartItem, variant) {
    const formattedPrice = window.money_with_currency_format.replace(
      "{{amount}}",
      (cartItem.final_line_price / 100).toFixed(2),
    );
    footer.innerHTML = "";
    footer.style.flexDirection = "column";
    footer.style.alignItems = "start";
    footer.style.marginTop = "1.2rem";

    const quantityElement = `
      <div 
        style="width: 100%; justify-content: space-around; align-items: center;"
        class="cart-item-quantity ${variant.available ? "" : "loading-wrapper"}" 
        data-variant-id="${cartItem.id}">
        <button ${variant.available ? "" : "disabled"} style="flex:1;" class="increase-button button-qty">+</button>
        <p style="flex:1; display:flex; justify-content: center;" class="product-quantity">
           ${cartItem.quantity}
        </p>
         <button  ${variant.available ? "" : "disabled"} 
                style="flex:1; display: flex; justify-content: center;" 
                class="decrease-button button-qty">
          -
        </button>
      </div>
    `;

    const price = `<p class="cart-item-price" style="margin-top: .5rem; font-size: 1.6rem;">Total price: <span style="font-weight: bold;"> ${formattedPrice} </span></p>`;

    footer.insertAdjacentHTML("beforeend", quantityElement);
    footer.insertAdjacentHTML("beforeend", price);
  }

  /**
   * Update footer with add to cart button
   * @param {HTMLElement} footer - Footer element
   */
  updateFooterWithAddButton(footer) {
    footer.innerHTML = "";
    footer.querySelector(".cart-item-quantity")?.remove();
    footer.querySelector(".cart-item-price")?.remove();

    const btn = `
       <button  class="secondary ecom-expert-button AddCart-dialog">
        <div class="content-btn">
          Add To Cart
          <img class="arrow-icon" src="${window.headerAssets.Arrow1}" height="24" width="24" alt="arrow" />
        </div>
      </button>
    `;
    footer.insertAdjacentHTML("beforeend", btn);
  }

  /**
   * Refresh dialog UI after cart changes
   */
  refreshDialogUI() {
    if (!this.product || !this.dialogContent) return;

    const variantInput = this.dialogContent.querySelector(".variant-id-input");
    const footer = this.dialogContent.querySelector(".dialog-footer");

    if (!variantInput || !footer) return;

    this.updateChanges(this.product, variantInput, this.dialogContent, footer);
  }

  // ================================================
  // UTILITY METHODS
  // ================================================

  /**
   * Generate Shopify image URL with dimensions
   * @param {string} src - Original image URL
   * @param {number} width - Desired width
   * @param {number} height - Desired height
   * @returns {string} Formatted image URL
   */
  shopifyImageUrl(src, width, height) {
    if (!src) return "";
    const [base, query] = src.split("?");
    const extIndex = base.lastIndexOf(".");
    const sized = base.slice(0, extIndex) + `_${width}x${height}` + base.slice(extIndex);
    return query ? `${sized}?${query}` : sized;
  }

  /**
   * Get current cart items
   * @returns {Array} Current cart items
   */
  getCurrentCartItems() {
    return this.cartItems;
  }

  /**
   * Check if gift product should be added
   * @returns {boolean} Should add gift product
   */
  shouldAddGiftProduct() {
    return (
      this.selectedColor &&
      this.selectedSize &&
      this.selectedColor.toLowerCase() === "black" &&
      this.selectedSize.toLowerCase() === "m"
    );
  }

  /**
   * Add gift product to cart
   * @returns {Promise<Object|null>} Gift product data or null
   */
  async addGiftProduct() {
    
    try {
      const response = await fetch(`/products/dark-winter-jacket.json`);
      const softWinterJacket = await response.json();
      const findedVariantM_Black = softWinterJacket.product.variants.find((v) => {
        return v.option1.toLowerCase() === "m" && v.option2.toLowerCase() === "black";
      });

      if (findedVariantM_Black) {
        const dataCart = this.cartItems;
        const findIsThere = dataCart.items?.find((item) => item.id === findedVariantM_Black.id);

        if (!findIsThere) {
          const giftResponse = await fetch("/cart/add.js", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: findedVariantM_Black.id, quantity: 1 }),
          });
          return await giftResponse.json();
        }
      }
    } catch (error) {
      console.error("Error adding gift product:", error);
    }
    return null;
  }

  /**
   * Handle successful add to cart
   * @param {Object} dataProduct - Main product data
   * @param {Object} giftProduct - Gift product data (optional)
   */
  handleSuccessfulAddToCart(dataProduct, giftProduct) {
    this.onFetchCartItem(
      giftProduct ? [...this.cartItems, giftProduct, dataProduct] : [dataProduct, ...this.cartItems]
    );
    this.refreshDialogUI();

    // Update subtotal
    let subtotalObj = this.calculateSubtotalUpdate(dataProduct, giftProduct);

    // Emit events
    // use less event
    // this.cartManager.emit("cart:updated", {
    //   cartBody: this.cartManager.cartBody,
    //   dataProduct,
    //   giftProduct,
    // });

    this.cartManager.emit("cart:new-item-added", {
      dataProduct,
      giftProduct,
    });

    if (subtotalObj) {
      this.cartManager.subtotal = subtotalObj;
      this.cartManager.updateSubtotalDisplay();
    }

    this.handleCloseDialog();
    this.cartManager.open();
  }

  /**
   * Calculate subtotal update
   * @param {Object} dataProduct - Main product data
   * @param {Object} giftProduct - Gift product data (optional)
   * @returns {Object} Updated subtotal object
   */
  calculateSubtotalUpdate(dataProduct, giftProduct) {
    let subtotalObj = {};

    if (dataProduct) {
      subtotalObj = {
        items_subtotal_price: this.cartManager.subtotal.items_subtotal_price + dataProduct.final_line_price,
        original_total_price: this.cartManager.subtotal.original_total_price + dataProduct.original_price,
        total_discount: this.cartManager.subtotal.total_discount + dataProduct.total_discount,
        total_price: this.cartManager.subtotal.total_price + dataProduct.price,
        item_count: this.cartManager.subtotal.item_count + 1,
      };
    }

    if (giftProduct) {
      subtotalObj.items_subtotal_price += giftProduct.final_line_price;
      subtotalObj.original_total_price += giftProduct.original_price;
      subtotalObj.total_discount += giftProduct.total_discount;
      subtotalObj.total_price += giftProduct.price;
      subtotalObj.item_count += 1;
    }

    return subtotalObj;
  }

  /**
   * Handle quantity update after API call
   * @param {Object} item - Updated cart data
   * @param {string} variantId - Variant ID
   * @param {number} newQuantity - New quantity
   * @param {string} action - Action type (increase/decrease)
   */
  handleQuantityUpdate(item, variantId, newQuantity, action) {
    this.cartManager.emit(`cart:item-${action}d`, {
      variantId,
      newQuantity,
      item: item.items
    });
    this.onFetchCartItem(item.items);
    this.refreshDialogUI();

    this.cartManager.subtotal = {
      items_subtotal_price: item.items_subtotal_price,
      original_total_price: item.original_total_price,
      total_discount: item.total_discount,
      total_price: item.total_price,
      item_count: item.item_count,
    };
    this.cartManager.updateSubtotalDisplay();
    // console.log('item', item)
  }




  /**
   * Render cart item HTML
   * @param {Object} item - Cart item data
   * @returns {string} Cart item HTML
   */
  renderCartItem(item) {
    const price = window.money_with_currency_format.replace(
      "{{amount}}",
      (item.final_line_price / 100).toFixed(2)
    );

    return `
      <div class="cart-item" data-variant-id="${item.variant_id}">
        <img
          src="${item.image}"
          alt="${item.title}"
          width="100px"
          height="100px"
          class="cart-item-image">
        <div class="cart-item-details">
          <h3>${item.title}</h3>
          <div class="cart-item-quantity" data-variant-id="${item.variant_id}">
            <button 
              class="increase-button button-qty" 
              data-action="increase" 
              data-variant-id="${item.variant_id}">+
            </button>
            <p class="product-quantity">${item.quantity}</p>
            <button 
              class="decrease-button button-qty" 
              data-action="decrease" 
              data-variant-id="${item.variant_id}">-
            </button>
          </div>
          <p class="cart-item-price">${price}</p>
        </div>
      </div>
    `;
  }

  /**
   * Update subtotal display
   */
  onUpdateSubtotal() {
    const subtotal = (this.cartManager.subtotal.total_price / 100).toFixed(2);
    const summaryItems = this.cartManager.bulletTost?.querySelector("#summary-items");
    const summarySubtotal = this.cartManager.bulletTost?.querySelector("#summary-subtotal");
    const countElement = this.cartManager.bulletTost?.querySelector(".bullet-tost-count");

    if (summaryItems) summaryItems.textContent = this.cartManager.subtotal.item_count;
    if (summarySubtotal) summarySubtotal.textContent = window.money_with_currency_format.replace("{{amount}}", subtotal);

    const count = this.cartManager.subtotal.item_count;
    if (countElement) {
      countElement.textContent = count >= 10 ? "9+" : count.toString();
    }
  }

  /**
   * Destroy dialog and cleanup event listeners
   */
  destroy() {
    if (this.form) {
      this.form.removeEventListener("submit", this.handleAddToCart);
    }
  }
}

// ================================================
// INITIALIZATION
// ================================================

// Initialize the cart manager
// const cartManager = new ShopifyCartManager();

// Initialize the dialog
const DialogClasses = {
  overlaySelector: ".dialog-overlay",
  dialogContentSelector: ".dialog-content",
  dialogTriggerSelector: ".trigger-dialog",
  productItemSelector: ".product-item",
  productGridSelector: ".product-grid-section",
}
const dialog = new Dialog(DialogClasses);
window.dialog = dialog;



// // Ensure cartManager is a singleton and exists


// Section load
document.addEventListener("shopify:section:load", (event) => {
  const sectionEl = event.target;
  console.log(event)
  // if (!sectionEl || !sectionEl.querySelector?.(".dialog-content")) return;


  if (sectionEl._dialogInstance && typeof sectionEl._dialogInstance.destroy === "function") {
    sectionEl._dialogInstance.destroy();
  }

  const dialogInstance = new Dialog({
    overlaySelector: ".dialog-overlay",
    dialogContentSelector: ".dialog-content",
    dialogTriggerSelector: ".trigger-dialog",
    productItemSelector: ".product-item",
    productGridSelector: ".product-grid-section",
  });

  dialogInstance.cartManager = window.cartManager;


  sectionEl._dialogInstance = dialogInstance;
  console.log("section load" , sectionEl)
});

// Section unload
document.addEventListener("shopify:section:unload", (event) => {''
  const sectionEl = event.target;
  console.log("section unload" , sectionEl)
  if (sectionEl._dialogInstance && typeof sectionEl._dialogInstance.destroy === "function") {
    sectionEl._dialogInstance.destroy();
    delete sectionEl._dialogInstance;
  }
});