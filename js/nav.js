let header = document.querySelector(".header");
header = header.innerHTML = `<div class="menu-area">
    <div class="mobile-left">
        <label for="checkbox" class="menu_hamburger">
            <input type="checkbox" id="checkbox">
            <span class="line line-main"></span>
            <span class="line line-split"></span>
        </label>
    </div>
    <div class="logo">
        <a href="index.html">
            <img src="images/logo_pizza.png" alt="logo_pizza.png">
        </a>
    </div>
    <nav>
        <div class="container-menu-mobile">
            <div class="menuMobile-area">
                <div class="menu-openner"><span>0</span>
                    <i class="fa-solid fa-cart-shopping"></i>
                </div>
            </div>
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
            </div>
        </div>
        <div class="menu">
            <ul>
                <a href="index.html">
                    <li>Início</li>
                </a>
                <a href="menu.html">
                    <li>Pizzas</li>
                </a>
                <a href="sobre.html">
                    <li>Sobre</li>
                </a>
                <a href="https://github.com/pabloedusilva" target="_blank">
                    <li>Contato</li>
                </a>
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
                </li>
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

toggleMenu.addEventListener("click", () => {
  openMenu.classList.toggle("menu-opened");
});

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
