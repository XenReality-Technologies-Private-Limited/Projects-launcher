(function () {
  var modal   = document.getElementById('xrVideoModal');
  var video   = document.getElementById('xrSetupVideo');
  var btnOpen = document.getElementById('btnWatchVideo');
  var btnOpenConfig = document.getElementById('btnWatchConfiguratorVideo');
  var btnClose= document.getElementById('xrVideoClose');
  var btnPlay = document.getElementById('xrVideoPlayBtn');
  var fill    = document.getElementById('xrProgressFill');
  var prog    = document.getElementById('xrProgress');
  var timeEl  = document.getElementById('xrVideoTime');

  if (!modal || !video) return;

  function fmt(s) {
    var m = Math.floor(s / 60);
    return m + ':' + (Math.floor(s % 60) + '').padStart(2, '0');
  }

  function setPlaying(p) {
    btnPlay.querySelector('.xr-icon-play').style.display  = p ? 'none'   : 'inline';
    btnPlay.querySelector('.xr-icon-pause').style.display = p ? 'inline' : 'none';
  }

  function openModal(src) {
    if (src && video.src !== src) {
      video.src = src;
      video.load();
    }
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    video.play().then(function () { setPlaying(true); }).catch(function () {});
  }

  function closeModal() {
    video.pause();
    setPlaying(false);
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (btnOpen) {
    btnOpen.addEventListener('click', function() {
      openModal("https://d2uimaqek2eby3.cloudfront.net/Instruction_Manual/Subheading%20(1).mp4");
    });
  }

  if (btnOpenConfig) {
    btnOpenConfig.addEventListener('click', function() {
      openModal("https://d2uimaqek2eby3.cloudfront.net/Instruction_Manual/Configurator.mp4");
    });
  }
  btnClose.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

  btnPlay.addEventListener('click', function () {
    if (video.paused) { video.play(); setPlaying(true); }
    else              { video.pause(); setPlaying(false); }
  });

  video.addEventListener('timeupdate', function () {
    if (video.duration) {
      fill.style.width   = (video.currentTime / video.duration * 100) + '%';
      timeEl.textContent = fmt(video.currentTime);
    }
  });

  video.addEventListener('ended', function () { setPlaying(false); });

  prog.addEventListener('click', function (e) {
    var r = prog.getBoundingClientRect();
    if (video.duration) video.currentTime = ((e.clientX - r.left) / r.width) * video.duration;
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });
})();
