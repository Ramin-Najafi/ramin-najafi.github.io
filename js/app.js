let menuOpen = false; // Initialize menu state

function toggleMenu() {
    var mobileNav = document.getElementById('mobileNav');
    mobileNav.classList.toggle('open');
    var hamburger = document.getElementById('hamburger');
    hamburger.classList.toggle('open');
    menuOpen = mobileNav.classList.contains('open'); // Update menuOpen state
}

// Lightbox functionality
function openLightbox(lightboxId) {
    const lightbox = document.getElementById(lightboxId);
    if (lightbox) {
        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeLightbox(lightboxId) {
    const lightbox = document.getElementById(lightboxId);
    if (lightbox) {
        lightbox.style.display = 'none';
        document.body.style.overflow = '';
    }
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

// Mobile navigation click outside handler
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

    // "Read More" button handler
    document.querySelectorAll('.btn-read-more').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const lightboxId = this.dataset.lightbox;
            if (lightboxId) {
                openLightbox(lightboxId);
            }
        });
    });

    // Close button handler for all lightboxes
    document.querySelectorAll('.lightbox .close-button').forEach(closeBtn => {
        closeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const lightbox = this.closest('.lightbox');
            if (lightbox) {
                lightbox.style.display = 'none';
                document.body.style.overflow = '';
            }
        });
    });

    // Click outside lightbox to close
    document.querySelectorAll('.lightbox').forEach(lightbox => {
        lightbox.addEventListener('click', function(event) {
            if (event.target === this) {
                this.style.display = 'none';
                document.body.style.overflow = '';
            }
        });
    });

    // Navigation scroll and auto-open lightbox handler
    document.querySelectorAll('.nav-scroll-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.dataset.section;
            const lightboxId = this.dataset.lightbox;

            // Close mobile menu
            if (menuOpen) {
                toggleMenu();
            }

            // Scroll to section
            const section = document.getElementById(sectionId);
            if (section) {
                setTimeout(() => {
                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // Open lightbox after scroll
                    if (lightboxId) {
                        setTimeout(() => {
                            openLightbox(lightboxId);
                        }, 500);
                    }
                }, 100);
            }
        });
    });

    // Project accordion functionality
    document.querySelectorAll('.project-accordion-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const projectId = this.dataset.project;
            const accordion = document.getElementById(projectId);

            if (accordion) {
                accordion.classList.toggle('expanded');
                this.classList.toggle('expanded');
            }
        });
    });
});

function submitContact(event) {
    event.preventDefault();

    const name    = document.getElementById('name').value.trim();
    const email   = document.getElementById('email').value.trim();
    const subject = document.getElementById('subject').value.trim();
    const message = document.getElementById('message').value.trim();

    const successMsg  = document.getElementById('successMsg');
    const submitButton = document.getElementById('contactForm').querySelector('button[type="submit"]');

    const mailtoSubject = encodeURIComponent(subject || 'Portfolio Contact Form');
    const mailtoBody    = encodeURIComponent(
        'Name: ' + name + '\n' +
        'Email: ' + email + '\n\n' +
        message
    );

    const _u = ['r','n','a','j','a','f','i','.','d','e','v'];
    const _d = ['g','m','a','i','l','.','c','o','m'];
    const _e = _u.join('') + '@' + _d.join('');
    const mailtoLink = 'mailto:' + _e
        + '?subject=' + mailtoSubject
        + '&body='    + mailtoBody;

    window.location.href = mailtoLink;

    successMsg.textContent = 'Your email client has opened. Hit send and your message will arrive directly in my inbox.';
    successMsg.style.display = 'block';

    document.getElementById('contactForm').reset();

    setTimeout(() => {
        successMsg.style.display = 'none';
    }, 6000);

    return false;
}

// Function to open lightbox and close mobile menu
function openSkillsLightboxAndCloseMenu() {
    openSkillsLightbox();
    if (menuOpen) { // Check if menu is open before closing
        toggleMenu(); // Close the menu
    }
}
