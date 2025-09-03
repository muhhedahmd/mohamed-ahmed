class ShopifyCartManager {
    constructor() {
        this.bulletTost = document.querySelector(".bullet-tost")
        this.bulletTostInner = document.querySelector(".bullet-tost-inner")
        this.animBtn = document.querySelector(".anim-btn")
        this.overlay = document.querySelector(".overlay.bullet")
        this.cartBody = document.querySelector(".bullet-tost-body")
        this.cartItems = null
        this.clearCartBtn = document.querySelector(".clear-cart")
        this.HandleclearCart = this.HandleclearCart.bind(this)

        this.init()
    }
    async fetchCartItems() {
        const carts = await fetch("/cart.js")
        const cartsData = await carts.json()
        this.cartItems = cartsData.items
        return this.cartItems
    }

    init() {

        this.bindEvents()
        this.renderCartItems()
        this.fetchCartItems()
        this.fetchCartItems()
    }

    bindEvents() {
        // DOM content loaded event
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => this.renderCartItems())
        }

        // Shopify section load event
        document.addEventListener("shopify:section:load", (event) => {
            if (event.detail.sectionId === "{{ section.id }}") {
                this.renderCartItems()
            }
        })

        // Animation button click
        if (this.animBtn) {
            this.animBtn.addEventListener("click", (e) => this.toggleCartAnimation())
        }

        // Overlay click
        if (this.overlay) {
            this.overlay.addEventListener("click", (e) => this.closeCart())
        }

        // Cart body interactions
        if (this.cartBody) {
            this.cartBody.addEventListener("click", (e) => this.handleCartInteractions(e))
        }
        if(this.clearCartBtn) {
            this.clearCartBtn.addEventListener("click", this.HandleclearCart)
        }
    }



    async updateSubtotal() {
        try {
            const carts = await fetch("/cart.js")
            const cartsData = await carts.json()
            const subtotal = (cartsData.items_subtotal_price / 100).toFixed(2)

            const summaryItems = document.getElementById("summary-items")
            const summarySubtotal = document.getElementById("summary-subtotal")

            if (summaryItems) summaryItems.textContent = cartsData.item_count
            if (summarySubtotal) summarySubtotal.textContent = `$${subtotal}`
        } catch (error) {
            console.error("Error updating subtotal:", error)
        }
    }

    async renderCartItems() {
        try {
            const response = await fetch("/cart?section_id=ecom-product-cart")
            const data = await response.text()

            if (this.cartBody) {
                this.cartBody.innerHTML = data
            }

            const carts = await fetch("/cart.js")
            const cartsData = await carts.json()
            const subtotal = (cartsData.items_subtotal_price / 100).toFixed(2)

            const summaryItems = document.getElementById("summary-items")
            const summarySubtotal = document.getElementById("summary-subtotal")
            const countElement = document.querySelector(".bullet-tost-count")

            if (summaryItems) summaryItems.textContent = cartsData.item_count
            if (summarySubtotal) summarySubtotal.textContent = `$${subtotal}`

            const count = cartsData.item_count
            if (countElement) {
                countElement.textContent = count >= 10 ? "9+" : count.toString()
            }

            if (this.bulletTost) {
                this.bulletTost.style.display = "block"
            }
        } catch (error) {
            console.error("Error rendering cart items:", error)
        }
    }

    toggleCartAnimation() {
        if (!this.bulletTost || !this.bulletTostInner || !this.overlay) return

        this.bulletTost.classList.toggle("animate")
        this.bulletTostInner.classList.toggle("bullet-tost-header")

        if (this.bulletTost.classList.contains("animate")) {
            this.overlay.style.visibility = "visible"
            this.overlay.style.opacity = "1"
        } else {
            this.overlay.style.visibility = "hidden"
            this.overlay.style.opacity = "0"
        }
    }

    closeCart() {
        if (!this.bulletTost || !this.bulletTostInner || !this.overlay) return

        this.bulletTost.classList.remove("animate")
        this.bulletTostInner.classList.remove("bullet-tost-header")
        this.overlay.style.visibility = "hidden"
        this.overlay.style.opacity = "0"
    }

    updateBulletTostCount() {
        if (!this.cartBody) return

        const getAllQty = this.cartBody.querySelectorAll(".product-quantity")
        const countElement = document.querySelector(".bullet-tost-count")

        let total = 0

        getAllQty.forEach((itemCount) => {
            total += Number.parseInt(itemCount.textContent, 10) || 0
        })

        if (countElement) {
            countElement.textContent = total >= 10 ? "9+" : total.toString()
        }
    }



    async handleCartInteractions(e) {
        if (!e.target.classList.contains("decrease-button") && !e.target.classList.contains("increase-button")) {
            return
        }

        const qtyWrapper = e.target.closest(".cart-item-quantity")
        if (!qtyWrapper) return

        const variantId = qtyWrapper.dataset.variantId
        const qtyElement = qtyWrapper.querySelector("p")
        const quantity = Number.parseInt(qtyElement.textContent, 10) || 0

        if (e.target.classList.contains("increase-button")) {
            await this.updateQuantity(qtyWrapper, variantId, quantity + 1, qtyElement)
            await this.fetchCartItems()
        }

        if (e.target.classList.contains("decrease-button")) {
            await this.updateQuantity(qtyWrapper, variantId, quantity - 1, qtyElement)
            await this.fetchCartItems()
            console.log("Decreased quantity")
            console.log(this.cartItems)
            console.log("Decreased quantity")
        }
    }

    async updateQuantity(qtyWrapper, variantId, newQuantity, qtyElement) {
        try {
            this.setLoadingState(qtyWrapper, true)

            const res = await fetch("/cart/change.js", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    quantity: newQuantity,
                    id: variantId,
                }),
            })

            if (res.ok) {
                if (newQuantity > 0) {
                    qtyElement.textContent = newQuantity.toString()
                } else {
                    // Remove cart item if quantity goes to 0
                    const cartItem = qtyElement.closest(".cart-item")
                    if (cartItem) cartItem.remove()
                }

                this.updateBulletTostCount()
                await this.updateSubtotal()
            }
        } catch (error) {
            console.error("Error updating quantity:", error)
        } finally {
            this.setLoadingState(qtyWrapper, false)
        }
    }

    async HandleclearCart() {
        try {
            this.setLoadingState(this.cartBody, true)
            const res = await fetch("/cart/clear.js", { method: "POST" })
            if (res.ok) {
                this.cartBody.innerHTML = ""
                this.updateBulletTostCount()
                // this.fetchCartItems()
                await this.fetchCartItems()
                await this.updateSubtotal()
            }
        } catch (error) {
            console.error("Error clearing cart:", error)
        } finally {
            this.setLoadingState(this.cartBody, false)
        }
    }

    setLoadingState(qtyWrapper, isLoading) {

        const buttons = qtyWrapper.querySelectorAll("button")

        if (isLoading) {
            qtyWrapper.classList.add("loading-wrapper")
            buttons.forEach((btn) => {
                btn.classList.add("loading")
                btn.disabled = true
            })
        } else {
            qtyWrapper.classList.remove("loading-wrapper")
            buttons.forEach((btn) => {
                btn.classList.remove("loading")
                btn.disabled = false
            })
        }
    }

    // Public methods for external use
    refresh() {
        this.renderCartItems()
    }

    getCartCount() {
        const countElement = document.querySelector(".bullet-tost-count")
        return countElement ? countElement.textContent : "0"
    }

    open() {
        if (this.bulletTost && !this.bulletTost.classList.contains("animate")) {
            this.toggleCartAnimation()
        }
    }

    close() {
        if (this.bulletTost && this.bulletTost.classList.contains("animate")) {
            this.closeCart()
        }
    }
}

// Initialize the cart manager
const cartManager = new ShopifyCartManager()



document.addEventListener('shopify:section:load', function (event) {

    if (event.detail.sectionId === '{{ section.id }}') {
        if (window.ecomHeaderMenu) {
            window.ecomHeaderMenu.destroy();
        }
        window.ecomHeaderMenu = new EcomHeaderMenu();

    }
});