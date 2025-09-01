

// class fo handle events  

class EcomHeaderMenu {

    constructor(options = {}) {

        this.headerSelector = options.headerSelector || '.ecom-expert-header';
        this.buttonMenuSelector = options.buttonMenuSelector || '.button-menu';
        this.headerButtonSelector = options.headerButtonSelector || '.header-button';
        this.heroSelector = options.heroSelector || '.ecom-expert-hero';
        this.menuIcon = options.menuIcon || '.menu-icon';

        this.header = null;
        this.isInitialized = false;

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
        this.header = document.querySelector(this.headerSelector);
        
        if (!this.header) {
            console.warn(`Header element not found: ${this.headerSelector}`);
            return;
        }
        
        if (this.header) this.header.setAttribute("aria-expanded", "false"); 
        this.bindEvents();
        this.isInitialized = true;
    }

    
    bindEvents() {
        // Use arrow function to preserve 'this' context
        this.header.addEventListener('click', (event) => this.handleHeaderClick(event));
    }

    handleHeaderClick(event) {
        console.log('Header clicked');
        console.log('Target:', event.target);
        console.log('Parent:', event.target.parentElement);
        const getButton = event.target.closest(this.buttonMenuSelector);
 
        if (this.isMenuButton(event.target ) ||getButton  ) {

            this.toggleMenu(getButton);
        }
    }

    isMenuButton(element) {
        return element.classList.contains('button-menu') ||
            (element.parentElement && element.parentElement.classList.contains('button-menu'));
    }

    toggleMenu(button ) {
        const menuIcon = button.querySelector(this.menuIcon) ;
        const headerButton = document.querySelector(this.headerButtonSelector);
        const hero = document.querySelector(this.heroSelector);

        if (headerButton) {
            headerButton.classList.toggle('expanded');
            if(headerButton.classList.contains('expanded')) {
        this.header.setAttribute("aria-expanded", "true");

            // if(menuIcon) menuIcon.src = window.headerAssets.menuIcon 
        }
        else {

            this.header.setAttribute("aria-expanded", "false");

            // if(menuIcon) menuIcon.src = window.headerAssets.closeIcon;
        }

        if (hero) {
            hero.classList.toggle('main-hero-expanded');
        }

        console.log('Menu toggled');
    }
 }

    // Public methods for external control
    openMenu() {
        const headerButton = document.querySelector(this.headerButtonSelector);
        const hero = document.querySelector(this.heroSelector);

        if (headerButton) headerButton.classList.add('expanded');
        if (hero) hero.classList.add('main-hero-expanded');
    }

    closeMenu() {
        const headerButton = document.querySelector(this.headerButtonSelector);
        const hero = document.querySelector(this.heroSelector);

        if (headerButton) headerButton.classList.remove('expanded');
        if (hero) hero.classList.remove('main-hero-expanded');
    }

    destroy() {
        if (this.header) {
            this.header.removeEventListener('click', this.handleHeaderClick);
        }
        this.isInitialized = false;
    }
}


window.ecomHeaderMenu = new EcomHeaderMenu({
    headerSelector: '.ecom-expert-header',
    buttonMenuSelector: '.button-menu',
    headerButtonSelector: '.header-button',
    heroSelector: '.ecom-expert-hero'
});