let menuOpen = false;

function toggleMenu() {
   if(!menuOpen) {
      $('#mobileNav').animate({ right: 0 }, 300, 'swing');
      $('#hamburger').addClass('open');
      menuOpen = true;
   } else {
      closeNav();
   }
}

function closeNav() {
   $('#mobileNav').animate({ right: -300 }, 300, 'swing');
   $('#hamburger').removeClass('open');
   menuOpen = false;
}

document.addEventListener('DOMContentLoaded', function() {
  const mobileNav = document.getElementById('mobileNav');
  const hamburger = document.getElementById('hamburger');

  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', function() {
      closeNav();
    });
  });

  document.addEventListener('click', function(event) {
    const isClickInsideNav = mobileNav.contains(event.target);
    const isClickOnHamburger = hamburger.contains(event.target);

    if (menuOpen && !isClickInsideNav && !isClickOnHamburger) {
      closeNav();
    }
  });
});

function submitContact(event) {
  event.preventDefault();

  const successMsg = document.getElementById('successMsg');
  const form = document.getElementById('contactForm');

  if (successMsg && form) {
    successMsg.style.display = 'block';
    form.reset();
    setTimeout(() => {
      successMsg.style.display = 'none';
    }, 4000);
  }
  return false;
}