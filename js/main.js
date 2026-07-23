/* Lumen Publicity — interactions */

(() => {
  const header = document.getElementById("header");
  const navToggle = document.getElementById("navToggle");
  const navMenu = document.getElementById("navMenu");
  const yearEl = document.getElementById("year");
  const form = document.getElementById("contactForm");
  const formSuccess = document.getElementById("formSuccess");

  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* Sticky header */
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 40);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* Mobile nav */
  const closeMenu = () => {
    navMenu?.classList.remove("is-open");
    navToggle?.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  };

  navToggle?.addEventListener("click", () => {
    const open = navMenu?.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.style.overflow = open ? "hidden" : "";
  });

  navMenu?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  /* Active nav link */
  const sections = [...document.querySelectorAll("main section[id]")];
  const navLinks = [...document.querySelectorAll(".nav__links a")];

  const setActiveLink = () => {
    const y = window.scrollY + 120;
    let current = "";
    sections.forEach((section) => {
      if (section.offsetTop <= y) current = section.id;
    });
    navLinks.forEach((link) => {
      link.classList.toggle(
        "is-active",
        link.getAttribute("href") === `#${current}`
      );
    });
  };
  window.addEventListener("scroll", setActiveLink, { passive: true });
  setActiveLink();

  /* Hero slideshow */
  const slides = [...document.querySelectorAll(".hero__slide")];
  let slideIndex = 0;
  if (slides.length > 1) {
    setInterval(() => {
      slides[slideIndex].classList.remove("is-active");
      slideIndex = (slideIndex + 1) % slides.length;
      slides[slideIndex].classList.add("is-active");
    }, 5500);
  }

  /* Reveal on scroll */
  const reveals = document.querySelectorAll(".reveal");
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  reveals.forEach((el) => {
    if (el.closest(".hero")) {
      requestAnimationFrame(() => el.classList.add("is-visible"));
    } else {
      revealObserver.observe(el);
    }
  });

  /* Animated counters */
  const counters = document.querySelectorAll("[data-count]");
  const animateCount = (el) => {
    const target = Number(el.getAttribute("data-count") || 0);
    const suffix = el.getAttribute("data-suffix") || "";
    const duration = 1600;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = `${Math.round(target * eased)}${suffix}`;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );
  counters.forEach((el) => counterObserver.observe(el));

  /* Testimonials slider */
  const slider = document.querySelector("[data-slider]");
  if (slider) {
    const track = slider.querySelector("[data-track]");
    const cards = [...slider.querySelectorAll(".testimonial-card")];
    const dotsWrap = slider.querySelector("[data-dots]");
    const prevBtn = slider.querySelector("[data-prev]");
    const nextBtn = slider.querySelector("[data-next]");
    let index = 0;
    let autoTimer;

    const goTo = (i) => {
      index = (i + cards.length) % cards.length;
      if (track) track.style.transform = `translateX(-${index * 100}%)`;
      dotsWrap?.querySelectorAll("button").forEach((dot, di) => {
        dot.classList.toggle("is-active", di === index);
      });
    };

    cards.forEach((_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", `Go to testimonial ${i + 1}`);
      if (i === 0) dot.classList.add("is-active");
      dot.addEventListener("click", () => {
        goTo(i);
        restartAuto();
      });
      dotsWrap?.appendChild(dot);
    });

    const next = () => goTo(index + 1);
    const prev = () => goTo(index - 1);

    nextBtn?.addEventListener("click", () => {
      next();
      restartAuto();
    });
    prevBtn?.addEventListener("click", () => {
      prev();
      restartAuto();
    });

    const restartAuto = () => {
      clearInterval(autoTimer);
      autoTimer = setInterval(next, 7000);
    };
    restartAuto();

    /* Touch swipe */
    let startX = 0;
    track?.addEventListener(
      "touchstart",
      (e) => {
        startX = e.touches[0].clientX;
      },
      { passive: true }
    );
    track?.addEventListener(
      "touchend",
      (e) => {
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 50) {
          dx < 0 ? next() : prev();
          restartAuto();
        }
      },
      { passive: true }
    );
  }

  /* Contact form */
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    form.reset();
    if (formSuccess) {
      formSuccess.hidden = false;
      setTimeout(() => {
        formSuccess.hidden = true;
      }, 6000);
    }
  });
})();
