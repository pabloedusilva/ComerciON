let cart = [];
let modalQt = 1;
let modalKey = 0;
let modalType = 'pizza'; // 'pizza' ou 'drink'
let pizzas;
let drinks;
let currentData; // dados atuais sendo exibidos no modal

// GET CART BY SESSION STORAGE
localStorage.getItem("pizza_cart")
  ? (cart = JSON.parse(localStorage.getItem("pizza_cart")))
  : (cart = []);

// Função para compatibilizar carrinho antigo (qtd -> qt)
cart = cart.map(item => {
  if (item.qtd && !item.qt) {
    item.qt = item.qtd;
    delete item.qtd;
  }
  if (!item.type) {
    item.type = 'pizza'; // assume pizza para itens antigos
  }
  if (!item.price && item.id) {
    // Recuperar preço se não estiver salvo (será definido após carregar API)
    item.needsPriceUpdate = true;
  }
  return item;
});

const api = fetch("./apiData.json")
  .then(async (response) => await response.json())
  .then((data) => {
    pizzas = data.pizzas;
    drinks = data.drinks;

    // Atualizar preços de itens antigos no carrinho
    cart = cart.map(item => {
      if (item.needsPriceUpdate) {
        let dataArray = item.type === 'pizza' ? pizzas : drinks;
        let productItem = dataArray.find(product => product.id == item.id);
        if (productItem) {
          item.price = productItem.price[item.size];
        }
        delete item.needsPriceUpdate;
      }
      return item;
    });

    updateCart();

    //##LIST PIZZAS
    data.pizzas.map((item, index) => {
      //Mapear todos os objetos do JSON
      let pizzaItem = document
        .querySelector(".models .pizza-item")
        .cloneNode(true); //cloneNode() = Clona o elemento selecionado com a qtd do JSON
      pizzaItem.setAttribute("data-key", index); // colocando atributo e valor

      pizzaItem.querySelector(".pizza-item--img img").src = item.img;
      pizzaItem.querySelector(
        ".pizza-item--price"
      ).innerHTML = `${item.price[2].toLocaleString("pt-br", {
        style: "currency",
        currency: "BRL",
      })}`;
      pizzaItem.querySelector(".pizza-item--name").innerHTML = item.name;
      pizzaItem.querySelector(".pizza-item--desc").innerHTML = item.description;

      //### MODAL PIZZAS
      pizzaItem.querySelector("a").addEventListener("click", (e) => {
        e.preventDefault();
        let key = e.target.closest(".pizza-item").getAttribute("data-key");
        openModal(key, 'pizza');
      });

      document.querySelector(".pizza-area").append(pizzaItem);
    });

    //##LIST DRINKS
    data.drinks.map((item, index) => {
      let drinkItem = document
        .querySelector(".models .pizza-item")
        .cloneNode(true);
      drinkItem.setAttribute("data-key", index);

      drinkItem.querySelector(".pizza-item--img img").src = item.img;
      drinkItem.querySelector(
        ".pizza-item--price"
      ).innerHTML = `${item.price[2].toLocaleString("pt-br", {
        style: "currency",
        currency: "BRL",
      })}`;
      drinkItem.querySelector(".pizza-item--name").innerHTML = item.name;
      drinkItem.querySelector(".pizza-item--desc").innerHTML = item.description;

      //### MODAL DRINKS
      drinkItem.querySelector("a").addEventListener("click", (e) => {
        e.preventDefault();
        let key = e.target.closest(".pizza-item").getAttribute("data-key");
        openModal(key, 'drink');
      });

      document.querySelector(".drinks-area").append(drinkItem);
    });
  });

// Função para abrir modal (pizzas e drinks)
function openModal(key, type) {
  modalQt = 1;
  modalKey = key;
  modalType = type;
  currentData = type === 'pizza' ? pizzas : drinks;

  document.querySelector(".pizzaBig img").src = currentData[key].img;
  document.querySelector(".pizzaInfo h1").innerHTML = currentData[key].name;
  document.querySelector(".pizzaInfo--desc").innerHTML = currentData[key].description;
  document.querySelector(".pizzaInfo--actualPrice").innerHTML = `${currentData[key].price[2].toLocaleString("pt-br", {
    style: "currency",
    currency: "BRL",
  })}`;
  
  // Mostrar/ocultar área de personalização apenas para pizzas
  const customizeArea = document.querySelector(".pizzaInfo--customizearea");
  const removeIngredientsInput = document.getElementById("removeIngredients");
  
  if (type === 'pizza') {
    customizeArea.style.display = 'block';
    removeIngredientsInput.value = '';
  } else {
    customizeArea.style.display = 'none';
  }
  
  // Reset tamanhos
  document.querySelector(".pizzaInfo--size.selected")?.classList.remove("selected");
  document.querySelectorAll(".pizzaInfo--size").forEach((size, sizeIndex) => {
    if (sizeIndex == 2) {
      size.classList.add("selected");
    }
    size.querySelector("span").innerHTML = currentData[key].sizes[sizeIndex];
  });

  document.querySelector(".pizzaInfo--qt").innerHTML = modalQt;
  document.querySelector(".pizzaWindowArea").style.opacity = 0;
  document.querySelector(".pizzaWindowArea").style.display = "flex";
  setTimeout(() => {
    document.querySelector(".pizzaWindowArea").style.opacity = 1;
  }, 200);
}

//##MODAL EVENTS
function closeModal() {
  document.querySelector(".pizzaWindowArea").style.opacity = 0;
  setTimeout(() => {
    document.querySelector(".pizzaWindowArea").style.display = "none";
  }, 600);
  window.scrollTo(0, 0);
}

//Fechar modal com Esc
document.addEventListener("keydown", (event) => {
  const isEscKey = event.key === "Escape";
  if (document.querySelector(".pizzaWindowArea").style.display === "flex" && isEscKey) {
    closeModal();
  }
});

//Fechar modal com click no 'cancelar'
document
  .querySelectorAll(".pizzaInfo--cancelButton, .pizzaInfo--cancelMobileButton")
  .forEach((item) => {
    item.addEventListener("click", closeModal);
  });

//##CONTROLS
document.querySelector(".pizzaInfo--qtmenos").addEventListener("click", () => {
  if (modalQt > 1) {
    let size = parseInt(
      document
        .querySelector(".pizzaInfo--size.selected")
        .getAttribute("data-key")
    );
    let preco = currentData[modalKey].price[size];
    modalQt--;
    document.querySelector(".pizzaInfo--qt").innerHTML = modalQt;
    let updatePreco = preco * modalQt;
    document.querySelector(
      ".pizzaInfo--actualPrice"
    ).innerHTML = `${updatePreco.toLocaleString("pt-br", {
      style: "currency",
      currency: "BRL",
    })}`;
  }
});

document.querySelector(".pizzaInfo--qtmais").addEventListener("click", () => {
  let size = parseInt(
    document.querySelector(".pizzaInfo--size.selected").getAttribute("data-key")
  );
  let preco = currentData[modalKey].price[size];
  modalQt++;
  document.querySelector(".pizzaInfo--qt").innerHTML = modalQt;
  let updatePreco = preco * modalQt;
  document.querySelector(
    ".pizzaInfo--actualPrice"
  ).innerHTML = `${updatePreco.toLocaleString("pt-br", {
    style: "currency",
    currency: "BRL",
  })}`;
});

document.querySelectorAll(".pizzaInfo--size").forEach((size, sizeIndex) => {
  size.addEventListener("click", (e) => {
    document
      .querySelector(".pizzaInfo--size.selected")
      ?.classList.remove("selected");
    size.classList.add("selected");
    
    // Atualizar preço baseado no tamanho selecionado
    modalQt = 1;
    document.querySelector(".pizzaInfo--qt").innerHTML = modalQt;
    document.querySelector(
      ".pizzaInfo--actualPrice"
    ).innerHTML = `${currentData[modalKey].price[sizeIndex].toLocaleString("pt-br", {
      style: "currency", 
      currency: "BRL"
    })}`;
  });
});

//##ADD CART
document.querySelector(".pizzaInfo--addButton").addEventListener("click", () => {
  let size = parseInt(
    document.querySelector(".pizzaInfo--size.selected").getAttribute("data-key")
  );

  // Pegar ingredientes removidos (apenas para pizzas)
  let removedIngredients = '';
  if (modalType === 'pizza') {
    removedIngredients = document.getElementById("removeIngredients").value.trim();
  }

  let identifier = `${currentData[modalKey].id}@${size}@${removedIngredients}`;

  let key = cart.findIndex((item) => item.identifier == identifier);
  if (key > -1) {
    cart[key].qt += modalQt;
  } else {
    cart.push({
      identifier,
      id: currentData[modalKey].id,
      size,
      price: currentData[modalKey].price[size],
      qt: modalQt,
      type: modalType,
      removedIngredients: removedIngredients
    });
  }

  // Adicionar animação ao ícone do carrinho
  document.querySelector(".fa-cart-shopping").classList.add("pulse");

  updateCart();
  closeModal();
  //Salvar no localStorage
  localStorage.setItem("pizza_cart", JSON.stringify(cart));
});

// ##CART - Esta função será sobrescrita pelo cart.js
// Removida para evitar conflitos, usando apenas a versão do cart.js

//FINALIZAR PEDIDO
document.querySelector(".cart--finalizar").addEventListener("click", () => {
  document.querySelector("aside").classList.remove("show");
  cart = [];
  updateCart();
  localStorage.setItem("pizza_cart", JSON.stringify(cart));
});

//## MOBILE EVENTS
document.querySelector(".menu-openner").addEventListener("click", () => {
  if (cart.length > 0) {
    document.querySelector("aside").classList.add("show");
  }
});
document.querySelector(".menu-closer").addEventListener("click", () => {
  document.querySelector("aside").classList.remove("show");
});
