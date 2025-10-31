// Mobile navigation toggle
function toggleMenu() {
  const mobileNav = document.getElementById('mobileNav');
  mobileNav.classList.toggle('open');
}

document.addEventListener('DOMContentLoaded', function() {
  const navToggle = document.getElementById('navToggle');
  const mobileNav = document.getElementById('mobileNav');
  const navClose = document.getElementById('navClose');

  if (navToggle) {
    navToggle.addEventListener('click', function() {
      mobileNav.classList.add('open');
    });
  }

  if (navClose) {
    navClose.addEventListener('click', function() {
      mobileNav.classList.remove('open');
    });
  }

  // Close menu when clicking a link
  const navLinks = mobileNav.querySelectorAll('a');
  navLinks.forEach(function(link) {
    link.addEventListener('click', function() {
      mobileNav.classList.remove('open');
    });
  });
});

// Contact form submission
function submitContact(event) {
  event.preventDefault();
  
  const successMsg = document.getElementById('successMsg');
  const form = document.getElementById('contactForm');
  
  if (successMsg && form) {
    successMsg.style.display = 'block';
    form.reset();
    
    setTimeout(function() {
      successMsg.style.display = 'none';
    }, 4000);
  }
  
  return false;
}