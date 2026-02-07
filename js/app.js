let menuOpen = false; // Initialize menu state

function toggleMenu() {
    var mobileNav = document.getElementById('mobileNav');
    mobileNav.classList.toggle('open');
    var hamburger = document.getElementById('hamburger');
    hamburger.classList.toggle('open');
    menuOpen = mobileNav.classList.contains('open'); // Update menuOpen state
}

// Close mobile nav when a link is clicked
document.querySelectorAll('#mobileNav nav a').forEach(item => {
    item.addEventListener('click', () => {
        // Instead of directly manipulating classes, call toggleMenu to ensure state is consistent
        if (menuOpen) {
            toggleMenu();
        }
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const mobileNav = document.getElementById('mobileNav');
    const hamburger = document.getElementById('hamburger');

    document.addEventListener('click', function(event) {
        const isClickInsideNav = mobileNav.contains(event.target);
        const isClickOnHamburger = hamburger.contains(event.target);
        
        // If menu is open and click is outside nav and outside hamburger, close menu
        if (menuOpen && !isClickInsideNav && !isClickOnHamburger) {
            toggleMenu(); // Close the menu
        }
    });

    // Add click functionality to Linen Project Box
    const linenProjectBox = document.getElementById('linen-project-box');
    if (linenProjectBox) {
        linenProjectBox.style.cursor = 'pointer'; // Indicate clickable
        linenProjectBox.addEventListener('click', function() {
            window.open('/linen/', '_blank');
        });
    }

    // Add click functionality to ShopAll Project Box
    const shopallProjectBox = document.getElementById('shopall-project-box');
    if (shopallProjectBox) {
        shopallProjectBox.style.cursor = 'pointer'; // Indicate clickable
        shopallProjectBox.addEventListener('click', function() {
            window.open('/shopall/', '_blank'); // Assuming /shopall/ is the correct URL
        });
    }
});

async function submitContact(event) {
    event.preventDefault(); // Prevent default form submission

    const form = document.getElementById('contactForm');
    const successMsg = document.getElementById('successMsg');
    const submitButton = form.querySelector('button[type="submit"]');

    const formData = new FormData(form);
    formData.append("access_key", "02556098-34d5-4cef-aafd-a582035f1f2a"); // Replace with your actual access key

    // Disable button and show loading
    const originalText = submitButton.textContent;
    submitButton.textContent = "Sending...";
    submitButton.disabled = true;

    try {
        const response = await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            successMsg.textContent = "Thank you! Your message has been sent.";
            successMsg.style.display = 'block';
            form.reset(); // Clear the form

            setTimeout(() => {
                successMsg.style.display = 'none';
            }, 4000); // Hide message after 4 seconds
        } else {
            successMsg.textContent = "Error: " + data.message;
            successMsg.style.display = 'block';
        }
    } catch (error) {
        successMsg.textContent = "Something went wrong. Please try again.";
        successMsg.style.display = 'block';
        console.error('Form submission error:', error);
    } finally {
        // Re-enable button
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }

    return false; // Prevent page reload
}