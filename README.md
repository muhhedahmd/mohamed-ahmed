# 🛍️ Shopify Theme – Ecom Expert

This repository contains a custom Shopify theme built for learning and experimentation.  
The theme is designed with a focus on reusable components, dynamic product rendering, and Shopify section schema blocks.

---

## 🚀 Features
- Custom **Shopify theme** with Liquid, HTML, CSS, and JavaScript.
- Sections and blocks with **`content_for`** and **dynamic product rendering**.
- Interactive **Dialog** and **Cart UI** using vanilla JavaScript.
- Responsive design with modern UI components.
- **Product data injection** using JSON for frontend interactions.
- Integration with **Time Doctor** for time tracking and productivity monitoring.

---

## 📂 Project Structure
```bash
templates/
  customers/
    account.liquid
    login.liquid
    register.liquid
    addresses.liquid

sections/
  ecom-product.liquid
  ecom-dialog-product.liquid
  ecom-cart.liquid
  ecom-toast.liquid
  ...

assets/
  ecom-product-card.css
  ecom-cart.js
  ecom-dialog.js
  ...
⚡ Note: Most custom development work is inside files starting with ecom-.

🔑 Store Preview
Storefront URL: Live Preview

Password: elsayedahmedmohamed123

🛠️ Setup
Clone the repo:

bash
Copy code
git clone https://github.com/your-username/your-repo.git
cd your-repo
Use Shopify CLI to serve the theme locally:

bash
Copy code
shopify theme serve
Modify sections and assets under sections/ and assets/.

🧪 Test Account (Time Doctor)
For productivity tracking during development, a temporary Time Doctor account was used.
You can use this account for testing:

graphql
Copy code
Email:    asshxx1234567@gmail.com
Password: asshxx1234567#A
