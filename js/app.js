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

// Lightbox functionality - elements declared globally, initialized in DOMContentLoaded
let skillsLightbox;
let openSkillsGoalsBtn;
let closeLightboxBtn;

function openSkillsLightbox() {
    const originalSkillsGoalsContent = document.getElementById('skills-and-goals').innerHTML;
    document.getElementById('lightbox-skills-goals-content').innerHTML = originalSkillsGoalsContent;
    skillsLightbox.style.display = 'flex'; // Use flex to center content
    document.body.style.overflow = 'hidden'; // Prevent scrolling on body
}

function closeSkillsLightbox() {
    skillsLightbox.style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling on body
    document.getElementById('lightbox-skills-goals-content').innerHTML = ''; // Clear content when closing
}




// Existing code...
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

    // Lightbox initialization and event listeners - MOVED HERE
    skillsLightbox = document.getElementById('skillsLightbox'); // Initialize globally declared variable
    openSkillsGoalsBtn = document.getElementById('openSkillsGoals'); // Initialize globally declared variable
    closeLightboxBtn = skillsLightbox ? skillsLightbox.querySelector('.close-button') : null; // Initialize globally declared variable

    // Event listeners for lightbox
    if (openSkillsGoalsBtn) {
        openSkillsGoalsBtn.addEventListener('click', openSkillsLightbox);
    }

    if (closeLightboxBtn) {
        closeLightboxBtn.addEventListener('click', closeSkillsLightbox);
    }

    if (skillsLightbox) { // Only attach if lightbox exists
        window.addEventListener('click', function(event) {
            if (event.target === skillsLightbox) {
                closeSkillsLightbox();
            }
        });
    }

    // Project card click handling with mobile accordion support
    const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

    const projectCards = [
        { id: 'linen-project-box', url: '/linen/' },
        { id: 'shopall-project-box', url: '/shopall/' }
    ];

    projectCards.forEach(({ id, url }) => {
        const box = document.getElementById(id);
        if (!box) return;

        box.style.cursor = 'pointer';
        const header = box.querySelector('.project-header');
        const linkIndicator = box.querySelector('.project-link-indicator');

        // Header click: toggle accordion on mobile, navigate on desktop
        if (header) {
            header.addEventListener('click', function(e) {
                if (isMobile()) {
                    e.stopPropagation();
                    box.classList.toggle('expanded');
                } else {
                    window.open(url, '_blank');
                }
            });
        }

        // "View Project →" link always navigates
        if (linkIndicator) {
            linkIndicator.addEventListener('click', function(e) {
                e.stopPropagation();
                window.open(url, '_blank');
            });
            linkIndicator.style.cursor = 'pointer';
        }

        // Full card click navigates on desktop
        box.addEventListener('click', function() {
            if (!isMobile()) {
                window.open(url, '_blank');
            }
        });
    });
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

// Function to open lightbox and close mobile menu
function openSkillsLightboxAndCloseMenu() {
    openSkillsLightbox();
    if (menuOpen) { // Check if menu is open before closing
        toggleMenu(); // Close the menu
    }
}
