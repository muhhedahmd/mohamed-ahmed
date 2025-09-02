


class Dialog {

    constructor(options = {}) {
        this.overlay = options.overlay || ".overlay"
        this.dialogContent = options.dialogContent || ".dialog-content"
        this.dialogTrigger = options.dialogTrigger || ".trigger-dialog"
        this.productItem = options.productItem || ".product-item"
        this.productsgrid = null
        this.overlay = null
        this.isInitialized = false;
        this.selectedColor = null
        this.selectedSize = null
        this.hahndleCloseDialog = this.hahndleCloseDialog.bind(this)

        this.init();
    }


    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.productsgrid = document.querySelector('.product-grid-section');
        this.overlay = document.querySelector('.overlay');
        if (!this.productsgrid) console.warn("products Grid not Found", this.productsgrid)
        this.bindEvents();
        this.isInitialized = true;
    }
    bindEvents() {
        this.productsgrid.addEventListener('click', (event) => this.handleClickGrid(event));
        this.overlay.addEventListener("click", (ev) => this.hahndleCloseDialog(ev))

    }
    hahndleCloseDialog(ev) {
        console.log(ev)
        if (!ev) return

        const dialogContent = document.querySelector(this.dialogContent)
        this.overlay.style.visibility = "hidden"
        this.overlay.style.opacity = "0"
        dialogContent.style.visibility = "hidden"
        dialogContent.style.opacity = "0"

    }

    handleClickGrid(e) {


        const trigger = e.target.closest(this.dialogTrigger);
        if (!trigger) return
        const card = trigger.closest(this.productItem);
        if (!card) return
        const productId = card.dataset.productId;
        if (!productId) return;
        const dataEl = document.getElementById(`product-data-${productId}`)
        if (!dataEl) return
        const product = JSON.parse(dataEl.textContent)
        if (!product) return
        const getFirstAvalibleVarient = product.variants.find((v) => v.available === true)
        this.selectedColor = getFirstAvalibleVarient.options[1]
        this.selectedSize = getFirstAvalibleVarient.options[0]

        function shopifyImageUrl(src, width, height) {
            if (!src) return '';
            const [base, query] = src.split('?');
            const extIndex = base.lastIndexOf('.');
            const sized = base.slice(0, extIndex) + `_${width}x${height}` + base.slice(extIndex);
            return query ? `${sized}?${query}` : sized;
        }


        function buildDialog(data) {
            let optionsHtml = '';

            data.options_with_values.slice().reverse().forEach(option => {
                if (option.name === "Color") {
                    optionsHtml += `
        <div class="dialog-colors">
          <p>Color</p>
          <div class="dialog-color-options" style="position: relative;">
            ${option.values.map(value => `
              <div class="btn-color-container">
                <div class="btn-color-marker" style="background-color: ${value};"> 
               <span>
               </span>

                </div>
                <button
           


                data-color='${value}'
                type="button"
${getFirstAvalibleVarient.options[1].toLowerCase() === value.toLowerCase()
                            ? "class='dialog-color-btn selected'"
                            : "class='dialog-color-btn'"
                        }                  style="width: 100%;"
                  data-color="${value}">${value}</button>
              </div>
            `).join('')}
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
          src='${window.headerAssets.arrowDown}'
          />
            <select class="dialog-size-select">
              <option value="">Choose your size</option>
              ${option.values.map((value, i) => `<option  ${i=== 0 ? "selected" : ""}  value="${value}">${value}</option>`).join('')}
            </select>
          </div>
        </div>
      `;
                }
            });

            return `
            <form  
                method="post"
    action="/cart/add"
    class="form-add-product"
    id="QuickAddForm-${product.id}"
            >



    <div class="dialog-body">

      <div class="dialog-header">
        <span></span>
        <button class="dialog-close-btn" type="button">
          <img
            src='${window.headerAssets.menuIcon}'
            height="14"
            width="14"
            alt="close-icon" />
        </button>
      </div>

      <div class="dialog-product">
        <img
          class="dialog-product-img"
          alt="feature-img"
          width="140"
          height="160"
          src="${shopifyImageUrl(data.featured_image, 160, 140)}" />

        <div class="dialog-product-info">
          <h3 class="dialog-product-title">${data.title}</h3>
          <h3 class="dialog-product-price">${data.price}</h3>
          <p class="dialog-product-desc inline-wrap-5">${data.description}</p>
        </div>
      </div>

      ${optionsHtml}
    </div>

    <div class="dialog-footer">
      <button class="secondary ecom-expert-button   AddCart-dialog"> 
       <div class="content-btn">
       Add To Cart
       <img 
       class="arrow-icon"
       src="${window.headerAssets.Arrow1}"
       height="24"
       width="24" 
       alt="arrow"
       />
       </div>
      </button>
    </div>
    <input type="hidden" name="id" class="variant-id-input" value=${getFirstAvalibleVarient.id}>
    <form/>
    `;
  }
  const dialogContent = document.querySelector(this.dialogContent)
  const overlay = document.querySelector('.overlay')
  dialogContent.innerHTML = buildDialog(product);
  if (dialogContent) {
      console.log(dialogContent)
      dialogContent.style.visibility = "visible"
      dialogContent.style.opacity = "1"
      overlay.style.visibility = "visible"
      overlay.style.opacity = "1"
      document.body.style.overflow = "hidden"
  }
  
  const colorOptions = document.querySelector(".dialog-color-options");
  const options = document.querySelectorAll(".dialog-content option");
  const select = document.querySelector(".dialog-content select") 


  const closebtn = document.querySelector(".dialog-close-btn")

  closebtn.addEventListener("click", (ev) => this.hahndleCloseDialog(ev))

  if(this.selectedSize){
    options.forEach(opt => {
        if(opt.value === this.selectedSize){
            opt.selected = true
        }
    })
    
  }





        // handle choose color
        colorOptions.addEventListener("click", (e) => {

            const btn = e.target.closest(".dialog-color-btn");
            if (!btn) return;

            colorOptions.querySelectorAll(".dialog-color-btn")
                .forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected")

            this.selectedColor = btn.dataset.color;
            updateChanges()

        });

        select.addEventListener("change", (ev) => {

            const option = ev.target.options[ev.target.selectedIndex];
            // console.log(option);
            this.selectedSize = option.value
            // console.log(option.text);
            updateChanges()

        });





        // reflect changes to button 
        const updateChanges = () => {


            console.log(
                {
                    selectedColor: this.selectedColor,
                    selectedSize: this.selectedSize

                }
            )
 
            if(!this.selectedColor || !this.selectedSize) return
            const getTheVarin = product.variants.find((varin)=>{
              const [size, color] = varin.options
              if(color.toLowerCase() === this.selectedColor.toLowerCase() && size.toLowerCase() === this.selectedSize.toLowerCase()){
                return varin
              }
                
            })
        
            if(!getTheVarin) return
            const input = document.querySelector(".variant-id-input")
            input.value = getTheVarin.id
            if(getTheVarin.available){
              document.querySelector(".AddCart-dialog").classList.remove("disabled")
            }else {
              document.querySelector(".AddCart-dialog").classList.add("disabled")
            }
            
        }


        const form = document.querySelector("form[action='/cart/add']")
        const getInput = document.querySelector(".variant-id-input") 
        if(!getInput || !form) return
        form.addEventListener("submit", (e) => {
            e.preventDefault()
            e.stopPropagation()

            fetch("/cart/add.js", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    id: getInput.value,
                    quantity: 1
                })
            }).then(res => {
                if (res.ok) {
                    this.hahndleCloseDialog()
                }
            })


        })



    }
}