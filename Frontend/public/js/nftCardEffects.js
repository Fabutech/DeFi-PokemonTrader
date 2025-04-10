document.addEventListener("DOMContentLoaded", () => {
    const cards = document.querySelectorAll(".enhanced-card");
  
    cards.forEach(card => {
      card.addEventListener("mousemove", e => {
        const { left, top, width, height } = card.getBoundingClientRect();
        const x = (e.clientX - left) / width * 100;
        const y = (e.clientY - top) / height * 100;
  
        card.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,0.1), transparent 60%)`;
      });
  
      card.addEventListener("mouseleave", () => {
        if (document.body.classList.contains('dark')) {
          card.style.background = "linear-gradient(145deg, #1f1f1f, #2c2c2c)";
        } else {
          card.style.background = "linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(245, 245, 245, 0.9))";
        }
      });
    });

    const updateCardBackgrounds = () => {
      cards.forEach(card => {
        if (document.body.classList.contains('dark')) {
          card.style.background = "linear-gradient(145deg, #1f1f1f, #2c2c2c)";
        } else {
          card.style.background = "linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(245, 245, 245, 0.9))";
        }
      });
    };

    const observer = new MutationObserver(updateCardBackgrounds);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    const container = document.querySelector(".nft-scroll-container");
    if (!container) return;

    const wrapper = container.parentElement;
    if (container.scrollWidth <= wrapper.clientWidth) {
      return; // Don't animate if everything fits inside the visible area
    }


  
    let scrollPos = 0;
    let currentSpeed = 1.0;
    let targetSpeed = 1.5;
    let easing = 0.07;
  
    const animateScroll = () => {
      // Smooth speed transition
      currentSpeed += (targetSpeed - currentSpeed) * easing;
      scrollPos += currentSpeed;
  
      container.style.transform = `translateX(-${scrollPos}px)`;
  
      // Loop scroll
      const totalScrollWidth = container.scrollWidth / 2;
      if (scrollPos >= totalScrollWidth) {
        scrollPos = 0;
      }
  
      requestAnimationFrame(animateScroll);
    };
  
    // Start animation
    animateScroll();
  
    // Pause/resume on hover
    container.querySelectorAll(".enhanced-card").forEach(card => {
      card.addEventListener("mouseenter", () => {
        targetSpeed = 0;
      });
  
      card.addEventListener("mouseleave", () => {
        targetSpeed = 1.5;
      });
    });
  
    // Duplicate cards to simulate infinite scroll
    const duplicates = Array.from(container.children);
    duplicates.forEach(card => {
      const clone = card.cloneNode(true);
      container.appendChild(clone);
    });
});