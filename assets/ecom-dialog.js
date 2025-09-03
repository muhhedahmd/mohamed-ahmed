

class Dialog extends ShopifyCartManager {
  constructor(options = {}) {
    super(options)

    this.overlaySelector = options.overlaySelector || ".overlay"
    this.dialogContentSelector = options.dialogContentSelector || ".dialog-content"
    this.dialogTriggerSelector = options.dialogTriggerSelector || ".trigger-dialog"
    this.productItemSelector = options.productItemSelector || ".product-item"
    this.productGridSelector = options.productGridSelector || ".product-grid-section"

    // Dialog HTML elements
    this.product = null
    this.dialogContent = null
    this.colorOptions = null
    this.select = null
    this.closeBtn = null
    this.form = null
    this.variantInput = null
    this.footer = null
    this.productsgrid = null
    this.overlay = null

    // State management
    this.isInitialized = false
    this.selectedColor = null
    this.selectedSize = null
    this.cartItems = cartManager.cartItems // shared state

    this.handleCloseDialog = this.handleCloseDialog.bind(this)
    this.handleItemQtyBtns = this.handleItemQtyBtns.bind(this)
    this.handleAddToCart = this.handleAddToCart.bind(this)

    this.init()
  }

  init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setup())
    } else {
      this.setup()
    }
  }

  async setup() {
    this.productsgrid = document.querySelector(this.productGridSelector)
    this.overlay = document.querySelector(this.overlaySelector)

    if (!this.productsgrid) {
      console.warn("Products Grid not Found", this.productGridSelector)
      return
    }

    this.dialogContent = document.querySelector(this.dialogContentSelector)
    if (!this.dialogContent) {
      console.warn("Dialog content not found", this.dialogContentSelector)
      return
    }

    this.colorOptions = this.dialogContent.querySelector(".dialog-color-options")
    this.select = this.dialogContent.querySelector("select.dialog-size-select")
    this.closeBtn = this.dialogContent.querySelector(".dialog-close-btn")
    this.form = this.dialogContent.querySelector("form[action='/cart/add']")
    this.variantInput = this.form?.querySelector(".variant-id-input")
    this.footer = this.dialogContent.querySelector(".dialog-footer")

    await cartManager.fetchCartItems()
    this.cartItems = cartManager.cartItems

    this.bindEvents()
    this.isInitialized = true
  }

  bindEvents() {
    if (this.productsgrid) {
      this.productsgrid.addEventListener("click", (e) => this.handleClickGrid(e))
    }
    if (this.overlay) {
      this.overlay.addEventListener("click", this.handleCloseDialog)
    }
  }

  handleCloseDialog(ev) {
    const dialogContent = document.querySelector(this.dialogContentSelector)
    if (this.overlay) {
      this.overlay.style.visibility = "hidden"
      this.overlay.style.opacity = "0"
    }
    if (dialogContent) {
      dialogContent.style.visibility = "hidden"
      dialogContent.style.opacity = "0"
    }
    document.body.style.overflowX = "hidden"
    document.body.style.overflowY = "auto"
  }

  handleClickGrid(e) {
    const trigger = e.target.closest(this.dialogTriggerSelector)
    if (!trigger) return

    const card = trigger.closest(this.productItemSelector)
    if (!card) return

    const productId = card.dataset.productId
    if (!productId) return

    const dataEl = document.getElementById(`product-data-${productId}`)
    if (!dataEl) return

    try {
      const product = JSON.parse(dataEl.textContent)
      this.product = product
      if (!product) return

      const getFirstAvailableVariant = product.variants.find((v) => v.available)
      if (!getFirstAvailableVariant) return

      this.selectedColor = getFirstAvailableVariant.options[1]
      this.selectedSize = getFirstAvailableVariant.options[0]

      const dialogContent = document.querySelector(this.dialogContentSelector)
      const overlay = this.overlay

      dialogContent.innerHTML = this.buildDialog(product, getFirstAvailableVariant)

      this.showDialog(dialogContent, overlay)
      this.bindDialogEvents(product, getFirstAvailableVariant)
    } catch (error) {
      console.error("Error parsing product data:", error)
    }
  }

  shopifyImageUrl(src, width, height) {
    if (!src) return ""
    const [base, query] = src.split("?")
    const extIndex = base.lastIndexOf(".")
    const sized = base.slice(0, extIndex) + `_${width}x${height}` + base.slice(extIndex)
    return query ? `${sized}?${query}` : sized
  }

  buildDialog(product, firstVariant) {
    let optionsHtml = ""

    const cartItem = cartManager.cartItems.find((item) => item.id === firstVariant.id)

    product.options_with_values
      .slice()
      .reverse()
      .forEach((option) => {
        if (option.name === "Color") {
          optionsHtml += `
            <div class="dialog-colors">
              <p>Color</p>
              <div class="dialog-color-options" style="position: relative;">
                ${option.values
                  .map(
                    (value) => `
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
                  `,
                  )
                  .join("")}
              </div>
            </div>
          `
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
                  ${option.values.map((value, i) => `<option value="${value}" ${i === 0 ? "selected" : ""}>${value}</option>`).join("")}
                </select>
              </div>
            </div>
          `
        }
      })

    return `
      <form method="post" action="/cart/add" class="form-add-product" id="QuickAddForm-${product.id}">
        <div class="dialog-body">
          <div class="dialog-header">
            <span></span>
            <button class="dialog-close-btn" type="button">
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

        <div class="dialog-footer">
          ${
            cartItem
              ? `
              <div 
                style="width: 100%; justify-content: space-around; align-items: center;"
                class="cart-item-quantity ${firstVariant.available ? "" : "loading-wrapper"}" 
                data-variant-id="${cartItem.id}">
                <button style="flex:1;" class="increase-button button-qty">+</button>
                <p style="flex:1; display:flex; justify-content: center;" class="product-quantity">
                   ${cartItem.quantity}
                </p>
                <button ${firstVariant.available ? "" : "disabled"} 
                        style="flex:1; display: flex; justify-content: center;" 
                        class="decrease-button button-qty">
                  -
                </button>
              </div>
            `
              : `
              <button class="secondary ecom-expert-button AddCart-dialog">
                <div class="content-btn">
                  Add To Cart
                  <img class="arrow-icon" src="${window.headerAssets.Arrow1}" height="24" width="24" alt="arrow" />
                </div>
              </button>
            `
          }
        </div>
        <input type="hidden" name="id" class="variant-id-input" value="${firstVariant.id}">
      </form>
    `
  }

  showDialog(dialogContent, overlay) {
    if (dialogContent && overlay) {
      dialogContent.style.visibility = "visible"
      dialogContent.style.opacity = "1"
      overlay.style.visibility = "visible"
      overlay.style.opacity = "1"
      document.body.style.overflow = "hidden"
    }
  }

  updateChanges(product, variantInput, dialogContent, footer) {
    if (!this.selectedColor || !this.selectedSize) return

    const selectedVariant = product.variants.find((v) => {
      const [size, color] = v.options
      return (
        size.toLowerCase() === this.selectedSize.toLowerCase() &&
        color.toLowerCase() === this.selectedColor.toLowerCase()
      )
    })

    if (!selectedVariant) return

    variantInput.value = selectedVariant.id
    const addButton = dialogContent.querySelector(".AddCart-dialog")

    const findIsInCart = cartManager.cartItems.find((item) => item.id === selectedVariant.id)

    if (findIsInCart) {
      footer.innerHTML = `
        <div 
          style="width: 100%; justify-content: space-around; align-items: center;"
          class="cart-item-quantity ${selectedVariant.available ? "" : "loading-wrapper"}" 
          data-variant-id="${findIsInCart.id}">
          <button ${selectedVariant.available ? "" : "disabled"} style="flex:1;" class="increase-button button-qty">+</button>
          <p style="flex:1; display:flex; justify-content: center;" class="product-quantity">
             ${findIsInCart.quantity}
          </p>
          <button ${selectedVariant.available ? "" : "disabled"} 
                  style="flex:1; display: flex; justify-content: center;" 
                  class="decrease-button button-qty">
            -
          </button>
        </div>
      `
    } else {
      footer.innerHTML = `
        <button class="secondary ecom-expert-button AddCart-dialog">
          <div class="content-btn">
            Add To Cart
            <img class="arrow-icon" src="${window.headerAssets.Arrow1}" height="24" width="24" alt="arrow" />
          </div>
        </button>
      `
    }

    if (selectedVariant.available && addButton) {
      addButton.classList.remove("disabled")
    } else if (addButton) {
      addButton.classList.add("disabled")
    }
  }

  bindDialogEvents(product, firstVariant) {
    const dialogContent = this.dialogContent
    if (!dialogContent) return

    const colorOptions = dialogContent.querySelector(".dialog-color-options")
    const select = dialogContent.querySelector(".dialog-size-select")
    const closeBtn = dialogContent.querySelector(".dialog-close-btn")
    const form = dialogContent.querySelector("form")
    const variantInput = dialogContent.querySelector(".variant-id-input")
    const footer = dialogContent.querySelector(".dialog-footer")

    if (closeBtn) closeBtn.addEventListener("click", this.handleCloseDialog)

    if (colorOptions) {
      colorOptions.addEventListener("click", (e) => {
        const btn = e.target.closest(".dialog-color-btn")
        if (!btn) return

        colorOptions.querySelectorAll(".dialog-color-btn").forEach((b) => b.classList.remove("selected"))
        btn.classList.add("selected")

        this.selectedColor = btn.dataset.color
        this.updateChanges(product, variantInput, dialogContent, footer)
      })
    }

    if (select) {
      select.addEventListener("change", (e) => {
        this.selectedSize = e.target.value
        this.updateChanges(product, variantInput, dialogContent, footer)
      })
    }

    if (form && variantInput) {
      form.addEventListener("submit", this.handleAddToCart)
    }
  }

  async renderCartItems() {
    try {
      const response = await fetch("/cart?section_id=ecom-product-cart")
      const data = await response.text()
      const body = document.querySelector(".bullet-tost-body")
      body.innerHTML = data

      const carts = await fetch("/cart.js")
      const cartsData = await carts.json()
      const subtotal = (cartsData.items_subtotal_price / 100).toFixed(2)
      document.getElementById("summary-items").textContent = cartsData.item_count
      document.getElementById("summary-subtotal").textContent = `$${subtotal}`
      const count = cartsData.item_count
      const countElement = document.querySelector(".bullet-tost-count")
      countElement.textContent = count >= 10 ? "9+" : count.toString()
      const bulletTost = document.querySelector(".bullet-tost")
      bulletTost.style.display = "block"
    } catch (error) {
      console.log(error)
    }
  }

  async handleItemQtyBtns(e) {
    const qtyWrapper = e.closest(".cart-item-quantity")
    if (!qtyWrapper) return

    const variantId = qtyWrapper.dataset.variantId
    const qtyElement = qtyWrapper.querySelector("p")
    const quantity = Number.parseInt(qtyElement.textContent, 10)

    if (e.classList.contains("increase-button")) {
      await this.updateQuantity(qtyWrapper, variantId, quantity + 1, qtyElement)
      await this.renderCartItems()
      await cartManager.fetchCartItems()
      this.cartItems = cartManager.cartItems
      this.refreshDialogUI()
    }

    if (e.classList.contains("decrease-button")) {
      await this.updateQuantity(qtyWrapper, variantId, quantity - 1, qtyElement)
      await this.renderCartItems()
      await cartManager.fetchCartItems()
      this.cartItems = cartManager.cartItems
      this.refreshDialogUI()
    }
  }

  refreshDialogUI() {
    if (!this.product || !this.dialogContent) return

    const variantInput = this.dialogContent.querySelector(".variant-id-input")
    const footer = this.dialogContent.querySelector(".dialog-footer")

    if (!variantInput || !footer) return


    this.updateChanges(this.product, variantInput, this.dialogContent, footer)
  }

  async handleAddToCart(e) {
    const form = e.target
    const variantInput = form.querySelector(".variant-id-input")
    const submitter = e.submitter

    e.preventDefault()
    e.stopPropagation()

    if (submitter && submitter.closest(".cart-item-quantity")) {
      await this.handleItemQtyBtns(submitter)
      return
    }

    try {
      if (!variantInput) return

      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: variantInput.value, quantity: 1 }),
      })

      if (
        this.selectedColor &&
        this.selectedSize &&
        this.selectedColor.toLowerCase() === "black" &&
        this.selectedSize.toLowerCase() === "m"
      ) {
        const getSoftWinterJacket = await fetch(`/products/dark-winter-jacket.json`)
        const softWinterJacket = await getSoftWinterJacket.json()
        const findedVariantM_Black = softWinterJacket.product.variants.find((v) => {
          return v.option1.toLowerCase() === "m" && v.option2.toLowerCase() === "black"
        })

        if (findedVariantM_Black) {
          const cart = await fetch("/cart.js")
          const dataCart = await cart.json()
          const findIsThere = dataCart.items.find((item) => item.id === findedVariantM_Black.id)

          if (!findIsThere) {
            await fetch("/cart/add.js", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: findedVariantM_Black.id, quantity: 1 }),
            })
          }
        }
      }

      await cartManager.fetchCartItems()
      this.cartItems = cartManager.cartItems
      this.renderCartItems()

      if (res.ok) {
        
        cartManager.toggleCartAnimation()
        this.handleCloseDialog()
      
      }
    } catch (error) {
      console.error("Error adding to cart:", error)
    }
  }
}

window.Dialog = new Dialog({})

document.addEventListener("shopify:section:load", (event) => {
  console.log(event, "loaded")
  if (event.detail.sectionId === "{{ section.id }}") {
    if (window.Dialog && typeof window.Dialog.destroy === "function") {
      window.Dialog.destroy()
    }
    window.Dialog = new Dialog()
  }
})

