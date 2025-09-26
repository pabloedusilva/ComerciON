(function(){
  class NotificationSound {
    constructor(){
      this.enabled = true;
      this.src = '../../assets/sounds/notificações1.mp3';
      this.audio = null;
      this.loadSaved();
      this.prepare();
    }
    loadSaved(){
      try {
        const s = localStorage.getItem('soundSettings');
        if (s) {
          const j = JSON.parse(s);
          if (typeof j.enabled !== 'undefined') this.enabled = !!j.enabled;
          if (j.sound) this.src = j.sound;
        }
      } catch(_){}
    }
    prepare(){
      try{
        this.audio = new Audio(this.src);
        this.audio.volume = 0.8;
      } catch(_){}
    }
    play(){
      if (!this.enabled || !this.audio) return;
      try { this.audio.currentTime = 0; this.audio.play(); } catch(_){}
    }
    update(src){
      this.src = src;
      try{ this.audio = new Audio(this.src); this.audio.volume = 0.8; } catch(_){}
    }
    setEnabled(v){ this.enabled = !!v; }
  }
  window.notificationSound = new NotificationSound();
})();
