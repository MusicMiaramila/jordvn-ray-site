// Barre de navigation : ajoute un fond opaque au scroll
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('is-scrolled', window.scrollY > 40);
});

// Année courante dans le footer
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Menu mobile simple (le bouton burger ouvre les liens de nav en overlay)
const burger = document.getElementById('burger');
if (burger) {
  burger.addEventListener('click', () => {
    const links = document.querySelector('.nav__links');
    const open = links.style.display === 'flex';
    links.style.cssText = open
      ? ''
      : 'display:flex; flex-direction:column; position:fixed; top:64px; right:20px; background:rgba(10,11,22,0.95); padding:20px 28px; border-radius:12px; gap:18px;';
  });
}

// ---------- LIGHTBOX GALERIE ----------
(function () {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const closeBtn = document.getElementById('lightboxClose');
  const prevBtn = document.getElementById('lightboxPrev');
  const nextBtn = document.getElementById('lightboxNext');
  const countEl = document.getElementById('lightboxCount');
  if (!lightbox) return;

  // Regroupe les images par section (data-lightbox-group), dans l'ordre du DOM
  const groups = {};
  document.querySelectorAll('img[data-lightbox-group]').forEach((img) => {
    const key = img.getAttribute('data-lightbox-group');
    if (!groups[key]) groups[key] = [];
    groups[key].push(img);
  });

  let currentGroup = [];
  let currentIndex = 0;

  function render() {
    const img = currentGroup[currentIndex];
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt || '';
    const multi = currentGroup.length > 1;
    prevBtn.hidden = !multi;
    nextBtn.hidden = !multi;
    countEl.textContent = multi ? (currentIndex + 1) + ' / ' + currentGroup.length : '';
  }

  function open(groupKey, index) {
    currentGroup = groups[groupKey];
    currentIndex = index;
    render();
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function showNext() {
    currentIndex = (currentIndex + 1) % currentGroup.length;
    render();
  }

  function showPrev() {
    currentIndex = (currentIndex - 1 + currentGroup.length) % currentGroup.length;
    render();
  }

  Object.keys(groups).forEach((key) => {
    groups[key].forEach((img, index) => {
      img.addEventListener('click', () => open(key, index));
    });
  });

  closeBtn.addEventListener('click', close);
  nextBtn.addEventListener('click', showNext);
  prevBtn.addEventListener('click', showPrev);

  // Clic en dehors de l'image (sur le fond) ferme la lightbox
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });

  // Navigation clavier
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') showNext();
    if (e.key === 'ArrowLeft') showPrev();
  });
})();


// ---------- CHARGEMENT DES VIDÉOS TIKTOK À LA DEMANDE ----------
// Les vidéos ne sont chargées qu'au clic sur "Lancer la vidéo", pour éviter que toutes les
// vidéos ne démarrent/se chargent en même temps à l'ouverture du site.
(function () {
  function loadTikTokScript() {
    // On (re)crée une balise <script> à chaque appel : c'est ce qui déclenche TikTok à traiter
    // les nouveaux <blockquote> insérés dynamiquement dans la page.
    const script = document.createElement('script');
    script.src = 'https://www.tiktok.com/embed.js';
    script.async = true;
    document.body.appendChild(script);
  }

  function loadInstagramScript() {
    const script = document.createElement('script');
    script.src = 'https://www.instagram.com/embed.js';
    script.async = true;
    document.body.appendChild(script);
  }

  // Égalise la hauteur de toutes les cartes "ouvertes" (vraies vidéos + carte de secours)
  // d'une même grille sur la plus grande d'entre elles : chaque vidéo garde sa taille réelle
  // (rien n'est déformé), mais la carte elle-même s'agrandit pour matcher les autres — un
  // espace vide apparaît sous les vidéos plus courtes plutôt que des cartes de tailles inégales.
  function equalizeOpenRowHeights(card) {
    const grid = card.closest('.videos__grid');
    if (!grid) return;
    const openCards = Array.from(grid.querySelectorAll('.video-card--embed, .video-card--stretch'));
    let maxHeight = 0;
    openCards.forEach((c) => {
      const h = parseFloat(c.dataset.trueHeight || '0');
      if (h > maxHeight) maxHeight = h;
    });
    if (maxHeight > 0) {
      openCards.forEach((c) => { c.style.height = maxHeight + 'px'; });
    }
  }

  function scaleEmbedToFit(card, iframe) {
    // TikTok redimensionne l'iframe progressivement pendant le chargement (le contenu arrive
    // par étapes). On attend que sa hauteur cesse de bouger avant de calculer la réduction,
    // pour ne jamais figer une mesure prise en cours de chargement (carte trop petite/déformée).
    let lastHeight = -1;
    let stableTicks = 0;
    let checks = 0;

    function check() {
      checks += 1;
      const w = iframe.offsetWidth;
      const h = iframe.offsetHeight;

      if (w > 0 && h > 100 && h === lastHeight) {
        stableTicks += 1;
      } else {
        stableTicks = 0;
      }
      lastHeight = h;

      if (stableTicks >= 2) {
        applyScale(w, h);
      } else if (checks < 25) {
        setTimeout(check, 200);
      } else if (w > 0 && h > 100) {
        // Dernier recours après ~5s : on applique la dernière mesure valable plutôt que rien.
        applyScale(w, h);
      }
    }

    function applyScale(naturalWidth, naturalHeight) {
      const availableWidth = card.clientWidth;
      // On ne grossit jamais la vidéo au-delà de sa taille réelle (scale max = 1) : pour une
      // carte plus large que la vidéo (ex: "à la une"), on la centre plutôt que de l'agrandir.
      const scale = Math.min(1, availableWidth / naturalWidth);
      const centerOffsetX = scale < 1 ? 0 : Math.round((availableWidth - naturalWidth) / 2);
      // Léger décalage vers le haut (en pixels finaux, fixe) pour faire disparaître le liseré
      // décoratif de TikTok. Combiné au cache CSS (.video-card--embed::before).
      const shiftUp = 10;
      const trueHeight = Math.round(naturalHeight * scale);
      iframe.style.width = naturalWidth + 'px';
      iframe.style.height = naturalHeight + 'px';
      iframe.style.transform =
        'translate(' + centerOffsetX + 'px, -' + shiftUp + 'px) scale(' + scale + ')';
      card.dataset.trueHeight = trueHeight;
      card.style.height = trueHeight + 'px';
      equalizeOpenRowHeights(card);

      // La vidéo est prête et à la bonne taille : on retire l'écran de chargement.
      const loading = card.querySelector('.video-card__loading');
      if (loading) loading.remove();
      iframe.style.visibility = 'visible';
    }

    check();
  }

  function playVideo(card) {
    const videoId = card.getAttribute('data-tiktok-id');
    const tiktokUrl = card.getAttribute('data-tiktok-url');
    const instagramUrl = card.getAttribute('data-instagram-url');
    const platform = instagramUrl ? 'instagram' : 'tiktok';
    const url = instagramUrl || tiktokUrl;
    if (!url) return;
    if (platform === 'tiktok' && !videoId) return;

    // On fige la hauteur actuelle de la carte (celle qu'elle a fermée) avant toute modification :
    // sans ça, le passage à la classe "embed" (hauteur automatique) fait momentanément
    // s'effondrer la carte le temps que la vidéo se charge, avant de reprendre sa taille —
    // un sursaut visuel disgracieux qu'on évite en verrouillant la taille dès le départ.
    card.style.height = card.getBoundingClientRect().height + 'px';

    // Largeur cible pour TikTok/Instagram : au moins 325px (sous ce seuil, leur affichage se
    // rogne au lieu de se redimensionner), et jusqu'à 605px (leur maximum recommandé) si la
    // carte est large (ex : la vidéo "à la une"), pour ne pas la laisser artificiellement étroite.
    const targetWidth = Math.max(325, Math.min(card.clientWidth, 605));

    // Écran de chargement (fond noir + icône bleue) : masque le blockquote brut et le futur
    // iframe pendant qu'ils se préparent, plutôt que de laisser apparaître un flash blanc.
    const widthStyle = 'width:' + targetWidth + 'px;min-width:' + targetWidth + 'px;max-width:' + targetWidth + 'px;';
    const embedHtml = platform === 'instagram'
      ? '<blockquote class="instagram-media" data-instgrm-permalink="' + url + '" data-instgrm-version="14" style="' + widthStyle + '"></blockquote>'
      : '<blockquote class="tiktok-embed" cite="' + url + '" data-video-id="' + videoId + '" style="' + widthStyle + '"><section></section></blockquote>';

    card.innerHTML = '<div class="video-card__loading"><span class="spinner"></span></div>' + embedHtml;
    card.classList.add('video-card--embed');
    card.style.backgroundImage = ''; // la miniature d'aperçu n'est plus nécessaire une fois la vidéo lancée

    if (platform === 'instagram') {
      loadInstagramScript();
    } else {
      loadTikTokScript();
    }

    const platformLabel = platform === 'instagram' ? 'Instagram' : 'TikTok';

    // On surveille l'apparition de l'iframe généré par TikTok/Instagram pour la mettre à
    // l'échelle dès qu'elle est prête. Si rien n'apparaît après quelques secondes (vidéo
    // supprimée/privée...), on propose le lien direct à la place.
    let attempts = 0;
    const poll = setInterval(() => {
      attempts += 1;
      const iframe = card.querySelector('iframe');
      if (iframe && iframe.offsetWidth > 0) {
        clearInterval(poll);
        iframe.style.visibility = 'hidden'; // reste caché tant que la taille finale n'est pas calculée
        scaleEmbedToFit(card, iframe);
      } else if (attempts >= 20) {
        clearInterval(poll);
        card.innerHTML =
          '<a href="' + url + '" target="_blank" rel="noopener" class="video-card__fallback">' +
          '<span class="play-icon"></span><span>Voir sur ' + platformLabel + '</span></a>';
        card.classList.remove('video-card--embed');
        card.classList.add('video-card--stretch');
      }
    }, 300);
  }

  document.querySelectorAll('.video-card__play').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.video-card');
      if (card) playVideo(card);
    });
  });

  // Avant tout clic : on récupère la miniature réelle de chaque vidéo TikTok via son API oEmbed
  // publique, pour que le visiteur sache ce qu'il va lancer. (Instagram ne propose pas d'API
  // oEmbed publique équivalente sans authentification : sa carte garde l'apparence par défaut.)
  document.querySelectorAll('.video-card[data-tiktok-url]').forEach((card) => {
    const url = card.getAttribute('data-tiktok-url');
    fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(url))
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (data.thumbnail_url) {
          card.style.backgroundImage =
            'linear-gradient(rgba(10,11,22,0.25), rgba(10,11,22,0.55)), url("' + data.thumbnail_url + '")';
          card.style.backgroundSize = 'cover';
          card.style.backgroundPosition = 'center';
        }
        // Remarque : on n'utilise pas data.width/data.height ici, car ce ratio correspond à la
        // vidéo seule, pas à l'embed TikTok complet (avec auteur, légende, vidéos similaires...)
        // qui est nettement plus haut. La carte garde donc le format standard défini en CSS.
      })
      .catch(() => {
        // API indisponible (réseau, CORS...) : la carte garde son apparence par défaut, sans bloquer le reste du site.
      });
  });
})();
