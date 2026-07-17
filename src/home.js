window.Webflow ||= [];
window.Webflow.push(() => {
  // --------------------------- Animation de scroll pour les panels ---------------------------
  const allPanels = document.querySelectorAll('.home_services-panel_element');
  const scrollTriggers = [];
  allPanels.forEach((panel) => {
    const st = ScrollTrigger.create({
      trigger: panel,
      start: 'top top',
      end: 'bottom top',
      pin: true,
      pinSpacing: false,
      snap: {
        snapTo: 1,
        duration: {
          min: 0.45,
          max: 0.6,
        },
        delay: 0,
        ease: 'power1.inOut',
      },
    });
    scrollTriggers.push(st);
  });

  // Snap anticipé pour le premier panel : l'attire vers le haut
  // dès que son top atteint 30% du viewport
  if (allPanels.length > 0) {
    ScrollTrigger.create({
      trigger: allPanels[0],
      start: 'top 35%',
      end: 'top top',
      snap: {
        snapTo: 1,
        duration: { min: 0.45, max: 0.6 },
        delay: 0,
        ease: 'power1.inOut',
      },
    });
  }

  // Scroll vers une ancre dynamique via data-scroll-to="#slug"
  document.querySelectorAll('[data-scroll-to]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector('#' + link.dataset.scrollTo);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Sauvegarde du panel actif au click sur un lien data-link-to
  const dataLinkToLinks = document.querySelectorAll('[data-link-to]');
  dataLinkToLinks.forEach((link) => {
    link.addEventListener('click', () => {
      let activePanelIndex = 0;
      let closestDist = Infinity;
      allPanels.forEach((panel, i) => {
        const dist = Math.abs(panel.getBoundingClientRect().top);
        if (dist < closestDist) {
          closestDist = dist;
          activePanelIndex = i;
        }
      });
      sessionStorage.setItem('homePanelIndex', activePanelIndex);
    });
  });

  // Restauration du scroll si retour depuis une page avec data-back-to-home
  const restoreIndex = sessionStorage.getItem('homePanelIndex');
  const shouldRestore = sessionStorage.getItem('restoreHomePanel');
  if (shouldRestore && restoreIndex !== null) {
    sessionStorage.removeItem('restoreHomePanel');
    const index = parseInt(restoreIndex, 10);
    sessionStorage.removeItem('homePanelIndex');
    requestAnimationFrame(() => {
      const target = allPanels[index];
      if (target) {
        window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY);
      } else {
        console.warn(`[home] Aucun panel trouvé pour l'index ${index}`);
      }
    });
  }

  // Skip loader si on revient depuis la page service via data-back-to-home
  if (sessionStorage.getItem('skipHomeLoader')) {
    sessionStorage.removeItem('skipHomeLoader');
    const loaderWrap = document.querySelector('.loader_wrap');
    if (loaderWrap) loaderWrap.style.display = 'none';
    return;
  }

  // Flag pour savoir si l'animation d'intro est terminée
  let introFlashComplete = false;

  const loaderContent = document.querySelector('.loader_content_wrap');

  // Si l'animation a déjà été jouée lors de cette session, on cache le loader immédiatement
  // (ajout de ?loader dans l'URL pour forcer le rejeu en dev)
  const forceLoader = new URLSearchParams(window.location.search).has('loader');
  if (forceLoader) sessionStorage.removeItem('introPlayed');

  // Bloquer le scroll pendant le loader
  window.__vvLock.lock();

  // Bouton de bypass du loader (attribut data-loader-skip)
  document.querySelectorAll('[data-loader-skip]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (loaderVideo) loaderVideo.pause();
      introFlashComplete = true;
      playOutroAnimation();
    });
  });

  // Skip de l'intro par simple geste : molette (desktop), glissement tactile
  // (mobile), ou clic n'importe où dans le loader hors des vrais boutons/liens
  // ("NOS SERVICES", "LE PROJET"), qui gardent leur propre comportement.
  // Contrairement à data-skip-home-loader (rechargement de page), ce geste
  // fait disparaître le loader en place, sans recharger — plus immédiat.
  const loaderWrapEl = document.querySelector('.loader_wrap');
  if (loaderWrapEl) {
    let gestureSkipped = false;
    const skipViaGesture = (e) => {
      if (gestureSkipped) return;
      if (e.target.closest('a, button')) return; // laisse les vrais liens/boutons agir normalement
      gestureSkipped = true;
      if (loaderVideo) loaderVideo.pause();
      introFlashComplete = true;
      playOutroAnimation();
    };
    loaderWrapEl.addEventListener('wheel', skipViaGesture, { passive: true });
    loaderWrapEl.addEventListener('touchmove', skipViaGesture, { passive: true });
    loaderWrapEl.addEventListener('click', skipViaGesture);
  }

  // Déclencher l'outro automatiquement à la fin de la vidéo
  const isDesktopViewport = window.matchMedia('(min-width: 992px)').matches;
  const loaderVideo =
    (isDesktopViewport
      ? loaderContent.querySelector('.v-desk')
      : loaderContent.querySelector('.v-mob')) || loaderContent.querySelector('video');
  if (loaderVideo) {
    loaderVideo.addEventListener('ended', () => {
      playOutroAnimation();
    });
  }

  // Démarrage de la vidéo d'intro, subordonné au consentement cookies (Cookiebot)
  let introFlashTriggered = false;
  function triggerIntroFlashOnce() {
    if (introFlashTriggered) return;
    introFlashTriggered = true;
    playIntroFlashAnimation();
  }

  let introSequenceStarted = false;
  function startIntroSequence() {
    if (introSequenceStarted) return;
    introSequenceStarted = true;

    if (loaderVideo) {
      try {
        loaderVideo.currentTime = 0;
      } catch (err) {
        // Certains navigateurs refusent de modifier currentTime avant que
        // suffisamment de données ne soient chargées ; sans conséquence,
        // la vidéo repart de toute façon depuis son tout début par défaut.
      }
      loaderVideo.addEventListener('playing', triggerIntroFlashOnce, { once: true });
      loaderVideo.play().catch(() => {
        // Lecture refusée par le navigateur (cas rare pour une vidéo muted) :
        // le filet de sécurité ci-dessous prendra le relais.
      });
      setTimeout(triggerIntroFlashOnce, 4000);
    } else if (forceLoader || window.pageTransitionComplete) {
      triggerIntroFlashOnce();
    } else {
      document.addEventListener('pageTransitionComplete', triggerIntroFlashOnce, { once: true });
    }
  }

  // Neutralise immédiatement l'autoplay natif, avant même de savoir si Cookiebot
  // est présent ou combien de temps il mettra à répondre.
  if (loaderVideo) loaderVideo.pause();

  if ('Cookiebot' in window) {
    window.addEventListener('CookiebotOnConsentReady', startIntroSequence, { once: true });
    setTimeout(startIntroSequence, 5000);
  } else {
    startIntroSequence();
  }

  // Animation d'intro flash
  function playIntroFlashAnimation() {
    gsap.to('.loader_flash_wrap', {
      opacity: 0,
      duration: 0.8,
      onComplete: () => {
        document.querySelector('.loader_flash_wrap').style.display = 'none';
        introFlashComplete = true;
      },
    });
  }

  // Animation de sortie intro
  function playOutroAnimation() {
    if (introFlashComplete) {
      gsap.to('.loader_wrap', {
        opacity: 0,
        duration: 0.5,
        onComplete: () => {
          document.querySelector('.loader_wrap').style.display = 'none';
          window.__vvLock.unlock();
        },
      });
    }
  }
});
