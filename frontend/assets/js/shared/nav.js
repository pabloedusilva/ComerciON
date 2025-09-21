let header = document.querySelector(".header");

// Detecta o caminho correto para assets baseado na localização atual
function getAssetsPath() {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/admin/')) {
        return '../../assets/';
    } else if (currentPath.includes('/customer/')) {
        return '../../assets/';
    } else {
        // Para páginas na raiz de pages/
        return '../assets/';
    }
}

// Detecta o caminho correto para navegação baseado na localização atual  
function getNavPath() {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/admin/')) {
        return '../';
    } else if (currentPath.includes('/customer/')) {
        return '../';
    } else {
        // Para páginas na raiz de pages/
        return './';
    }
}

const assetsPath = getAssetsPath();
const navPath = getNavPath();
const isIndexPage = /\/index\.html$/i.test(window.location.pathname);

const mobileCartMarkup = isIndexPage ? '' : `
            <div class="menuMobile-area">
                <div class="menu-openner"><span>0</span>
                    <i class="fa-solid fa-cart-shopping"></i>
                </div>
            </div>`;
const mobileProfileMarkup = isIndexPage ? '' : `
            <div class="profile-area">
                <div class="profile-icon" id="profileToggle">
                    <i class="fa-solid fa-user"></i>
                </div>
                <div class="profile-dropdown" id="profileDropdown">
                    <ul>
                        <li><a href="#"><i class="fa-solid fa-user-circle"></i> Meu Perfil</a></li>
                        <li><a href="#"><i class="fa-solid fa-shopping-bag"></i> Meus Pedidos</a></li>
                        <li><a href="#" class="logout"><i class="fa-solid fa-sign-out-alt"></i> Sair</a></li>
                    </ul>
                </div>
            </div>`;
const desktopProfileMarkup = isIndexPage ? '' : `
                <li class="desktop-profile-menu">
                    <div class="profile-area-desktop">
                        <div class="profile-icon" id="profileToggleDesktop">
                            <i class="fa-solid fa-user"></i>
                        </div>
                        <div class="profile-dropdown" id="profileDropdownDesktop">
                            <ul>
                                <li><a href="#"><i class="fa-solid fa-user-circle"></i> Meu Perfil</a></li>
                                <li><a href="#"><i class="fa-solid fa-shopping-bag"></i> Meus Pedidos</a></li>
                                <li><a href="#" class="logout"><i class="fa-solid fa-sign-out-alt"></i> Sair</a></li>
                            </ul>
                        </div>
                    </div>
                </li>`;

header = header.innerHTML = `<div class="menu-area">
    <div class="mobile-left">
        <label for="checkbox" class="menu_hamburger">
            <input type="checkbox" id="checkbox">
            <span class="line line-main"></span>
            <span class="line line-split"></span>
        </label>
    </div>
    <div class="logo">
        <a href="/">
            <img src="${assetsPath}images/default-images/logo_pizza.png" alt="logo_pizza.png">
        </a>
    </div>
    <nav>
        <div class="container-menu-mobile">
            ${mobileCartMarkup}
            ${mobileProfileMarkup}
        </div>
        <div class="menu">
            <ul>
                <a href="/">
                    <li>Início</li>
                </a>
                <a href="/menu">
                    <li>Cardápio</li>
                </a>
                <a href="/sobre">
                    <li>Sobre</li>
                </a>
                <a href="https://github.com/pabloedusilva" target="_blank">
                    <li>Contato</li>
                </a>
                ${desktopProfileMarkup}
            </ul>
        </div>
    </nav>
</div>`;

let activePage = window.location.pathname;
let navLinks = document.querySelectorAll("nav .menu a").forEach((link) => {
  if (link.href.includes(`${activePage}`)) {
    link.classList.add("active");
  }
});

let toggleMenu = document.querySelector("#checkbox");
let openMenu = document.querySelector(".menu");

if (toggleMenu && openMenu) {
    toggleMenu.addEventListener("click", () => {
        openMenu.classList.toggle("menu-opened");
    });
}

// Profile dropdown functionality - Mobile
let profileToggle = document.querySelector("#profileToggle");
let profileDropdown = document.querySelector("#profileDropdown");

// Profile dropdown functionality - Desktop
let profileToggleDesktop = document.querySelector("#profileToggleDesktop");
let profileDropdownDesktop = document.querySelector("#profileDropdownDesktop");

// Mobile profile dropdown
if (profileToggle && profileDropdown) {
  profileToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle("show");
  });
}

// Desktop profile dropdown
if (profileToggleDesktop && profileDropdownDesktop) {
  profileToggleDesktop.addEventListener("click", (e) => {
    e.stopPropagation();
    profileDropdownDesktop.classList.toggle("show");
  });
}

// Close dropdowns when clicking outside
document.addEventListener("click", (e) => {
    if (profileToggle && profileDropdown && !profileToggle.contains(e.target) && !profileDropdown.contains(e.target)) {
        profileDropdown.classList.remove("show");
    }
    if (profileToggleDesktop && profileDropdownDesktop && !profileToggleDesktop.contains(e.target) && !profileDropdownDesktop.contains(e.target)) {
        profileDropdownDesktop.classList.remove("show");
    }
});

// Close dropdowns when pressing Escape
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        if (profileDropdown) profileDropdown.classList.remove("show");
        if (profileDropdownDesktop) profileDropdownDesktop.classList.remove("show");
    }
});

// Atualizar badge do carrinho com base no localStorage (todas as páginas)
try {
    const badge = document.querySelector('.menu-openner span');
    if (badge) {
        const stored = localStorage.getItem('pizza_cart');
        const len = stored ? (JSON.parse(stored) || []).length : 0;
        badge.textContent = len;
    }
} catch (_) {}

// Comportamento do carrinho em dispositivos menores:
// - Se NÃO estiver no menu.html: redireciona para menu e sinaliza para abrir o carrinho
// - Se já estiver no menu.html: deixa o cart.js/geral.js cuidarem da abertura
(function(){
    const opener = document.querySelector('.menu-openner');
    if (!opener) return;

        opener.addEventListener('click', (ev) => {
            const path = window.location.pathname;
            const onMenu = /\/?menu(\.html)?$/i.test(path);
            if (!onMenu) {
            try { localStorage.setItem('pizzaria_open_cart_on_load', '1'); } catch(_) {}
            window.location.href = '/menu';
            ev.preventDefault();
            ev.stopPropagation();
        }
        // se já estiver no menu, os handlers do menu cuidarão da abertura
    }, { capture: true });

    // Atualizar badge em tempo real se o carrinho mudar em outra aba
        window.addEventListener('storage', (e) => {
        if (e.key === 'pizza_cart') {
            try {
                const badge = document.querySelector('.menu-openner span');
                if (!badge) return;
                const len = e.newValue ? (JSON.parse(e.newValue) || []).length : 0;
                badge.textContent = len;
            } catch(_) {}
        }
    });
})();
