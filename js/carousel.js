(function(){
  const section = document.querySelector('.carousel-section');
  if(!section) return;
  const track = section.querySelector('.carousel-track');
  const slides = Array.from(section.querySelectorAll('.carousel-slide'));
  const prevBtn = section.querySelector('.carousel-btn.prev');
  const nextBtn = section.querySelector('.carousel-btn.next');

  let index = 0;
  let isTransitioning = false;

  function update(){
    const offset = -index * 100;
    track.style.transform = `translateX(${offset}%)`;
  }

  function goNext(){
    if(isTransitioning) return;
    isTransitioning = true;
    index = (index + 1) % slides.length;
    update();
    setTimeout(()=>{isTransitioning=false;}, 420);
  }
  function goPrev(){
    if(isTransitioning) return;
    isTransitioning = true;
    index = (index - 1 + slides.length) % slides.length;
    update();
    setTimeout(()=>{isTransitioning=false;}, 420);
  }

  nextBtn.addEventListener('click', goNext);
  prevBtn.addEventListener('click', goPrev);

  // Keyboard support
  section.addEventListener('keydown', (e)=>{
    if(e.key === 'ArrowRight') goNext();
    if(e.key === 'ArrowLeft') goPrev();
  });
  section.setAttribute('tabindex', '0');

  // Auto-advance (optional). Comment out if not wanted.
  let auto = setInterval(goNext, 5000);
  section.addEventListener('mouseenter', ()=> clearInterval(auto));
  section.addEventListener('mouseleave', ()=> auto = setInterval(goNext, 5000));

  update();
})();