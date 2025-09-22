// layout.js - carregar e aplicar layout público (logo, home, carousel, instagram)
(function(){
  async function fetchLayout() {
    try {
      const res = await fetch('/api/public/layout');
      const data = await res.json();
      if (!res.ok || !data.sucesso) throw new Error(data.mensagem || 'Falha ao carregar layout');
      return data.data;
    } catch (e) {
      console.warn('Layout público indisponível:', e.message);
      return null;
    }
  }

  function setImg(el, url) {
    if (!el || !url) return;
    if (el.tagName === 'IMG') el.src = url; else el.style.backgroundImage = `url('${url}')`;
  }

  function applyLogo(layout) {
    if (!layout?.logo_url) return;
    document.querySelectorAll('.menu-area .logo img, .header-logo img, .footer-logo, .admin-header .header-logo img').forEach(img => {
      setImg(img, layout.logo_url);
    });
    const aboutHeroImg = document.querySelector('.about-hero-image img');
    if (aboutHeroImg) setImg(aboutHeroImg, layout.logo_url);
  }

  function applyHome(layout) {
    if (layout?.home_background_url) {
      const bg = document.querySelector('.bg-image');
      if (bg) bg.style.backgroundImage = `url('${layout.home_background_url}')`;
      const rightImg = document.querySelector('.right-home .right-image img');
      if (rightImg && !rightImg.getAttribute('data-fixed')) {
        setImg(rightImg, layout.home_background_url);
      }
    }
    if (layout?.home_title) {
      const el = document.querySelector('.left-text1, #previewTitle');
      if (el) el.textContent = layout.home_title;
    }
    if (layout?.home_subtitle) {
      const el = document.querySelector('.left-text2, #previewSubtitle');
      if (el) el.textContent = layout.home_subtitle;
    }
    if (layout?.home_description) {
      const el = document.querySelector('.left-text3, #previewDescription');
      if (el) el.textContent = layout.home_description;
    }
  }

  function applyMenuCarousel(layout) {
    const hero = document.querySelector('.hero-carousel .carousel-track');
    if (!hero) return;
    const slides = Array.isArray(layout?.carousel) ? layout.carousel : [];
    hero.innerHTML = '';
    if (!slides.length) return;
    slides.forEach((slide, i) => {
      const div = document.createElement('div');
      div.className = 'carousel-slide' + (i === 0 ? ' active' : '');
      div.innerHTML = `
        <img alt="Banner ${i+1}">
        <div class="carousel-caption"></div>
      `;
      const img = div.querySelector('img');
      const cap = div.querySelector('.carousel-caption');
      setImg(img, slide.image_url);
      cap.textContent = slide.caption || '';
      hero.appendChild(div);
    });
    const container = document.querySelector('.hero-carousel');
    if (!container) return;
    if (container.dataset.autoplayInit === '1') return;
    container.dataset.autoplayInit = '1';
    if (slides.length <= 1) return;
    let idx = 0;
    setInterval(() => {
      const els = container.querySelectorAll('.carousel-slide');
      if (!els.length) return;
      els[idx]?.classList.remove('active');
      idx = (idx + 1) % els.length;
      els[idx]?.classList.add('active');
    }, 5000);
  }

  function applyInstagram(layout) {
    const sec = document.querySelector('.instagram-section');
    if (!sec) return;
    const enabled = !!layout?.instagram?.enabled;
    sec.style.display = enabled ? '' : 'none';
    const follow = sec.querySelector('.instagram-follow');
    const handle = sec.querySelector('.instagram-handle');
    const link = sec.querySelector('.instagram-link');
    if (follow && layout?.instagram?.text) follow.textContent = layout.instagram.text;
    if (handle && layout?.instagram?.handle) handle.textContent = `@${layout.instagram.handle}`;
    if (link && layout?.instagram?.handle) link.href = `https://www.instagram.com/${layout.instagram.handle}/`;
  }

  async function init() {
    const layout = await fetchLayout();
    if (!layout) return;
    applyLogo(layout);
    applyHome(layout);
    applyMenuCarousel(layout);
    applyInstagram(layout);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
