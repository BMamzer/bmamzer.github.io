// Bio-link pages (/tt, /ig, /yt): the released games, with store links tagged for the platform the visitor came from.
// Only games on the released list in the social media guide go here (rule 1: nothing about unreleased games).
// Each page sets data-source (tiktok, instagram, youtube) on <main>. data-straight="<game id>" sends phone visitors
// straight to that game's store page instead of showing the list.
(() => {
  // App Store Connect campaign provider token (the pt= in a campaign link from App Analytics > Campaigns).
  const APP_STORE_PROVIDER_TOKEN = '';

  const GAMES = [
    {
      id: 'powerlust',
      name: 'Powerlust',
      credit: 'I made this',
      line: 'A dark fantasy action RPG: build your own class and hack through dungeons with manual combat, fully offline.',
      price: { phone: 'Free to play · in-app purchases', desktop: 'Phones: free to play · in-app purchases. PC: paid, on Steam' },
      icon: '/bio/powerlust.webp',
      googleplay: 'bartmamzer.powerlust.actionrpg.roguelike',
      appstore: '1439088319',
      steam: '1829520/Powerlust',
    },
    {
      id: 'legends-of-amberland',
      name: 'Legends of Amberland',
      subtitle: 'The Forgotten Crown',
      credit: 'I ported this to phones · originally by Silver Lemur Games',
      line: 'A retro party RPG: seven heroes explore an open fantasy world and its dungeons square by square, in turn-based fights.',
      price: { phone: 'Premium, one-time price · no ads, no in-app purchases' },
      icon: '/bio/legends-of-amberland.webp',
      googleplay: 'bartmamzer.games.classic.offline.turn.based.rpg.legends.of.amberland.i',
      appstore: '6783288687',
    },
  ];

  const STORES = {
    googleplay: { label: 'Google Play', icon: 'M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z' },
    appstore: { label: 'App Store', icon: 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701' },
    steam: { label: 'Steam', icon: 'M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z' },
  };

  // Store order per device: the first store the game has is the big button, the rest go in the small row.
  const ORDER = {
    ios: ['appstore', 'googleplay', 'steam'],
    android: ['googleplay', 'appstore', 'steam'],
    desktop: ['steam', 'googleplay', 'appstore'],
  };

  const main = document.querySelector('main[data-source]');
  const source = main.dataset.source;

  function detectDevice() {
    const ua = navigator.userAgent;
    // iPadOS reports itself as a Mac, so a Mac with a touch screen is an iPad.
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'desktop';
  }

  function storeUrl(store, game) {
    const utm = `utm_source=${source}&utm_medium=social&utm_campaign=bio`;
    if (store === 'googleplay') return `https://play.google.com/store/apps/details?id=${game.googleplay}&referrer=${encodeURIComponent(utm)}`;
    if (store === 'appstore') {
      const pt = APP_STORE_PROVIDER_TOKEN ? `pt=${APP_STORE_PROVIDER_TOKEN}&` : '';
      return `https://apps.apple.com/app/id${game.appstore}?${pt}ct=${source}-bio&mt=8`;
    }
    return `https://store.steampowered.com/app/${game.steam}/?${utm}`;
  }

  function storeIcon(store) {
    return `<svg class="store-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false"><path d="${STORES[store].icon}"/></svg>`;
  }

  function card(game, device) {
    const stores = ORDER[device].filter((store) => game[store]);
    const [first, ...rest] = stores;
    const price = (device === 'desktop' && game.price.desktop) || game.price.phone;
    const others = rest.length
      ? `<p class="also">Also on ${rest.map((store) => `<a href="${storeUrl(store, game)}">${STORES[store].label}</a>`).join(' · ')}</p>`
      : '';
    return `
      <li class="game" id="${game.id}">
        <div class="game-head">
          <img class="game-icon" src="${game.icon}" width="72" height="72" alt="">
          <div>
            <h2>${game.name}${game.subtitle ? `<span class="subtitle">${game.subtitle}</span>` : ''}</h2>
            <p class="credit">${game.credit}</p>
          </div>
        </div>
        <p class="line">${game.line}</p>
        <p class="price">${price}</p>
        <a class="store" href="${storeUrl(first, game)}">${storeIcon(first)}<span>${STORES[first].label}</span></a>
        ${others}
      </li>`;
  }

  const device = detectDevice();
  const straight = GAMES.find((game) => game.id === main.dataset.straight);
  if (straight && device !== 'desktop') {
    location.replace(storeUrl(ORDER[device].find((store) => straight[store]), straight));
    return;
  }
  document.documentElement.dataset.device = device;
  main.querySelector('.games').innerHTML = GAMES.map((game) => card(game, device)).join('');
})();
