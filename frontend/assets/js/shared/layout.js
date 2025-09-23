// layout.js - carregar e aplicar layout público (logo, home, carousel, instagram)
(function(){
  // Minimal, clean skeleton + safe reveal to avoid flashing default assets
  function injectSkeletonStyles() {
    if (document.getElementById('layout-skeleton-styles')) return;
    const css = `
      /* Minimalist skeleton */
      .skeleton {
        position: relative;
        background: linear-gradient(90deg, #f2f2f2 25%, #eaeaea 37%, #f2f2f2 63%);
        background-size: 400% 100%;
        animation: skeleton-shimmer 1.2s ease-in-out infinite;
        border-radius: 8px;
      }
      @keyframes skeleton-shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
      /* Hide real content until data is applied */
      .hidden-until-data { visibility: hidden !important; }
      /* Default sections to hide when no data to avoid showing defaults */
      .hide-if-no-data { display: none !important; }
      /* Preset sizes for common blocks to avoid CLS */
      .skeleton-logo { width: 160px; height: 48px; }
      .skeleton-hero { width: 100%; height: 360px; max-height: 45vh; }
      .skeleton-carousel { width: 100%; height: 260px; max-height: 38vh; }
      .skeleton-text-line { height: 16px; width: 60%; margin: 6px 0; }
      .skeleton-text-line.small { width: 40%; }
      .skeleton-footer { width: 100%; height: 120px; margin-top: 12px; }

      @media (max-width: 992px) {
        .skeleton-hero { height: 300px; max-height: 40vh; }
        .skeleton-carousel { height: 220px; max-height: 34vh; }
      }
      @media (max-width: 600px) {
        .skeleton-hero { height: 220px; max-height: 34vh; }
        .skeleton-carousel { height: 180px; max-height: 30vh; }
        .skeleton-text-line { width: 70%; }
        .skeleton-text-line.small { width: 55%; }
      }
      @media (prefers-reduced-motion: reduce) {
        .skeleton { animation: none; }
      }
    `;
    const style = document.createElement('style');
    style.id = 'layout-skeleton-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function appendSkeleton(refEl, className) {
    if (!refEl) return null;
    const sk = document.createElement('div');
    sk.className = `skeleton ${className || ''}`.trim();
    sk.setAttribute('data-skeleton', '1');
    refEl.parentNode && refEl.parentNode.insertBefore(sk, refEl);
    return sk;
  }

  function markHidden(el) {
    if (!el) return;
    el.classList.add('hidden-until-data');
  }

  function reveal(el) {
    if (!el) return;
    el.classList.remove('hidden-until-data');
  }

  function removeSkeletons() {
    document.querySelectorAll('[data-skeleton]')
      .forEach(n => n.parentNode && n.parentNode.removeChild(n));
  }

  function setImg(el, url) {
    if (!el || !url) return;
    if (el.tagName === 'IMG') el.src = url; else el.style.backgroundImage = `url('${url}')`;
  }
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

  async function fetchSettings() {
    try {
      const res = await fetch('/api/public/settings');
      const data = await res.json();
      if (!res.ok || !data.sucesso) throw new Error(data.mensagem || 'Falha ao carregar configurações');
      return data.data;
    } catch (e) {
      console.warn('Configurações públicas indisponíveis:', e.message);
      return null;
    }
  }

  function applyLogo(layout) {
    if (!layout?.logo_url) return;
    document.querySelectorAll('.menu-area .logo img, .header-logo img, .footer-logo, .admin-header .header-logo img, .auth-logo').forEach(img => {
      setImg(img, layout.logo_url);
      reveal(img);
    });
    const aboutHeroImg = document.querySelector('.about-hero-image img');
    if (aboutHeroImg) { setImg(aboutHeroImg, layout.logo_url); reveal(aboutHeroImg); }
  }

  function applyHome(layout) {
    if (layout?.home_background_url) {
      const bg = document.querySelector('.bg-image');
      if (bg) {
        // Mantém .bg-image fixa sem skeleton para não empurrar header/sidebar
        bg.style.backgroundImage = `url('${layout.home_background_url}')`;
        reveal(bg);
      }
      const rightImg = document.querySelector('.right-home .right-image img');
      if (rightImg && !rightImg.getAttribute('data-fixed')) { setImg(rightImg, layout.home_background_url); reveal(rightImg); }
    }
    if (layout?.home_title) {
      const el = document.querySelector('.left-text1, #previewTitle');
      if (el) { el.textContent = layout.home_title; reveal(el); }
    }
    if (layout?.home_subtitle) {
      const el = document.querySelector('.left-text2, #previewSubtitle');
      if (el) { el.textContent = layout.home_subtitle; reveal(el); }
    }
    if (layout?.home_description) {
      const el = document.querySelector('.left-text3, #previewDescription');
      if (el) { el.textContent = layout.home_description; reveal(el); }
    }
  }

  function applyMenuCarousel(layout) {
  const hero = document.querySelector('.hero-carousel .carousel-track');
    if (!hero) return;
    const slides = Array.isArray(layout?.carousel) ? layout.carousel : [];
    hero.innerHTML = '';
    if (!slides.length) {
      // Sem dados → esconder o bloco do carousel para não expor defaults
      const container = document.querySelector('.hero-carousel');
      if (container) container.classList.add('hide-if-no-data');
      return;
    }
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
  reveal(container);
  reveal(hero);
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
    if (follow && layout?.instagram?.text) { follow.textContent = layout.instagram.text; reveal(follow); }
    if (handle && layout?.instagram?.handle) { handle.textContent = `@${layout.instagram.handle}`; reveal(handle); }
    if (link && layout?.instagram?.handle) { link.href = `https://www.instagram.com/${layout.instagram.handle}/`; reveal(link); }
  }

  function formatWhatsLink(phone) {
    if (!phone) return null;
    // Remove caracteres não numéricos e força DDI+DDD+numero
    const digits = String(phone).replace(/\D+/g, '');
    if (!digits) return null;
    // Se não tiver DDI, assumir Brasil 55 para compatibilidade
    const withDDI = digits.length <= 11 ? '55' + digits : digits;
    return `https://wa.me/${withDDI}`;
  }

  function applyFooter(settings, layout) {
    if (!settings) return;
    // Contato
  const phoneLink = document.querySelector('.footer-section .contact-link[href^="tel:"]');
    const phoneSpan = phoneLink?.querySelector('span');
    if (phoneLink && settings.phone) {
      const telDigits = String(settings.phone).replace(/\D+/g, '');
      phoneLink.href = `tel:+${telDigits.length <= 11 ? '55' + telDigits : telDigits}`;
      if (phoneSpan) { phoneSpan.textContent = settings.phone; reveal(phoneSpan); reveal(phoneLink); }
    }
  const emailLink = document.querySelector('.footer-section .contact-link[href^="mailto:"]');
    const emailSpan = emailLink?.querySelector('span');
    if (emailLink && settings.email) {
      emailLink.href = `mailto:${settings.email}`;
      if (emailSpan) { emailSpan.textContent = settings.email; reveal(emailSpan); reveal(emailLink); }
    }
  const addressLink = document.querySelector('.footer-section .contact-link[href*="google.com/maps"]');
    const addressSpan = addressLink?.querySelector('span');
    if (addressLink && settings.address) {
      const encoded = encodeURIComponent(settings.address);
      addressLink.href = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
      if (addressSpan) { addressSpan.textContent = settings.address; reveal(addressSpan); reveal(addressLink); }
    }

    // Social (Instagram + WhatsApp)
  const social = document.querySelector('.footer-section .social-links');
    if (social) {
      const instaHandle = layout?.instagram?.handle;
      const whatsUrl = formatWhatsLink(settings.phone);
      // Limpa e recria apenas os que precisamos
      social.innerHTML = '';
      if (instaHandle) {
        const a = document.createElement('a');
        a.href = `https://www.instagram.com/${instaHandle}/`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.setAttribute('aria-label', 'Instagram');
        a.innerHTML = '<i class="fab fa-instagram"></i>';
        social.appendChild(a);
      }
      if (whatsUrl) {
        const a = document.createElement('a');
        a.href = whatsUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.setAttribute('aria-label', 'WhatsApp');
        a.innerHTML = '<i class="fab fa-whatsapp"></i>';
        social.appendChild(a);
      }
    }
  }

  async function init() {
    injectSkeletonStyles();

    // Prepare skeletons and hide real content
  const logoEl = document.querySelector('.menu-area .logo img, .header-logo img');
    const heroBg = document.querySelector('.bg-image');
    const heroRight = document.querySelector('.right-home .right-image img');
  const aboutHeroImg = document.querySelector('.about-hero-image img');
  const footerLogo = document.querySelector('.footer-logo');
  const authLogos = Array.from(document.querySelectorAll('.auth-logo'));
    const t1 = document.querySelector('.left-text1');
    const t2 = document.querySelector('.left-text2');
    const t3 = document.querySelector('.left-text3');
    const carouselTrack = document.querySelector('.hero-carousel .carousel-track');
    const carouselContainer = document.querySelector('.hero-carousel');
    const instaSection = document.querySelector('.instagram-section');
    const footerContactLinks = document.querySelectorAll('.footer-section .contact-link');
    const socialLinks = document.querySelector('.footer-section .social-links');

    [logoEl, heroBg, heroRight, aboutHeroImg, footerLogo, ...authLogos, t1, t2, t3, carouselTrack, carouselContainer, instaSection]
      .filter(Boolean).forEach(markHidden);

    // Insert minimalist skeleton blocks near key sections
    if (logoEl) appendSkeleton(logoEl, 'skeleton-logo');
  authLogos.forEach(el => appendSkeleton(el, 'skeleton-logo'));
  if (footerLogo) appendSkeleton(footerLogo, 'skeleton-logo');
  // Evitar skeleton para .bg-image (fixo) para não empurrar layout nas páginas como index
    if (carouselTrack) appendSkeleton(carouselTrack, 'skeleton-carousel');
  if (aboutHeroImg) appendSkeleton(aboutHeroImg, 'skeleton-hero');
    if (t1) appendSkeleton(t1, 'skeleton-text-line');
    if (t2) appendSkeleton(t2, 'skeleton-text-line small');
    if (t3) appendSkeleton(t3, 'skeleton-text-line');
    if (footerContactLinks && footerContactLinks.length) appendSkeleton(footerContactLinks[0], 'skeleton-footer');
    if (socialLinks) appendSkeleton(socialLinks, 'skeleton-footer');

    const [layout, settings] = await Promise.all([fetchLayout(), fetchSettings()]);
    if (layout) {
      applyLogo(layout);
      applyHome(layout);
      applyMenuCarousel(layout);
      applyInstagram(layout);
    } else {
      // Sem layout → esconder seções com conteúdo padrão para não expor defaults
      const hero = document.querySelector('.hero-carousel');
      if (hero) hero.classList.add('hide-if-no-data');
      if (heroBg) heroBg.classList.add('hide-if-no-data');
      if (heroRight) heroRight.classList.add('hide-if-no-data');
      [t1, t2, t3].filter(Boolean).forEach(el => el.classList.add('hide-if-no-data'));
      if (logoEl) logoEl.classList.add('hide-if-no-data');
    }
    if (settings) {
      applyFooter(settings, layout);
      // Reveal contact links and social after apply
      footerContactLinks.forEach(reveal);
      reveal(socialLinks);
    } else {
      // Hide only sensitive default content
      footerContactLinks.forEach(el => el.classList.add('hide-if-no-data'));
      if (socialLinks) socialLinks.classList.add('hide-if-no-data');
    }

    // Remove skeletons after we finished applying/hiding
    removeSkeletons();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
