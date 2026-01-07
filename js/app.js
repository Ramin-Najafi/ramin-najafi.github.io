let menuOpen = false;

function toggleMenu() {
  if (!menuOpen) {
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

async function submitContact(event) {
  event.preventDefault();

  const form = document.getElementById('contactForm');
  const successMsg = document.getElementById('successMsg');
  const submitButton = form.querySelector('button[type="submit"]');

  const formData = new FormData(form);
  formData.append("access_key", "02556098-34d5-4cef-aafd-a582035f1f2a");

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
      form.reset();

      setTimeout(() => {
        successMsg.style.display = 'none';
      }, 4000);
    } else {
      successMsg.textContent = "Error: " + data.message;
      successMsg.style.display = 'block';
    }
  } catch (error) {
    successMsg.textContent = "Something went wrong. Please try again.";
    successMsg.style.display = 'block';
    console.error('Form submission error:', error);
  } finally {
    submitButton.textContent = originalText;
    submitButton.disabled = false;
  }

  return false;
}