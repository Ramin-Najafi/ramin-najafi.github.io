# ShopAll - Multi-Category E-Commerce Web Application

A fully functional e-commerce web application that aggregates products from multiple categories into a unified shopping experience. Built with vanilla JavaScript and powered by the DummyJSON API.

![ShopAll Logo](assets/images/logo.png)

## 🌟 Overview

ShopAll is a comprehensive shopping platform that brings together diverse product categories—from electronics to furniture to fragrances—in one convenient location. The application provides a seamless user experience with real-time product data, intelligent search functionality, and persistent shopping cart and wishlist features.

**Live Demo:** [View on GitHub Pages](https://ramin-najafi.github.io/api_project/) *(if deployed)*

---

## ✨ Key Features

### Product Discovery
- **Dynamic Product Catalog:** Fetches 194+ products from external API with real-time data
- **Smart Search:** Instant search with auto-suggestions as you type
- **Category Browsing:** Organized product categories for easy navigation
- **Best Sellers Section:** Curated trending products featuring laptops, fragrances, and furniture
- **Detailed Product Views:** Pop-up panels with full product information, images, and descriptions

### Shopping Experience
- **Shopping Cart:**
  - Add/remove items
  - Adjust quantities with +/- controls
  - Real-time price calculations
  - Cart count indicator
  - Persistent storage (survives page refreshes)
- **Wishlist:**
  - Save items for later
  - Easy transfer from wishlist to cart
  - Persistent across sessions
- **Checkout Process:**
  - Purchase confirmation popup
  - Tax calculation (13%)
  - Success confirmation message

### User Interface
- **Responsive Design:** Mobile-first approach with full responsive layouts
- **Smooth Animations:** jQuery-powered sliding panels and transitions
- **Interactive Navigation:** Hamburger menu with smooth open/close
- **Image Gallery:** Lightbox view for product images
- **Social Media Integration:** Connected social media icons

---

## 🛠️ Technologies Used

### Front-End
- **HTML5** - Semantic markup and structure
- **CSS3** - Custom styling with gradients, animations, and responsive design
- **JavaScript (ES6+)** - Core application logic and API integration
- **jQuery** - DOM manipulation and animations

### API Integration
- **DummyJSON API** - External product data source
- **Fetch API** - Asynchronous HTTP requests
- **Async/Await** - Modern promise handling

### Data Persistence
- **localStorage** - Client-side data storage for cart and wishlist
- **JSON** - Data serialization and deserialization

---

## 📋 Core Functionality

### API Data Fetching
```javascript
async function fetchAndDisplayProducts() {
   const response = await fetch('https://dummyjson.com/products?limit=194');
   const data = await response.json();
   // Process and store products
}
```

### Key Operations
- **CRUD Operations:**
  - **Create:** Add items to cart/wishlist
  - **Read:** Fetch and display products from API
  - **Update:** Modify cart quantities
  - **Delete:** Remove items from cart/wishlist

### Error Handling
- Comprehensive try-catch blocks for API failures
- User-friendly error messages
- Graceful degradation when API is unavailable

### State Management
- Global state variables for products, cart, and wishlist
- Automatic localStorage synchronization
- Session persistence across page refreshes

---

## 🎯 Product Categories

The application dynamically loads and displays products from multiple categories:
- Laptops & Electronics
- Fragrances & Beauty
- Furniture & Home
- And many more...

Categories are generated dynamically from API data, ensuring the catalog stays current.

---

## 💻 Installation & Setup

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection (for API access)
- Optional: Local web server for development

### Running Locally

1. **Clone the repository:**
```bash
git clone https://github.com/Ramin-Najafi/api_project.git
cd api_project
```

2. **Open in browser:**
   - Simply open `index.html` in your web browser
   - Or use a local server (recommended):
```bash
# Using Python 3
python -m http.server 8000

# Using Node.js (http-server)
npx http-server
```

3. **Access the application:**
   - Navigate to `http://localhost:8000` in your browser

### Project Structure
```
api_project/
│
├── index.html              # Main HTML file
├── css/
│   └── app.css            # All styling and responsive design
├── js/
│   ├── app.js             # Core application logic and API integration
│   └── jquery.js          # jQuery library
└── assets/
    └── images/            # Logos, icons, and UI images
```

---

## 🔧 How It Works

### 1. Product Loading
- Application fetches 194 products from DummyJSON API on page load
- Products are cached in memory for fast filtering and searching
- Trending products are randomly selected from specific categories

### 2. Search Functionality
- Real-time search suggestions appear as user types
- Searches both product titles and categories
- Case-insensitive matching for better UX

### 3. Cart Management
- Items added to cart are stored with quantity tracking
- Cart persists in localStorage (survives page refreshes)
- Real-time total calculation including 13% tax
- Quantity can be adjusted with +/- buttons
- Individual items can be removed

### 4. Wishlist System
- Products can be saved for later viewing
- Stored separately from cart in localStorage
- Easy one-click transfer to cart
- Items automatically removed from wishlist when added to cart

---

## 🎨 User Interface Highlights

### Responsive Design
- **Desktop:** Full-featured layout with side navigation and sliding panels
- **Tablet:** Optimized layouts with adjusted spacing
- **Mobile:** Compact design with hamburger menu and full-width cart

### Interactive Elements
- Smooth sliding navigation menu
- Pop-up product detail panels
- Slide-in shopping cart
- Lightbox image viewer
- Animated buttons and hover effects

---

## 📊 Data Flow

```
User Action → JavaScript Event Handler → API Call (if needed)
    ↓
Process Data → Update State Variables
    ↓
Update localStorage → Update DOM Display
    ↓
User sees updated UI
```

---

## 🔐 Data Persistence

The application uses localStorage to maintain user data across sessions:
- **Cart data:** `shopall_cart` key stores all cart items with quantities
- **Wishlist data:** `shopall_wishlist` key stores saved items
- **Page state:** Current page/section for navigation persistence

Data is automatically saved whenever:
- Items are added/removed from cart
- Quantities are changed
- Items are added/removed from wishlist
- Purchase is completed

---

## 🚀 Features Implemented

### Search & Discovery
- [x] Real-time product search
- [x] Auto-suggestions dropdown
- [x] Category-based filtering
- [x] Trending/Best Sellers section

### Shopping Cart
- [x] Add to cart functionality
- [x] Quantity adjustment (+/-)
- [x] Remove items
- [x] Total price calculation
- [x] Tax calculation (13%)
- [x] Purchase confirmation flow

### User Experience
- [x] Responsive design (mobile, tablet, desktop)
- [x] Persistent data storage
- [x] Smooth animations and transitions
- [x] Error handling for failed API requests
- [x] Loading state management

### Data Management
- [x] Async API integration
- [x] LocalStorage persistence
- [x] State management
- [x] CRUD operations

---

## 🐛 Known Limitations

- **No Backend:** Application is front-end only (no real payment processing)
- **API Dependency:** Requires internet connection and DummyJSON API availability
- **localStorage Limits:** Cart/wishlist data limited to browser localStorage capacity (~5MB)
- **No User Accounts:** Data is device-specific (not synced across devices)

---

## 🔮 Future Enhancements

Potential features for future development:
- [ ] User authentication and accounts
- [ ] Backend integration for real payment processing
- [ ] Product reviews and ratings
- [ ] Advanced filtering (price range, ratings, availability)
- [ ] Order history tracking
- [ ] Email notifications
- [ ] Product comparison feature
- [ ] Dark mode toggle

---

## 📚 What I Learned

Through this project, I gained hands-on experience with:
- **Asynchronous JavaScript:** Working with Promises, async/await, and the Fetch API
- **API Integration:** Consuming external REST APIs and handling responses
- **State Management:** Managing application state across components
- **Data Persistence:** Using localStorage for client-side data storage
- **Error Handling:** Implementing try-catch blocks and user-friendly error messages
- **Responsive Design:** Creating layouts that work across all device sizes
- **DOM Manipulation:** Dynamic content generation and event handling
- **jQuery:** Using jQuery for animations and simplified DOM operations

---

## 🤝 Contributing

This is a personal learning project, but suggestions and feedback are welcome! Feel free to:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

---

## 📝 License

This project is open source and available for educational purposes.

---

## 👨‍💻 Author

**Ramin Najafi**
- Portfolio: [ramin-najafi.github.io](https://ramin-najafi.github.io/)
- GitHub: [@Ramin-Najafi](https://github.com/Ramin-Najafi)
- Email: rnajafi.dev@gmail.com

---

## 🙏 Acknowledgments

- **DummyJSON API** for providing free product data
- **jQuery** for simplifying DOM manipulation and animations
- **triOS College** for web development fundamentals education

---

## 📸 Screenshots

*Add screenshots of your application here once you have them:*
- Homepage with Best Sellers
- Search functionality
- Shopping Cart
- Product Detail View
- Category Browsing
- Mobile Responsive View

---

**Built with ❤️ as part of my journey into software development**