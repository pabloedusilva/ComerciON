// Event listener removido para evitar duplicação
// A funcionalidade de adicionar ao carrinho está no geral.js
//Salvar itens do carrinho no localStorage
const saveCart = () => {
  localStorage.setItem("pizza_cart", JSON.stringify(cart));
};

document.querySelector(".menu-openner").addEventListener("click", () => {
  if (cart.length > 0) {
    document.querySelector("aside").style.left = 0;
  }
});

document.querySelector(".menu-closer").addEventListener("click", () => {
  document.querySelector("aside").style.left = "100vw";
});

function updateCart() {
  document.querySelector(".menu-openner span").innerHTML = cart.length;

  if (cart.length > 0) {
    document.querySelector("aside").classList.add("show");
    document.querySelector(".cart").innerHTML = ""; //Limpar carrinho

    let pizzasValor = 0;
    let subtotal = 0;
    let entrega = 5;
    let desconto = 0;
    let total = 0;

    for (let i in cart) {
      // Determinar se é pizza ou drink e buscar no array correto
      let dataArray = cart[i].type === 'pizza' ? pizzas : drinks;
      let pizzaItem = dataArray.find((item) => item.id == cart[i].id);
      
      // Se não encontrou o item, pular para o próximo
      if (!pizzaItem) {
        continue;
      }
      
      pizzasValor += cart[i].price * cart[i].qt;

      let pizzaSizeName = pizzaItem.sizes[cart[i].size];
      let pizzaName = `${pizzaItem.name} (${pizzaSizeName})`;
      
      // Adicionar ingredientes removidos se houver
      if (cart[i].removedIngredients && cart[i].removedIngredients.length > 0) {
        pizzaName += `<br><small style="color: #999; font-size: 11px;">Sem: ${cart[i].removedIngredients}</small>`;
      }
      
      let cartItem = document
        .querySelector(".models .cart--item")
        .cloneNode(true);

      cartItem.querySelector("img").src = pizzaItem.img;
      cartItem.querySelector(".cart--item-nome").innerHTML = pizzaName;
      cartItem.querySelector(".cart--item--qt").innerHTML = cart[i].qt;
      cartItem
        .querySelector(".cart--item-qtmenos")
        .addEventListener("click", () => {
          if (cart[i].qt > 1) {
            cart[i].qt--;
          } else {
            cart.splice(i, 1);
          }
          updateCart();
          saveCart();
        });
      cartItem
        .querySelector(".cart--item-qtmais")
        .addEventListener("click", () => {
          cart[i].qt++;
          updateCart();
          saveCart();
        });

      document.querySelector(".cart").append(cartItem);
    }

    subtotal = pizzasValor + entrega;
    desconto = subtotal * 0.1;
    total = subtotal - desconto;

    document.querySelector(
      ".pizzasValor span:last-child"
    ).innerHTML = `${pizzasValor.toLocaleString("pt-br", {
      style: "currency",
      currency: "BRL",
    })}`;
    document.querySelector(
      ".entrega span:last-child"
    ).innerHTML = `${entrega.toLocaleString("pt-br", {
      style: "currency",
      currency: "BRL",
    })}`;
    document.querySelector(
      ".subtotal span:last-child"
    ).innerHTML = `${subtotal.toLocaleString("pt-br", {
      style: "currency",
      currency: "BRL",
    })}`;
    document.querySelector(
      ".desconto span:last-child"
    ).innerHTML = `${desconto.toLocaleString("pt-br", {
      style: "currency",
      currency: "BRL",
    })}`;
    document.querySelector(
      ".total span:last-child"
    ).innerHTML = `${total.toLocaleString("pt-br", {
      style: "currency",
      currency: "BRL",
    })}`;
  } else {
    localStorage.clear();
    document.querySelector("aside").classList.remove("show"); //Closet cart
    document.querySelector("aside").style.left = "100vw";
  }
}

document.querySelector(".cart--finalizar").addEventListener("click", () => {
  cart = [];
  localStorage.clear();
  updateCart();
  document.querySelector(".fa-cart-shopping").classList.remove("pulse");
  document.querySelector(".loader-content").classList.add("display");

  setTimeout(() => {
    document.querySelector(".loader-content").classList.remove("display");

    document.querySelector(".success.pizzaWindowArea").style.opacity = 0;
    document.querySelector(".success.pizzaWindowArea").style.display = "flex";
    setTimeout(() => {
      document.querySelector(".success.pizzaWindowArea").style.opacity = 1;
    }, 200);
    document.querySelector(".success.pizzaWindowArea").style.display = "flex";

    setTimeout(() => {
      document.querySelector(".success.pizzaWindowArea").style.opacity = 0;
      setTimeout(() => {
        document.querySelector(".success.pizzaWindowArea").style.display =
          "none";
        updateCart();
        closeModal();
      }, 200);
    }, 4000);
  }, 2100);
});
