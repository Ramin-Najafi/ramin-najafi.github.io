
let products = [];
let allProducts = [];
let trends = [];
let cart = [];
let wishlist = [];
let productPanelOpen = false;
let productPanel;
let latestDiv;
let resultsDiv;
let wishlistDiv;
let categoryDiv;
let cartItemsDiv;
let cartCountSpan;
let suggestionsDiv;

const MAX_TRENDS = 6;

async function fetchAndDisplayProducts() {
   try {
      const response = await fetch('https://dummyjson.com/products?limit=194');
      const data = await response.json();
      
      allProducts = data.products.map(p => ({
         id: p.id,
         title: p.title,
         price: p.price,
         category: p.category,
         image: p.thumbnail,
         description: p.description
      }));
      getTrendingProducts();
   } catch (error) {
      console.error("Failed to fetch products:", error);
      if (latestDiv) {
         latestDiv.innerHTML = "<p>Could not load products. Please check your connection and try again later.</p>";
      }
   }
}
$(document).ready(async function() {
   productPanel = document.querySelector('#productPanel');
   latestDiv = document.querySelector('#latest');
   resultsDiv = document.querySelector('#results');
   wishlistDiv = document.querySelector('#wishlistItems');
   categoryDiv = document.querySelector('#categoryItems');
   cartItemsDiv = document.querySelector('#cartItems');
   cartCountSpan = document.querySelector('#cartCount');
   suggestionsDiv = document.querySelector('#suggestions');
   
   loadFromLocalStorage();
   await fetchAndDisplayProducts();

   document.querySelector('#smlLogo').onclick = function(){ searchProducts(); };
   document.querySelector('#txtSearch').addEventListener('keydown',function(e){ if(e.key==='Enter') searchProducts(); });
   document.querySelector('#txtSearch').addEventListener('input',function(){ showSuggestions(); });
   document.querySelector('#backToCategoriesBtn').onclick = showCategories;
   
   updateCartCount();

   let currentPage = localStorage.getItem('currentPage');
   if(currentPage === 'about') showAbout();
   else if(currentPage === 'wishlist') showWishlist();
   else if(currentPage === 'categories') showCategories();
   else showHome();
});
function saveToLocalStorage() {
   localStorage.setItem('shopall_cart', JSON.stringify(cart));
   localStorage.setItem('shopall_wishlist', JSON.stringify(wishlist));
}
function loadFromLocalStorage() {
   let savedCart = localStorage.getItem('shopall_cart');
   let savedWishlist = localStorage.getItem('shopall_wishlist');
   if(savedCart) cart = JSON.parse(savedCart);
   if(savedWishlist) wishlist = JSON.parse(savedWishlist);
}
function getTrendingProducts() {
   trends = [];
   
   let eligibleProducts = [];
   let eligibleCategories = ['laptops', 'fragrances', 'furniture'];
   for (let i = 0; i < allProducts.length; i++) {
      if (eligibleCategories.includes(allProducts[i].category)) {
         eligibleProducts.push(allProducts[i]);
      }
   }

   while(trends.length < Math.min(MAX_TRENDS, eligibleProducts.length)) {
      const randomIndex = Math.floor(Math.random() * eligibleProducts.length);
      const selected = eligibleProducts.splice(randomIndex, 1)[0];
      trends.push(selected);
   }
   displayTrends();
}
function searchProducts() {
   document.querySelector('#backToCategoriesBtn').style.display = 'none';
   let query = document.querySelector('#txtSearch').value;
   if(!query || query.trim() === '') {
      return;
   }
   suggestionsDiv.style.display = 'none';
   
   let searchTerm = query.toLowerCase();
   products = [];
   for(let i=0; i<allProducts.length; i++){
      let item = allProducts[i];
      let titleLower = item.title.toLowerCase();
      let categoryLower = item.category.toLowerCase();
      if(titleLower.includes(searchTerm) || categoryLower.includes(searchTerm)){
         products.push(item);
      }
   }
   if(products.length === 0){
      resultsDiv.innerHTML = '<p style="padding:50px; font-size:1.5em;"><strong>No products found. Try searching for:</strong> Laptop, Watch, Cucumber, etc... or go to our Categories page for more</p>';
      document.querySelector('#resultsTitle').style.display = 'block';
      document.querySelector('#resultsSection').scrollIntoView({ behavior: 'smooth' });
   } else {
      showProducts();
   }
}
function showSuggestions() {
   let query = document.querySelector('#txtSearch').value;
   if(!query || query.trim() === '') {
      suggestionsDiv.style.display = 'none';
      return;
   }
   let searchTerm = query.toLowerCase();
   let suggestions = [];
   for(let i=0; i<allProducts.length; i++){
      let item = allProducts[i];
      let titleLower = item.title.toLowerCase();
      if(titleLower.includes(searchTerm)){
         suggestions.push(item);
         if(suggestions.length >= 5) break;
      }
   }
   if(suggestions.length === 0){
      suggestionsDiv.style.display = 'none';
      return;
   }
   suggestionsDiv.innerHTML = '';
   for(let i=0; i<suggestions.length; i++){
      let item = suggestions[i];
      let suggestionDiv = document.createElement('div');
      suggestionDiv.innerText = item.title;
      suggestionDiv.onclick = function(){
         document.querySelector('#txtSearch').value = item.title;
         suggestionsDiv.style.display = 'none';
         searchProducts();
      };
      suggestionsDiv.appendChild(suggestionDiv);
   }
   suggestionsDiv.style.display = 'block';
}
function getProductDetails(id) {
   let data = null;
   for(let i=0; i<allProducts.length; i++){
      if(allProducts[i].id === id){
      data = allProducts[i];
      break;
      }
   }
   if(data) displayProductDetails(data);
}
function displayTrends() {
   latestDiv.innerHTML = '';
   if(trends.length === 0)
      return;
   for(let i=0; i<trends.length; i++){
      let item = trends[i];

      let card = document.createElement('div');
      card.className = 'product-card-small';

      let img = document.createElement('img');
      img.src = item.image;
      img.alt = item.title;
      img.id = item.id;
      img.classList.add('smlPoster');
      img.onclick = function(){
         getProductDetails(item.id);
      };
      card.appendChild(img);

      let addBtn = document.createElement('button');
      addBtn.innerText = 'Add to Cart';
      addBtn.className = 'card-add-btn';
      addBtn.onclick = function(e) {
          e.stopPropagation();
          addToCart(item);
      };
      card.appendChild(addBtn);

      latestDiv.appendChild(card);
   }
}
function showProducts() {
   resultsDiv.innerHTML='';
   document.querySelector('#resultsTitle').style.display='block';
   document.querySelector('#resultsSection').style.display='block';
   for(let i=0; i<products.length; i++){
      let item = products[i];
      
      let card = document.createElement('div');
      card.className = 'product-card';
      card.onclick = function(){
         getProductDetails(item.id);
      };

      let img = document.createElement('img');
      img.src = item.image;
      img.alt = item.title;
      img.classList.add('poster');
      card.appendChild(img);
      
      let title = document.createElement('p');
      title.className = 'product-title';
      if(item.title.length > 60){
         title.innerText = item.title.substring(0,60) + '...';
      } else {
         title.innerText = item.title;
      }
      card.appendChild(title);
      
      let price = document.createElement('p');
      price.className = 'product-price';
      price.innerText = '$' + item.price;
      card.appendChild(price);
      
      let addBtn = document.createElement('button');
      addBtn.innerText = 'Add to Cart';
      addBtn.className = 'card-add-btn';
      addBtn.onclick = function(e) {
         e.stopPropagation();
         addToCart(item);
      };
      card.appendChild(addBtn); 
      resultsDiv.appendChild(card);
   }
   document.querySelector('#resultsSection').scrollIntoView({ behavior: 'smooth' });
}
function displayProductDetails(data) {
   productPanel.innerHTML = '';
   
   let controls = document.createElement('div');
   controls.id = 'controls';
   
   let closeBtn = document.createElement('span');
   closeBtn.id = 'closeBtn';
   closeBtn.innerText = 'X';
   closeBtn.onclick = toggleProductPanel;
   
   controls.appendChild(closeBtn);
   
   productPanel.appendChild(controls);
   
   let leftPanel = document.createElement('div');
   leftPanel.classList.add('leftProductPanel');
   
   let img = document.createElement('img');
   img.src = data.image;
   img.classList.add('largePoster');
   
   leftPanel.appendChild(img);
   
   let title = document.createElement('h1');
   title.innerText = data.title;
   
   leftPanel.appendChild(title);
   
   let price = document.createElement('div');
   price.innerText = '$' + data.price;
   price.classList.add('price');
   
   leftPanel.appendChild(price);
   
   let desc = document.createElement('p');
   desc.innerText = data.description;
   
   leftPanel.appendChild(desc);
   
   productPanel.appendChild(leftPanel);
   
   let addBtn = document.createElement('button');
   addBtn.type = 'button';
   addBtn.innerText = 'Add to Cart';
   addBtn.classList.add('addBtn');
   addBtn.onclick = function(){ addToCart(data); };
   
   productPanel.appendChild(addBtn);
   
   let wishBtn = document.createElement('button');
   wishBtn.type = 'button';
   wishBtn.innerText = 'Add to Wishlist';
   wishBtn.classList.add('wishlistBtn');
   wishBtn.onclick = function(){ addToWishlist(data); };
   
   productPanel.appendChild(wishBtn);
   
   toggleProductPanel();
}
function showWishlist() {
   document.querySelector('#trendingSection').style.display = 'none';
   document.querySelector('#aboutSection').style.display = 'none';
   document.querySelector('#resultsSection').style.display = 'none';
   document.querySelector('#wishlistSection').style.display = 'block';
   document.querySelector('#categoriesSection').style.display = 'none';
   localStorage.setItem('currentPage', 'wishlist');

   wishlistDiv.innerHTML = '';
   if(wishlist.length === 0){
      wishlistDiv.innerHTML = '<p>Your wishlist is empty!</p>';
      return;
   }
   for(let i=0; i<wishlist.length; i++){
      let item = wishlist[i];
      
      let card = document.createElement('div');
      card.style.display = 'inline-block';
      card.style.margin = '10px';
      card.style.position = 'relative';
      
      let img = document.createElement('img');
      img.src = item.image;
      img.alt = item.title;
      img.classList.add('poster');
      img.onclick = function(){ getProductDetails(item.id); };
      
      card.appendChild(img);
      
      let removeBtn = document.createElement('button');
      removeBtn.innerText = 'Remove';
      removeBtn.style.display = 'block';
      removeBtn.style.margin = '10px auto';
      removeBtn.style.padding = '8px 20px';
      removeBtn.style.background = '#f00';
      removeBtn.style.color = '#fff';
      removeBtn.style.border = 'none';
      removeBtn.style.borderRadius = '4px';
      removeBtn.style.cursor = 'pointer';
      removeBtn.onclick = function(){ removeFromWishlist(item.id); };
      
      card.appendChild(removeBtn);
      
      wishlistDiv.appendChild(card);
   }
}
function removeFromWishlist(itemId) {
   let newWishlist = [];
   for(let i=0; i<wishlist.length; i++){
      if(wishlist[i].id !== itemId){
         newWishlist.push(wishlist[i]);
      }
   }
      wishlist = newWishlist;
      saveToLocalStorage();
      if(document.querySelector('#wishlistSection').style.display === 'block'){
         showWishlist();
      }
}
function showCategories() {
      document.querySelector('#trendingSection').style.display = 'none';
      document.querySelector('#aboutSection').style.display = 'none';
      document.querySelector('#resultsSection').style.display = 'none';
      document.querySelector('#wishlistSection').style.display = 'none';
      document.querySelector('#categoriesSection').style.display = 'block';
      localStorage.setItem('currentPage', 'categories');
      
      categoryDiv.innerHTML = '';
      
      let foundCategories = {};
      let categories = [];
      for (let i = 0; i < allProducts.length; i++) {
         let catName = allProducts[i].category;
         if (!foundCategories[catName]) {
            foundCategories[catName] = true;
            categories.push({ 
               name: catName.charAt(0).toUpperCase() + catName.slice(1).replace(/-/g, ' '),
               category: catName 
            });
         }
      }

      for(let i=0; i<categories.length; i++){
         let cat = categories[i];
         
         let card = document.createElement('div');
         card.style.display = 'inline-block';
         card.style.margin = '20px';
         card.style.padding = '40px 60px';
         card.style.background = '#fc0';
         card.style.borderRadius = '8px';
         card.style.cursor = 'pointer';
         card.style.fontSize = '1.5em';
         card.style.fontWeight = 'bold';
         card.onclick = function(){
            searchByCategory(cat.category);
         };
         card.innerText = cat.name;

         categoryDiv.appendChild(card);
   }
}
function showHome() {
   document.querySelector('#trendingSection').style.display = 'block';
   document.querySelector('#aboutSection').style.display = 'none';
   document.querySelector('#resultsSection').style.display = 'none';
   document.querySelector('#wishlistSection').style.display = 'none';
   document.querySelector('#categoriesSection').style.display = 'none';
   localStorage.setItem('currentPage', 'home');
}
function showAbout() {
   document.querySelector('#trendingSection').style.display = 'none';
   document.querySelector('#aboutSection').style.display = 'block';
   document.querySelector('#resultsSection').style.display = 'none';
   document.querySelector('#wishlistSection').style.display = 'none';
   document.querySelector('#categoriesSection').style.display = 'none';
   localStorage.setItem('currentPage', 'about');
}
function searchByCategory(category) {
   products = [];
   for (let i = 0; i < allProducts.length; i++) {
      if (allProducts[i].category === category) {
         products.push(allProducts[i]);
      }
   }
   document.querySelector('#trendingSection').style.display = 'none';
   document.querySelector('#aboutSection').style.display = 'none';
   document.querySelector('#resultsSection').style.display = 'block';
   document.querySelector('#wishlistSection').style.display = 'none';
   document.querySelector('#categoriesSection').style.display = 'none';
   document.querySelector('#backToCategoriesBtn').style.display = 'block';
   showProducts();
}
function addToCart(item) {
   let exists = false;
   for(let i=0; i<cart.length; i++){
      if(cart[i].id === item.id){
         cart[i].quantity = cart[i].quantity + 1;
         exists = true;
         break;
      }
   }
   if(!exists){
      item.quantity = 1;
      cart.push(item);
   }
   removeFromWishlist(item.id);
   saveToLocalStorage();
   updateCartCount();
   displayCart();
   if (productPanelOpen) {
      toggleProductPanel();
   }
}
function removeFromCart(itemId) {
   let newCart = [];
   for (let i = 0; i < cart.length; i++) {
      if (cart[i].id !== itemId) {
         newCart.push(cart[i]);
      }
   }
   cart = newCart;
   saveToLocalStorage();
   updateCartCount();
   displayCart();
}
function incrementQuantity(itemId) {
    for (let i = 0; i < cart.length; i++) {
        if (cart[i].id === itemId) {
            cart[i].quantity++;
            saveToLocalStorage();
            updateCartCount();
            displayCart();
            break;
        }
    }
}

function decrementQuantity(itemId) {
    for (let i = 0; i < cart.length; i++) {
        if (cart[i].id === itemId) {
            cart[i].quantity--;
            if (cart[i].quantity === 0) {
                cart.splice(i, 1);
            }
            saveToLocalStorage();
            updateCartCount();
            displayCart();
            break;
        }
    }
}

function buyNow() {
   if(cart.length === 0)
      return;
   let subtotal = parseFloat(document.querySelector('#totalPrice').innerText.replace('$', ''));
   let tax = subtotal * 0.13;
   let total = subtotal + tax;
   
   document.querySelector('#confirmTotal').innerText = '$' + total.toFixed(2) + ' (includes 13% tax)';
   document.querySelector('#confirmPopup').style.display = 'block';
}
function completePurchase() {
   cart = [];
   saveToLocalStorage();
   updateCartCount();
   displayCart();
   document.querySelector('#confirmPopup').style.display = 'none';
   document.querySelector('#successPopup').style.display = 'block';
}
function closeConfirmPopup() {
   document.querySelector('#confirmPopup').style.display = 'none';
}
function closeSuccessPopup() {
   document.querySelector('#successPopup').style.display = 'none';
}
function closePurchasePopup() {
   document.querySelector('#purchasePopup').style.display = 'none';
}
function updateCartCount() {
   let count = 0;
   for(let i=0; i<cart.length; i++){
      count += cart[i].quantity;
   }
   if(cartCountSpan) cartCountSpan.innerText = count;
}
function displayCart() {
   cartItemsDiv.innerHTML = '';
   if(cart.length === 0){
      cartItemsDiv.innerHTML = '<p style="text-align:center;">Your cart is empty</p>';
      document.querySelector('#totalPrice').innerText = '$0.00';
      return;
  }
  let total = 0;
  for(let i=0; i<cart.length; i++){
   let item = cart[i];
   let cartItem = document.createElement('div');
   
   cartItem.classList.add('cartItem');
   
   let img = document.createElement('img');
   
   img.src = item.image;
   cartItem.appendChild(img);
   
   let info = document.createElement('div');
   info.classList.add('cartItemInfo');
   
   let title = document.createElement('h4');
   title.innerText = item.title;
   info.appendChild(title);
   
   let price = document.createElement('p');
   price.className = 'cart-item-price';
   price.innerText = '$' + item.price.toFixed(2);
   info.appendChild(price);

   let quantityControls = document.createElement('div');
   quantityControls.className = 'quantity-controls';

   let minusBtn = document.createElement('button');
   minusBtn.className = 'quantity-btn';
   minusBtn.innerText = '−';
   minusBtn.onclick = function(e) { e.stopPropagation(); decrementQuantity(item.id); };
   quantityControls.appendChild(minusBtn);

   let quantityDisplay = document.createElement('span');
   quantityDisplay.className = 'quantity-display';
   quantityDisplay.innerText = item.quantity;
   quantityControls.appendChild(quantityDisplay);

   let plusBtn = document.createElement('button');
   plusBtn.className = 'quantity-btn';
   plusBtn.innerText = '+';
   plusBtn.onclick = function(e) { e.stopPropagation(); incrementQuantity(item.id); };
   quantityControls.appendChild(plusBtn);
   
   info.appendChild(quantityControls);

   let removeBtn = document.createElement('button');
   removeBtn.innerText = 'Remove';
   removeBtn.classList.add('removeBtn');
   removeBtn.onclick = function(e){ e.stopPropagation(); removeFromCart(item.id); };
   
   info.appendChild(removeBtn);
   cartItem.appendChild(info);
   cartItemsDiv.appendChild(cartItem);
   
   total = total + (item.price * item.quantity);
  }
  document.querySelector('#totalPrice').innerText = '$' + total.toFixed(2);
}
function addToWishlist(item) {
   let exists = false;
   for(let i=0; i<wishlist.length; i++){
      if(wishlist[i].id === item.id){
         exists = true;
         break;
      }
   }
   if(exists){
      return;
   }
   wishlist.push(item);
   saveToLocalStorage();
   if(productPanelOpen) {
      toggleProductPanel();
   }
}
function toggleProductPanel() {
   if(!productPanelOpen) $('#productPanel').animate({ bottom: 0 }, 320, 'swing');
   else $('#productPanel').animate({ bottom: -750 }, 260, 'swing');
   productPanelOpen = !productPanelOpen;
}
let menuOpen = false;

function toggleMenu() {
   if(!menuOpen) {
      $('#sideMenu').animate({ right: 0 }, 300, 'swing');
      $('#hamburger').addClass('open');
   } else {
      closeNav();
   }
   menuOpen = !menuOpen;
}
function closeNav() {
   $('#sideMenu').animate({ right: -226 }, 300, 'swing');
   $('#hamburger').removeClass('open');
   menuOpen = false;
}
$(document).click(function(e) {
   if(menuOpen && !$(e.target).closest('#sideMenu, #hamburger').length) closeNav();
   if($('#cartPanel').hasClass('open') && !$(e.target).closest('#cartPanel, #cart').length) {
      $('#cartPanel').removeClass('open');
   }
   if(productPanelOpen && !$(e.target).closest('#productPanel').length && !$(e.target).hasClass('poster') && !$(e.target).hasClass('smlPoster')) {
      toggleProductPanel();
   }
   if(!$(e.target).closest('#search').length) {
      suggestionsDiv.style.display = 'none';
   }
});
function toggleCart(){
   $('#cartPanel').toggleClass('open');
   displayCart();
}
function showBox(src){
   $('#lightbox').css('visibility','visible');
   $('#lightboxImage').attr('src',src);
}
function hideBox(){
   $('#lightbox').css('visibility','hidden');
}