# Changelog

All notable changes are documented here, following
[Keep a Changelog](https://keepachangelog.com/) and [SemVer](https://semver.org/).

## 1.0.0 (2026-07-16)


### Features

* **access:** add coach login, signup and logout actions ([ea5a1bb](https://github.com/spockey4711/hockey-video-analysis/commit/ea5a1bb5af047567699d8c8fe300386728425987))
* **access:** add SignOutForm sign-out control ([779f4a9](https://github.com/spockey4711/hockey-video-analysis/commit/779f4a95551d3f1736c37453f25b1ffe8f755e55))
* **access:** mount sign-out control in coach app shell (P0-2) ([30aa8a5](https://github.com/spockey4711/hockey-video-analysis/commit/30aa8a516803314585038e3351635c35caf6864e))
* **access:** rotate a player's share token to revoke a link ([2dfaca5](https://github.com/spockey4711/hockey-video-analysis/commit/2dfaca56ed82ef81986b714071cae4cd1b1e5b7b))
* add quarter split for navigation and clips ([172571e](https://github.com/spockey4711/hockey-video-analysis/commit/172571eb0babdd92462ae69d9c761cdf3b8042fb))
* **app:** mount sign-out control in coach games app shell ([b15c214](https://github.com/spockey4711/hockey-video-analysis/commit/b15c2149b73df36e87f04400f67d2b597f109fef))
* **app:** scaffold Next.js app shell and build config ([0b99705](https://github.com/spockey4711/hockey-video-analysis/commit/0b99705041cfb972f046446738d814bf274b8a3c))
* **auth:** add login/signup pages and route-protection middleware ([27d498d](https://github.com/spockey4711/hockey-video-analysis/commit/27d498da1c3d40b1c359b59d4302dbe1be047904))
* **auth:** add scrypt hashing and database-backed sessions ([f2192e3](https://github.com/spockey4711/hockey-video-analysis/commit/f2192e3ce9294284464b416723d9cbb2ea97467a))
* **auth:** coach login with database-backed sessions (P0-2) ([19a6c84](https://github.com/spockey4711/hockey-video-analysis/commit/19a6c8445d36d4463d9e1444545d049aefd577d6))
* **auth:** visual pass on login and signup screens ([86b025b](https://github.com/spockey4711/hockey-video-analysis/commit/86b025b7764f1dbadf97b365525ed2b17253946e))
* **auth:** visual pass on login and signup screens (UX-3) ([1e97567](https://github.com/spockey4711/hockey-video-analysis/commit/1e97567fddf51c1c862f1250de9b26166f741f58))
* chapter-boundary clips (P1-7) ([c8d5753](https://github.com/spockey4711/hockey-video-analysis/commit/c8d5753bb7aa3fd8ccb8eb91c3728e3d35dcc1d5))
* clean light theme with persistent toggle (P2-14) ([02b1f24](https://github.com/spockey4711/hockey-video-analysis/commit/02b1f24127ac89826ab11bf387f7f6924d7f48bc))
* **clips:** add clip-board view helpers for the watch page ([b39ea89](https://github.com/spockey4711/hockey-video-analysis/commit/b39ea89fc5f8d88e0c2a9bbb00935d08ca52806c))
* **clips:** comment on clips via coach or share link (P1-2) ([4918c2a](https://github.com/spockey4711/hockey-video-analysis/commit/4918c2a73372bfeac0badebfc6954d2f950782d7))
* **clips:** comments on clips (P1-2) ([00280b3](https://github.com/spockey4711/hockey-video-analysis/commit/00280b31e30b2795784dee548f01375ebb8d8082))
* **clips:** enqueue cut jobs from tags and track status ([00a4940](https://github.com/spockey4711/hockey-video-analysis/commit/00a4940d1194c1910a5ce2d5abaac6af681cec10))
* **clips:** enqueue cut jobs from tags and track status (P0-9) ([a160782](https://github.com/spockey4711/hockey-video-analysis/commit/a160782dd35a564b14c98e50eb2d83cb97de14e2))
* **clips:** plan per-file cuts for boundary-crossing clip windows ([c7e3225](https://github.com/spockey4711/hockey-video-analysis/commit/c7e3225dd03225f1c12468d549fede35a42df3f7))
* **collections:** clip collections / playlists (P2-13) ([ad913c4](https://github.com/spockey4711/hockey-video-analysis/commit/ad913c47ca2aad83f2dc7d334826128616104e07))
* **collections:** coach curation and login-free share for clip collections ([4d1d05f](https://github.com/spockey4711/hockey-video-analysis/commit/4d1d05f84b9cb2b4deaeb7636f3e54161f83cea5))
* **core:** add Heading primitive in the Saira display face ([ffe9e76](https://github.com/spockey4711/hockey-video-analysis/commit/ffe9e76cfbd518d6c0885853957557e8b6c40449))
* **core:** register sun and moon glyphs ([6ac6528](https://github.com/spockey4711/hockey-video-analysis/commit/6ac65282ffa3d6fe73348ff68decaca9e9e003c3))
* **db:** add collections and collection_clips tables ([97c2a3b](https://github.com/spockey4711/hockey-video-analysis/commit/97c2a3ba0aefb207e60f6b16ffae653747da5cbd))
* **db:** add full Postgres schema, client and migration ([d019aef](https://github.com/spockey4711/hockey-video-analysis/commit/d019aef859a1e719805736aeb7386109ec00bb6d))
* **design-system:** add a shared EmptyState primitive ([38e8cd3](https://github.com/spockey4711/hockey-video-analysis/commit/38e8cd39ca87fdb03299d2eebbd0b2644487ae29))
* **design-system:** add a shared PanelHeader and adopt it in the seven panels (G4) ([af980aa](https://github.com/spockey4711/hockey-video-analysis/commit/af980aae0cc610209f68eac406a0504e644a15a4))
* **design-system:** add a shared PanelHeader primitive ([9296b8b](https://github.com/spockey4711/hockey-video-analysis/commit/9296b8b07af5f2158a8d03fcabbf65f979fc80ad))
* **design-system:** add EmptyState primitive and adopt on home/games/watch/clip board (G6) ([be4f348](https://github.com/spockey4711/hockey-video-analysis/commit/be4f3481576e8c5969e0d5ba48fdd54f4e5d9b0a))
* **design-system:** give Card a raised panel variant and polymorphic element ([affa6bc](https://github.com/spockey4711/hockey-video-analysis/commit/affa6bce70202b7e0c49e676287d87b3ce6fc9e2))
* **design:** add design-system tokens and global stylesheet ([16cbd0f](https://github.com/spockey4711/hockey-video-analysis/commit/16cbd0f1beb485cfbc90e8aef7ff3c7161ed531f))
* **design:** Heading primitive + retire --fs-heading (P2-8 G1/G2/G8) ([c9f6874](https://github.com/spockey4711/hockey-video-analysis/commit/c9f6874e6722cce2ce8b66c4cec7e49d0715a134))
* **design:** import design-system foundation (tokens, docs, backlog) ([9b76e7f](https://github.com/spockey4711/hockey-video-analysis/commit/9b76e7f8d927f76ead5d71902fe09448ac34d306))
* **design:** render page headings through Heading, retire --fs-heading ([d0aeb94](https://github.com/spockey4711/hockey-video-analysis/commit/d0aeb9478328c60711885bf2ee4678597dcaed4a))
* **games:** add create-game feature module ([d27eccc](https://github.com/spockey4711/hockey-video-analysis/commit/d27eccc65e8fdfbb5ed66b356198518892b623b0))
* **games:** add games list, create page and games API route ([eb15422](https://github.com/spockey4711/hockey-video-analysis/commit/eb15422d4ec723ca785fe0cfc553743848582cb7))
* **games:** add presentational list and create components ([0ad5624](https://github.com/spockey4711/hockey-video-analysis/commit/0ad562425f46b4838284b8503272f1aacf22474a))
* **games:** create a game and attach ordered chapter files (P0-3) ([b6ae1c5](https://github.com/spockey4711/hockey-video-analysis/commit/b6ae1c5910d99c1445ffbbfbc13ee4bcdc71b638))
* **games:** games list and create polish (UX-5) ([a498a71](https://github.com/spockey4711/hockey-video-analysis/commit/a498a71e7039b6b2e633faaabf8021ebad9ac903))
* **games:** let a coach name an auto-ingested game ([f3acb80](https://github.com/spockey4711/hockey-video-analysis/commit/f3acb80eb73908f78fa77713d1cf0b213a4e54ba))
* **games:** wire games pages to the new DS components ([58b665e](https://github.com/spockey4711/hockey-video-analysis/commit/58b665e35732447b614a5c9e71f074a30d3942ef))
* **home:** auth-aware coach landing page ([f483026](https://github.com/spockey4711/hockey-video-analysis/commit/f483026c5efbaee7e47eb4b4fe9d4b487d4b6c48))
* **home:** auth-aware coach landing page (UX-2) ([d956891](https://github.com/spockey4711/hockey-video-analysis/commit/d9568911f81870388f4366212193b5215b13f11d))
* **home:** rebuild landing page around a demo game-timeline hero ([774f4fd](https://github.com/spockey4711/hockey-video-analysis/commit/774f4fd885a87749cadc463b12ba6b73f34aa771))
* **home:** rebuild landing page around a demo game-timeline hero ([f5b432e](https://github.com/spockey4711/hockey-video-analysis/commit/f5b432ecd7cc8a3606153ab81820df19794893a5))
* hotkey tagging + configurable tag-type module (P0-6, P1-3) ([b6f2a33](https://github.com/spockey4711/hockey-video-analysis/commit/b6f2a33e6742efe63f0bb2e4ad08c773bea11c2d))
* **icons:** add log-out glyph to the icon registry ([6308575](https://github.com/spockey4711/hockey-video-analysis/commit/63085752cc5a6d3aaef5be306addd464b9eceab0))
* **ingest:** add drop-a-folder ingest endpoint and auto-create path ([4c4092c](https://github.com/spockey4711/hockey-video-analysis/commit/4c4092cb26e5eb27f9c3ba382d02e690dd16ff40))
* **ingest:** declare INGEST_TOKEN env contract ([96a7fca](https://github.com/spockey4711/hockey-video-analysis/commit/96a7fcab71ee52ca302f15fcc5edd25d8c680f80))
* **ingest:** drop-a-folder game ingest (P2-9) ([089050c](https://github.com/spockey4711/hockey-video-analysis/commit/089050cd5368ed70f860f03ec03c146d421ec561))
* **jump-markers:** refresh markers live as tags are captured ([5179057](https://github.com/spockey4711/hockey-video-analysis/commit/5179057c6fb40d7e94be3a51bd6151c08faaa51e))
* **jump-markers:** refresh markers live as tags are captured ([5c9c903](https://github.com/spockey4711/hockey-video-analysis/commit/5c9c90324960f8511b2ec25d63bcd427eb69ef3c))
* Next.js app shell + full Postgres schema (P0-1) ([b8d878e](https://github.com/spockey4711/hockey-video-analysis/commit/b8d878e752d606b19374585483147fa1fc3d14d2))
* **player:** add jump-marker navigation core and query ([d974bd9](https://github.com/spockey4711/hockey-video-analysis/commit/d974bd90c3f6f54e3ea0504080b9cedd294b98b3))
* **player:** add jump-marker timeline ticks and nav panel ([7a3bf43](https://github.com/spockey4711/hockey-video-analysis/commit/7a3bf43d42a163d588ca281ac4e360fcd7382493))
* **player:** add pitch-green video backdrop (P2-8 G9) ([e5c38cf](https://github.com/spockey4711/hockey-video-analysis/commit/e5c38cfcbc8251b014fb94e9adfec25c1c7f21f6))
* **player:** add pitch-green video backdrop (P2-8 G9) ([771f640](https://github.com/spockey4711/hockey-video-analysis/commit/771f640a37adf890c3011321625b5da83e08e0f9))
* **player:** add scan speed and frame/second step to the controller ([7c495aa](https://github.com/spockey4711/hockey-video-analysis/commit/7c495aad7742ac978d6c82c64c6ef49597eb34eb))
* **player:** coach watch page shell for a game (P0-5) ([9f62027](https://github.com/spockey4711/hockey-video-analysis/commit/9f6202721b55fd4dd8f9be2264f326566efcea7a))
* **player:** continuous multi-chapter player and watch shell (P0-5) ([7658543](https://github.com/spockey4711/hockey-video-analysis/commit/7658543fbbb96defce5e0aeadd36b6973de049d2))
* **player:** continuous multi-chapter player component (P0-5) ([dae09f9](https://github.com/spockey4711/hockey-video-analysis/commit/dae09f95ac4899234adc6a1d7e4828ae9309f80f))
* **player:** declare MEDIA_PROXY_BASE_URL for tagging proxies ([b7727e5](https://github.com/spockey4711/hockey-video-analysis/commit/b7727e5b3c0c7efc7fb6f12f4ca8a3b2cacb0cc7))
* **player:** instant jump-marker mode (P1-1) ([3aa58b6](https://github.com/spockey4711/hockey-video-analysis/commit/3aa58b6d14966662cace7ca34b6f1448d4bb7b6f))
* **player:** lighten the in-browser tagging player (P2-6) ([0c10305](https://github.com/spockey4711/hockey-video-analysis/commit/0c10305913091ce1dd5a68d692465d921ec0963c))
* **player:** play proxy renditions when configured ([fa0f9c8](https://github.com/spockey4711/hockey-video-analysis/commit/fa0f9c84208bd0890d022459bc122a46d02e3fdd))
* **player:** playback transport controls (P2-7) ([76d4835](https://github.com/spockey4711/hockey-video-analysis/commit/76d4835e49647bbe7726c3db201a6310d958680f))
* **player:** pure multi-chapter playback helpers (P0-5) ([0f1303a](https://github.com/spockey4711/hockey-video-analysis/commit/0f1303a8fe02a35a6ca14a744c7bf1a8e174b07a))
* **player:** remove REC readout from the video frame ([8c79081](https://github.com/spockey4711/hockey-video-analysis/commit/8c790816c72992021d432d522cba065b7480abfc))
* **player:** remove REC readout from the video frame ([03fd104](https://github.com/spockey4711/hockey-video-analysis/commit/03fd104b20a065b6b3abb6e63024d17f90225a0a))
* **players:** add coach roster surface for link rotation and erasure ([fc26570](https://github.com/spockey4711/hockey-video-analysis/commit/fc26570688d182b9a3071de35c1f7d4670fcdbcb))
* **players:** erase a player and their personal data (GDPR) ([b3dcd60](https://github.com/spockey4711/hockey-video-analysis/commit/b3dcd60066cc55bf5e32955edf49707425a219c5))
* **players:** roster surface for P1-6 (share-token rotation and erasure) ([4483ccc](https://github.com/spockey4711/hockey-video-analysis/commit/4483ccc89303a2c889c411ba1c1981be4aaea59a))
* **player:** wire jump markers into the watch page ([3435966](https://github.com/spockey4711/hockey-video-analysis/commit/34359666e873f4c6f822b3e5ce6461ec07a15cba))
* **player:** wire transport chrome and keyboard controls ([4b8c620](https://github.com/spockey4711/hockey-video-analysis/commit/4b8c620fdb75c8c9a7e938c3145f91501e90c9ce))
* quarter split for navigation and clips (P1-4) ([7a45878](https://github.com/spockey4711/hockey-video-analysis/commit/7a458787c6b82067dab58f56e9828a82e8c85cfd))
* **quarters:** fill watch player quarter overlay slot (UX-4) ([3047a6f](https://github.com/spockey4711/hockey-video-analysis/commit/3047a6faf77cf4711c20420198dcc9731bddd800))
* **quarters:** fill watch player quarter overlay slot (UX-4) ([5979253](https://github.com/spockey4711/hockey-video-analysis/commit/5979253dbbb09aec14ed68a985d9868451805787))
* **settings:** add coach settings page ([9c473b5](https://github.com/spockey4711/hockey-video-analysis/commit/9c473b5c849f549fae8c5ed3c9f22ccd243b830e))
* **settings:** coach settings page (account + theme) ([3206523](https://github.com/spockey4711/hockey-video-analysis/commit/3206523749f732786589f0e7a75d60596053ada1))
* share-token rotation and player erasure (P1-6, GDPR) ([aef5eeb](https://github.com/spockey4711/hockey-video-analysis/commit/aef5eeb8bf81e4d6eb5d955e6fdd37f827bb28a1))
* **share:** add login-free share surface shell (UX-7) ([428d6d1](https://github.com/spockey4711/hockey-video-analysis/commit/428d6d1c1b26770d309763ca473c824c255b3b9a))
* **share:** add per-player clip view via secret link (P0-11) ([694097e](https://github.com/spockey4711/hockey-video-analysis/commit/694097ed47ae8c898832b8300ba20183bce62997))
* **share:** add presentation mode for team sessions ([520f50b](https://github.com/spockey4711/hockey-video-analysis/commit/520f50bcc53b55e132524b9790e0e00a54033475))
* **share:** add shared PlaylistPlayer component ([2b0354b](https://github.com/spockey4711/hockey-video-analysis/commit/2b0354b87d1e1be9d49f5761e8a9cc861616dafb))
* **share:** add team clip view via secret link (P0-10) ([49c2200](https://github.com/spockey4711/hockey-video-analysis/commit/49c2200203931589e040e510d0f7cb57edccf7fa))
* **share:** login-free share surface shell (UX-7) ([72bc5e6](https://github.com/spockey4711/hockey-video-analysis/commit/72bc5e6d634fddb85787f551c50720c3dbaa8f15))
* **share:** per-player clip view via secret link (P0-11) ([b180f4c](https://github.com/spockey4711/hockey-video-analysis/commit/b180f4cd37b72024c83861c338d6f9f0265e161f))
* **share:** presentation mode for team sessions (P1-8) ([a327d9f](https://github.com/spockey4711/hockey-video-analysis/commit/a327d9f95a9c2a931cb82a5b110cf7f38eccab7a))
* **share:** surface the team share link to the coach ([50ef898](https://github.com/spockey4711/hockey-video-analysis/commit/50ef8984db22aded667c21f05edad69571768040))
* **share:** surface the team share link to the coach (P2-4) ([5bffb3e](https://github.com/spockey4711/hockey-video-analysis/commit/5bffb3e3ea8d4a53b6c7b5fc1aba1e18e64cfd69))
* **share:** team clip view via secret link (P0-10) ([09436fe](https://github.com/spockey4711/hockey-video-analysis/commit/09436fe455900c4cf15023c68c835cb7c07e004f))
* **share:** wire presentation mode into the per-player share link ([2edfeee](https://github.com/spockey4711/hockey-video-analysis/commit/2edfeee8392f73ec71a586ad0c3bc58f22563f53))
* **share:** wire presentation mode into the per-player share link ([8c74430](https://github.com/spockey4711/hockey-video-analysis/commit/8c74430d31e329c718a4400815fb2e05a614a932))
* **shell:** add coach app shell and primary navigation ([91e20c1](https://github.com/spockey4711/hockey-video-analysis/commit/91e20c18a8c5d27b6cbe6221fa232370f09aa137))
* **shell:** add persistent light/dark theme toggle ([d6187bc](https://github.com/spockey4711/hockey-video-analysis/commit/d6187bc2e6a3daab7128417b721b6d0e68604339))
* **shell:** coach app shell and primary navigation (UX-1) ([aa5b2c6](https://github.com/spockey4711/hockey-video-analysis/commit/aa5b2c65d2dea4c6a86cb48dc065e164a2d5b9a3))
* **shell:** wrap the root layout in AppShell and drop the games bar ([f8e6d91](https://github.com/spockey4711/hockey-video-analysis/commit/f8e6d91f4b3e9eee51630fbb07e60d30b29b114a))
* **styles:** add light theme token layer ([2394daf](https://github.com/spockey4711/hockey-video-analysis/commit/2394dafa184cd51b83744b692dae00226d21b1e3))
* **suggestions:** review double-whistle candidates into goal tags ([438584b](https://github.com/spockey4711/hockey-video-analysis/commit/438584b87f7292f969dd44b9045e032eab3877fb))
* **suggestions:** whistle-suggestion review (P1-5) ([f1810ed](https://github.com/spockey4711/hockey-video-analysis/commit/f1810eda2246e1b7b8ef9852f878716bda046ac3))
* **tag-edit:** add editable tag list to the watch sidebar ([352ff2b](https://github.com/spockey4711/hockey-video-analysis/commit/352ff2bb0cec29768a7f9e9b821925e3ff5acb60))
* **tag-edit:** add PATCH/DELETE tag API with edit/delete queries ([8aaeb61](https://github.com/spockey4711/hockey-video-analysis/commit/8aaeb6144e3ebbd330158a6d01720bfe8fea2bab))
* **tag-edit:** edit and delete tags after capture (P0-8) ([5e64e68](https://github.com/spockey4711/hockey-video-analysis/commit/5e64e68523b5c8085b94b890b8360faf8561b6e8))
* **tag-players:** add roster listing and client-safe barrel ([ef307ae](https://github.com/spockey4711/hockey-video-analysis/commit/ef307ae4b307dbb6af792827db4edf5c6188872c))
* **tag-players:** add the players/visibility picker editor ([b8c7946](https://github.com/spockey4711/hockey-video-analysis/commit/b8c7946b7eea568163025f31861c93784a1f3e67))
* **tag-players:** link players to a tag and set visibility (P0-7) ([034d0aa](https://github.com/spockey4711/hockey-video-analysis/commit/034d0aaba31fdadc650df3a79acf45ba19315199))
* **tag-players:** link players to a tag and set visibility (P0-7) ([ecfa9c1](https://github.com/spockey4711/hockey-video-analysis/commit/ecfa9c1f0a18a8234e5c99310f2b8afff1eac0c3))
* **tag-players:** players/visibility picker completes P0-7 ([a15d0ad](https://github.com/spockey4711/hockey-video-analysis/commit/a15d0ad6f57a12fa3f06755c11cfae19eb3f1354))
* **tag-types:** add configurable tag-type module ([7fb37ec](https://github.com/spockey4711/hockey-video-analysis/commit/7fb37ec5ba022c7ab1849f26827ac5372cc5fcc0))
* **tagging:** capture tags by hotkey and persist via POST /api/tags ([f905526](https://github.com/spockey4711/hockey-video-analysis/commit/f905526fb1f9c524b1277568c12825a5677fc80d))
* **tagging:** mount HotkeyTagger into the watch page tagging slot ([cd8fc53](https://github.com/spockey4711/hockey-video-analysis/commit/cd8fc53a9eab38680918ab4635e5a07618b1da54))
* **tagging:** mount HotkeyTagger into the watch page tagging slot ([f84baa5](https://github.com/spockey4711/hockey-video-analysis/commit/f84baa56636260a40b0335072bbfe4ef3a401c8e))
* **tagging:** move tag capture into the transport bar ([a0b328d](https://github.com/spockey4711/hockey-video-analysis/commit/a0b328d9a12c9474879a922a8005081915f9509b))
* **tagging:** wire the players/visibility picker into the tag list ([a3bb8c3](https://github.com/spockey4711/hockey-video-analysis/commit/a3bb8c3bf639f38c58ff373d406a06556e268949))
* **time-mapping:** add global game-time mapping utility ([8dd96c6](https://github.com/spockey4711/hockey-video-analysis/commit/8dd96c6c96299dcba558ae24ba44c0c0f8c51c59))
* **time-mapping:** global game-time mapping utility (P0-4) ([584dd59](https://github.com/spockey4711/hockey-video-analysis/commit/584dd59a73fd9f40f2a7bdfc18816b2a8b626127))
* **time-mapping:** split a game-time window across chapter boundaries ([e150fa5](https://github.com/spockey4711/hockey-video-analysis/commit/e150fa5615f32e50f83cf08fb3152abff980a953))
* **ui:** add core primitives Card and Icon ([c3360ae](https://github.com/spockey4711/hockey-video-analysis/commit/c3360aef56e347696e53ef4b0ff47fa01f0415bb))
* **ui:** add domain-component helpers and tag-type config ([1994265](https://github.com/spockey4711/hockey-video-analysis/commit/199426517381ccc568b904af35dd5361547fd199))
* **ui:** add form primitives Button, IconButton, Input, Select, Switch ([5c28669](https://github.com/spockey4711/hockey-video-analysis/commit/5c286697a3c5f5ab03ffe50c1e56ce810fd9a6cf))
* **ui:** build TagChip, StatusBadge, Timecode, PlayerChip, Kbd ([3dbf701](https://github.com/spockey4711/hockey-video-analysis/commit/3dbf7011b094dd69e4c4d0f36e0370f6b7a10d14))
* **ui:** DS-2 design-system primitive components ([7829a12](https://github.com/spockey4711/hockey-video-analysis/commit/7829a12720c976b21d8d6a0a905ddef3a7fc0bdd))
* **ui:** DS-3 domain components (TagChip, StatusBadge, Timecode, PlayerChip, Kbd) ([5efca14](https://github.com/spockey4711/hockey-video-analysis/commit/5efca14813b7d978205ed76a9a935e1ff9c2e4c0))
* **watch:** add ClipBoard panel to enqueue clips and show cut status ([9487602](https://github.com/spockey4711/hockey-video-analysis/commit/94876021b43bbd170419bb9f6d7b9c8436d64a98))
* **watch:** add presentational watch-layout components ([6e66ca4](https://github.com/spockey4711/hockey-video-analysis/commit/6e66ca42f962c09e654d2907b857e6d12c5eed53))
* **watch:** add top-bar clip-cut action with shared clip state ([0915232](https://github.com/spockey4711/hockey-video-analysis/commit/0915232504f5dc4b8483f986f56c9c07d9a4201b))
* **watch:** add workspace grid frame and left rail ([b746284](https://github.com/spockey4711/hockey-video-analysis/commit/b746284e365144cca79848b578d07736149697a3))
* **watch:** build the right tags rail with an inline detail panel ([4262e4b](https://github.com/spockey4711/hockey-video-analysis/commit/4262e4baaf3c3f0b63ea7cf4fa80e77894b0f613))
* **watch:** clip creation and cut-status in the watch page (P2-1) ([4293667](https://github.com/spockey4711/hockey-video-analysis/commit/429366726a9849546b21795c20d1e548b42e6064))
* **watch:** coherent watch-page layout with keyboard hints (UX-6) ([6ea9840](https://github.com/spockey4711/hockey-video-analysis/commit/6ea984039eef52f982306a75e3c38daed8bd79cc))
* **watch:** compose watch page from layout components ([d03efa2](https://github.com/spockey4711/hockey-video-analysis/commit/d03efa22ff142c6057dd37f6ebdab1fbb8b78ca2))
* **watch:** drive timeline markers and clock by quarters, not videos ([32ac2ad](https://github.com/spockey4711/hockey-video-analysis/commit/32ac2aded69e9cf78f642ee836e14eff92371b46))
* **watch:** drive timeline markers and clock by quarters, not videos ([922600b](https://github.com/spockey4711/hockey-video-analysis/commit/922600b66a9b9643e8d76fe9883bd42fd310a1d3))
* **watch:** drop global chrome on the immersive watch route ([2d9e8ca](https://github.com/spockey4711/hockey-video-analysis/commit/2d9e8ca29711b4548357aa2c333374716d8d9443))
* **watch:** mount the clip board and record P2-1 ([1d24c9a](https://github.com/spockey4711/hockey-video-analysis/commit/1d24c9abf1244208fd7cd4dbc3d8c753d9f71f04))
* **watch:** rebuild the watch screen as the broadcast HUD workspace ([e149dbb](https://github.com/spockey4711/hockey-video-analysis/commit/e149dbb31587b6b6c834ad468e7e474f72a4a07f))
* **watch:** recompose watch page into the broadcast HUD workspace ([89d4020](https://github.com/spockey4711/hockey-video-analysis/commit/89d4020dfbee4d7a7f02eaa0c83aabe0bba19e13))


### Bug Fixes

* **a11y:** add --danger-strong fill so danger button clears AA (UX-8 A2) ([a2aca27](https://github.com/spockey4711/hockey-video-analysis/commit/a2aca27251ee2053a36be8856023f008d1d895aa))
* **a11y:** keep focus visible under forced-colors mode (UX-8 A3) ([2238be0](https://github.com/spockey4711/hockey-video-analysis/commit/2238be0a861e48a65a99aa8c5c3087fe0e1dc828))
* **a11y:** lighten --ink-400 so muted text clears AA (UX-8 A1) ([01e6dff](https://github.com/spockey4711/hockey-video-analysis/commit/01e6dff0eda09dd01afc1ea6c3a36eaf9d73908b))
* **a11y:** resolve UX-8 accessibility findings A1-A5 ([34f8c9f](https://github.com/spockey4711/hockey-video-analysis/commit/34f8c9fd36b5e3fa5bee33a1110b6026fedf8b54))
* **a11y:** round card-link focus ring to match card radius (UX-8 A4) ([7996ca4](https://github.com/spockey4711/hockey-video-analysis/commit/7996ca4922b59b71b5dcf710566b2fadbd8074e6))
* **ci:** track .env.schema so check-env actually validates ([771c379](https://github.com/spockey4711/hockey-video-analysis/commit/771c37905ff14f13b6514595b78524f8100ed6e8))
* **ci:** track .env.schema so check-env actually validates ([cbb84f8](https://github.com/spockey4711/hockey-video-analysis/commit/cbb84f8d66ec9e973dc8379bcdc8432f43b6951a))
* **ci:** unblock install and secret-scan gates on the scaffold ([cf530e1](https://github.com/spockey4711/hockey-video-analysis/commit/cf530e1c8eb3f46fca011d77fd638083d9950c3e))
* **ci:** unblock the install and secret-scan gates on the scaffold ([9a95e03](https://github.com/spockey4711/hockey-video-analysis/commit/9a95e037c80bebd238255eb3905b40bf6ab33854))
* **db:** connect lazily so next build works without a database ([ad34794](https://github.com/spockey4711/hockey-video-analysis/commit/ad3479484686390e1f480d93515b0887447568b2))
* **db:** connect lazily so next build works without a database ([3651a6f](https://github.com/spockey4711/hockey-video-analysis/commit/3651a6fc96c506afb99f980b92c878e73772188f))
* **design:** resolve UX-8 token findings T1/T2/T3 ([9beaf75](https://github.com/spockey4711/hockey-video-analysis/commit/9beaf757b527b31a8d0590b0dae861dfdf22b17f))
* **design:** resolve UX-8 token findings T1/T2/T3 ([9d4e0ab](https://github.com/spockey4711/hockey-video-analysis/commit/9d4e0ab06a72cd74c72bcea016db13a11d8fa5f4))
* **lint:** repair toolchain broken by TS7 and ESLint 10 ([6596c94](https://github.com/spockey4711/hockey-video-analysis/commit/6596c94f4a98529db78ffcd3a14367d90e00eac9))
* **lint:** repair toolchain broken by TS7 and ESLint 10 ([02203c3](https://github.com/spockey4711/hockey-video-analysis/commit/02203c30c8fada10292ac850731d310632b535b5))
* **player:** own video src imperatively so remount reliably reloads ([ecaffce](https://github.com/spockey4711/hockey-video-analysis/commit/ecaffce663ab27f7549181b026065ae5474a9ad3))
* **player:** own video src imperatively so remount reliably reloads ([338dadf](https://github.com/spockey4711/hockey-video-analysis/commit/338dadf2412061177a6a6dc02f6d26eb6089ba32))
* **player:** raise video-overlay contrast with broadcast scrim tokens ([0d1901a](https://github.com/spockey4711/hockey-video-analysis/commit/0d1901ab0d852e6519f73b55f3c1a8762bec41fb))
* **player:** raise video-overlay contrast with broadcast scrim tokens ([c33a163](https://github.com/spockey4711/hockey-video-analysis/commit/c33a163b31723c60e1d534835096c1354156b7c3))
* **player:** scale watch video to fill frame on large screens ([f5c2711](https://github.com/spockey4711/hockey-video-analysis/commit/f5c2711f85164fb57794cba958d8e3e7c93f70a8))
* **player:** scale watch video to fill frame on large screens ([1ba2736](https://github.com/spockey4711/hockey-video-analysis/commit/1ba2736f364104b1b48c324b0392fb680c21948a))
* **player:** stream game chapters via preload=metadata ([0c4a2ee](https://github.com/spockey4711/hockey-video-analysis/commit/0c4a2eece4ebc5cc1c7d1a407bbfc339cd2fe578))
* **player:** stream game chapters via preload=metadata ([8e0ceb2](https://github.com/spockey4711/hockey-video-analysis/commit/8e0ceb239e02658810f29325f9e659be59950784))
* **player:** widen watch sidebar slot to content width ([563f67f](https://github.com/spockey4711/hockey-video-analysis/commit/563f67fca665e8b4dd44038eb314c6004941c455))
* **shell:** build theme script from static source (CodeQL) ([98f2210](https://github.com/spockey4711/hockey-video-analysis/commit/98f221022c6dd20a9e9c45a7b35d41ac8a25b8aa))
* **shell:** stop coach header lingering over immersive player on client nav ([c9c1aef](https://github.com/spockey4711/hockey-video-analysis/commit/c9c1aef639a585863ee856d89d5b45190992ac95))
* **shell:** stop coach header lingering over immersive player on client nav ([e4a9c09](https://github.com/spockey4711/hockey-video-analysis/commit/e4a9c0986736092971e7908d745ec2a2c5c2c7ec))
* **styles:** order webfont [@import](https://github.com/import) before Tailwind so CSS parses ([9a94a71](https://github.com/spockey4711/hockey-video-analysis/commit/9a94a71140ba957a562036a4ceaa614c8f79a24a))
* **styles:** order webfont [@import](https://github.com/import) before Tailwind so CSS parses ([9b1162e](https://github.com/spockey4711/hockey-video-analysis/commit/9b1162efda14bf0ee77c1fbc43c57755878a93c9))
* **styles:** stop Tailwind scanning public/ (dev-server OOM freeze) ([dcec99e](https://github.com/spockey4711/hockey-video-analysis/commit/dcec99e6a77ea6b1a6f6de1fe8775488be739975))
* **styles:** stop Tailwind scanning public/ (dev-server OOM freeze) ([e3712d4](https://github.com/spockey4711/hockey-video-analysis/commit/e3712d41155abb621485e7f8b1a12ff2c1d0daf7))
* **watch:** dismiss timeline disclosure on outside click or Escape ([60745fe](https://github.com/spockey4711/hockey-video-analysis/commit/60745fec8d672b50b8b82fc71177ea8bd46801dd))
* **watch:** dismiss timeline disclosure on outside click or Escape ([988e63f](https://github.com/spockey4711/hockey-video-analysis/commit/988e63fc93184d14c42b1e2c2c5890ddb747b79a))


### Performance Improvements

* **player:** release the video decoder on unmount ([ce0c00f](https://github.com/spockey4711/hockey-video-analysis/commit/ce0c00f80e359d795c2ef0cbb2bb45818b5548cd))

## [Unreleased]

- Harden CI security and clear the remaining `Security` workflow failures. Pin every GitHub Actions
  `uses:` reference across the workflows to a full commit SHA (with a version comment), so a mutable
  tag cannot be silently repointed in a supply-chain attack (semgrep `github-actions-mutable-action-tag`);
  add a 7-day `cooldown` to both `dependabot.yml` ecosystems so a freshly published version is not
  proposed before a bad release is likely yanked (`dependabot-missing-cooldown`); and extend the pnpm
  `overrides` to bump `postcss@8.4.31` (GHSA-qx2v-qp2m-jg93, pinned by `next`) up to the `8.5.x` line
  that `tailwindcss` already resolves, clearing the dependency-review finding.
- Fix the two CI checks that blocked the first `develop` -> `master` release PR. (1) Dependency
  review flagged `esbuild@0.18.20` (GHSA-67mh-4wv8-2f99, a dev-server-only advisory) pulled in
  transitively by `drizzle-kit`'s legacy `@esbuild-kit/esm-loader`; a pnpm `overrides` entry in
  `pnpm-workspace.yaml` bumps it to a patched line, verified not to affect `drizzle-kit generate`.
  (2) Per-commit commitlint can never pass on a release PR because the aggregated `develop` history
  predates Conventional-Commits enforcement, so `commit-checks.yml` now skips the commitlint job for
  PRs targeting `master` (the PR-title check still runs).
- Fix the coach top bar lingering over the immersive watch/tagging player when it is reached by
  in-app navigation, which pushed the full-viewport HUD into a permanent one-header-tall scroll. The
  bar's per-route visibility lived in the root-layout `AppShell`, a server component Next.js does not
  re-render on client navigation, so the check froze on the first-loaded route. The decision moves to
  a small client boundary (`CoachHeader`) that reads the live `usePathname`; the header is still built
  server-side and handed in as children, so its session/db imports stay off the client bundle. The now
  unused `x-pathname` middleware header and `PATHNAME_HEADER` constant are removed.
- Redesign the coach landing page (`src/app/page.tsx`, `src/features/home/**`) for both audiences
  who reach it. The signed-out page led with a headline and a flat 3-up feature grid; it now opens
  with a demo game-timeline hero - the product's core artefact - so a first-time visitor sees what
  the app does at a glance:
  - `GameTimeline.tsx` renders a mock 48-minute game as a monospace timecode ruler over four quarter
    segments, with colour-coded tag markers (Tor/Ecke/Aktion gut/schlecht + the AI whistle hint,
    reusing the `--tag-*` tokens and `TagChip`) that pop in on load. The entrance is pure CSS (the
    `home-tag-marker` rule in `globals.css`), so the component stays a server component and honours
    `prefers-reduced-motion`. The marker geometry is a tested pure module (`timeline.ts`).
  - `HowItWorks.tsx` lays out the pipeline as a numbered sequence (Aufnehmen -> Taggen -> Schneiden
    -> Teilen); `AudiencePaths.tsx` splits the two ways in - a coach signs in, a player opens a
    login-free share link and can jump to the flow.
  - The signed-in view keeps the greeting and "Zu den Spielen" and adds `QuickActions.tsx` (Neues
    Spiel, Kader, Sammlungen) above the recent-games peek. The retired feature-card copy is dropped
    from `content.ts`.
- Add a coach settings page at `/settings`, reachable from the primary nav (P2-15).
  A first slim cut: an Account section showing the signed-in coach's name and
  email (read-only), a change-password form that verifies the current password,
  enforces the shared 8-character minimum, confirms the new one, then re-hashes
  and rotates every session so other devices are signed out while the current
  device stays logged in, an Appearance section wrapping the existing header
  `ThemeToggle`, and a sign-out control. Composition over the existing
  `lib/auth` password/session helpers; no schema change. New
  `src/features/settings/**` and `src/app/settings/**`.
- Remove the top-left REC readout from the video frame
  (`src/features/player/PlayerVideoFrame.tsx`). The pulsing dot plus chapter file name implied a
  live recording (nothing is being recorded) and the file name carries no meaning for the coach.
  The now-unused display copy is gone with it: the `chapterFallback` string
  (`src/features/player/content.ts`). The `PlayerSource.label` file basename stays, as it now
  feeds the timeline's recording-break detection (`src/features/player/source-breaks.ts`).
- Drive the watch timeline and clock by the manually marked quarters instead of
  the imported video files (P1-4). Previously the timeline labelled one lane per
  chapter file (`V1..Vn` from `chapters.ts`) and the clock read the raw offset
  into the stitched recording, so the `V` markers followed the GoPro splits, not
  the match. Now:
  - The `V1..V4` labels above the track come from the marked quarters
    (`src/features/quarters/overlay/QuarterTimelineLabels.tsx`, filling the new
    `timelineLabels` slot). `chapters.ts`/`chapterLanes` is retired.
  - The chapter files no longer draw anything on the timeline; only a genuine
    recording cut - a new GoPro recording that does not continue the previous
    file - shows as a break tick, detected from the GoPro chapter naming
    convention (`src/features/player/source-breaks.ts`; chapters of one recording
    share the trailing file number).
  - The game clock reads match time: it starts at `0:00` at the first quarter and
    `15:00` at the second, running the raw time on outside any quarter
    (`src/features/quarters/clock.ts`). It is supplied to the transport,
    video-frame corner and top bar through a client `ClockFormatProvider`
    (`src/features/player/ClockFormatContext.tsx`) wrapped by
    `QuarterClockProvider`, so the player stays decoupled from the quarter lane.
- Dismiss the timeline disclosure panels (quarter editor, jump-marker nav) with a click anywhere
  outside them or with Escape (`src/components/watch/TimelineDisclosure.tsx`). The native
  `<details>` chip previously only closed on a second click of its own trigger, so a coach who
  opened the quarter editor to set start times had to hunt back to the chip to close it. The
  component now clears `open` on an outside pointer press or Escape without unmounting the panel,
  so the jump-marker hotkeys stay live while collapsed.
- Drop the redundant "Marker" timeline disclosure from the watch screen
  (`src/app/games/[id]/watch/page.tsx`). The tag/jump-marker nav below the timeline duplicated the
  right-hand tags rail (`src/components/watch/WatchTagsRail.tsx`), which already lists, edits and
  navigates the same tags. Only the quarter ("Viertel") disclosure remains in the timeline controls;
  the live markers still ride the timeline overlay (`LiveJumpMarkerTrack`).
- Fix low-contrast video-corner overlays (`src/features/player/PlayerVideoFrame.tsx`). The REC
  readout and large game clock rendered near-black text (`--text-inverse`, which is dark in the dark
  theme) on a faint `--scrim` (40% opacity), so both were nearly unreadable over the bright pitch.
  The video frame is a fixed broadcast surface, so its chrome now uses a new theme-independent pair,
  `--video-scrim` (a strong dark scrim) + `--video-ink` (light ink), in `src/styles/tokens/colors.css`;
  the paused and buffering states use the same pair.
- Scale the watch/tagging video to fill its frame on large screens
  (`src/features/player/PlayerVideoFrame.tsx`). The `<video>` carried only
  `max-h-full max-w-full`, which caps but never grows the element, so on wide
  displays it rendered at the proxy's intrinsic resolution and left a border of
  unused space on every side. It now uses `h-full w-full object-contain`, so the
  frame scales up to fill the available area while preserving aspect ratio (the
  pitch backdrop still shows through any letterbox bars).
- Rebuild the watch/tagging screen as the broadcast-HUD workspace (P2-8, the reference design
  system). The screen was a centered document column under the global nav - a small video, oversized
  tag-legend buttons and a right sidebar of stacked cards that could not be worked without scrolling.
  It is now a full-viewport HUD on the design system's layout-rail tokens (`--rail-w`/`--topbar-h`/
  `--timeline-h`/`--sidebar-w`): a left icon rail (`src/components/watch/WatchRail.tsx`), a top bar
  with the game title, live chapter readout and an "N Clips schneiden" action
  (`WatchTopBar.tsx`/`WatchClipCutButton.tsx`), a full-bleed pitch video with REC and large-clock
  overlays, a transport bar with the tag-capture buttons inline
  (`src/features/tagging/TransportTagButtons.tsx`), a full-width chapter timeline
  (`src/features/player/PlayerTimeline.tsx`, lanes from `chapters.ts`) carrying the quarter bands and
  tag ticks, and a right tags rail with a selectable list and a pinned detail panel
  (`WatchTagsRail.tsx`/`TagDetail.tsx`) for edit, player assignment and clip cutting. The player is
  decomposed into placed regions (`PlayerVideoFrame`/`PlayerTransport`/`PlayerTimeline`) laid out by
  `PlayerWorkspace`, all under one controller; tag capture moves to a shared `useTagCapture` hook and
  clip state to a shared `ClipBoardProvider`. The immersive route drops the global `AppHeader` via a
  middleware `x-pathname` header read in `AppShell` (`src/components/shell/immersive-routes.ts`). The
  superseded `HotkeyHints`, `ClipBoard`, `TaggingPanel` and `TagList` are retired.
- Pitch-green video backdrop (P2-8 G9, `src/features/player/ContinuousPlayer.tsx`). The player video
  area was a flat `--surface-inset` well; it now carries the branded "pitch" the design system
  specifies - a `radial-gradient` turf field under faint vertical mown stripes, taken verbatim from
  the design project's player mockup. The colors are new tokens in `src/styles/tokens/colors.css`
  (`--pitch-core`/`--pitch-edge`/`--pitch-stripe`) composed into a single `--video-backdrop`
  background-image, applied via `bg-[image:var(--video-backdrop)]` on both the player frame and the
  `<video>` element so the pitch shows through the letterbox bars and while a chapter loads. Shared
  across themes - the video frame is a fixed broadcast surface, not a themed workspace surface.
- Token-correct caps letter-spacing on the home labels (P2-8 G7). The hero eyebrow
  (`src/app/page.tsx`) and the recent-games heading (`src/features/home/RecentGamesPeek.tsx`) swap
  Tailwind's built-in `tracking-widest`/`tracking-wide` for the design scale's `--ls-caps` (0.12em),
  so the two uppercase HUD labels track identically to the token-correct captions elsewhere (`Input`,
  `HotkeyHints`, `PanelHeader`) instead of drifting subtly off.
- Fix the watch player needing a manual reload before the video appears
  (`src/features/player/use-continuous-playback.ts`,
  `src/features/player/ContinuousPlayer.tsx`). The chapter `src` was set through a
  React-controlled JSX prop while the decoder-teardown effect stripped that same
  attribute imperatively on unmount. Under React Strict Mode's dev double-mount the
  teardown ran between the two mounts, leaving the `<video>` source-less; because React
  still believed the unchanged `src` prop was applied, it never re-set the attribute on
  remount, so the frame stayed blank until a hard reload (and the aborted load surfaced as
  an `AbortError`). The hook now owns `src` imperatively in the same effect as the
  teardown, keeping React's virtual DOM in sync so any remount - Strict Mode or a real
  chapter swap - reliably reloads.
- Shared empty-state block (P2-8 G6, `src/components/core/EmptyState.tsx`). An `EmptyState` primitive
  (`icon`, `title`, optional `hint`, optional `action`) replaces the single line of `--text-muted`
  body copy that the games list, recent-games peek, watch no-video region and clip board each
  hand-rolled. It pairs a Lucide glyph in a raised chip with a short title at the AA-safe
  `--text-secondary` rung (the G6 audit note), a one-line hint and an optional primary action, and
  carries no surface of its own so each screen keeps its existing frame. The four empty-copy strings
  move to structured `{ title, hint }` shapes in their content modules.
- Shared panel header (P2-8 G4, `src/components/core/PanelHeader.tsx`). A `PanelHeader` primitive
  (`title`, optional `hint`, optional `action` slot for trailing controls) captures the one
  HUD-caption treatment - `--fs-caption`, `--fw-semibold`, `--ls-caps` small-caps over a muted hint -
  that the seven `Card panel` workspace sections (clip board, hotkey hints, quarter editor, hotkey
  tagger, tag list, suggestion review, jump-marker nav) each hand-rolled inline. Every panel now
  renders its header through it, so the caption scale and tracking can no longer drift between panels
  (some had crept to `h3`/`--fs-micro`), and the jump-marker nav's prev/next controls move into the
  shared `action` slot.
- One panel contract for workspace surfaces (P2-8 G3 + G5, `src/components/core/Card.tsx`). The `Card`
  primitive gains a `panel` variant - the raised treatment (`--surface-raised`, tighter `--radius-md`,
  full `--border`) plus a deliberate `--shadow-md` so a panel reads as floating above the workspace -
  and an `as` prop so a panel can still render as a labelled `<section>` landmark. The seven
  hand-rolled workspace sections (clip board, hotkey hints, quarter editor, hotkey tagger, tag list,
  suggestion review, jump-marker nav) now share this one contract instead of each re-declaring the
  radius/border/surface tokens, so the watch sidebar and the games list read as the same system and
  the previously dead `--shadow-md` elevation step is put to use.
- Clip collections / playlists (P2-13, `src/features/share/collections/**`, `drizzle/**`). A coach can
  curate a named collection ("Standards Woche 3") from ready clips and share each via its own secret,
  login-free link, reusing the same nav-free `ShareShell` and `PlaylistPlayer` as the team and
  per-player links. A new `Sammlungen` section lists collections and lets the coach create one; the
  detail page renames it, ticks which ready clips it holds (both `team` and player-specific `single`
  clips, the latter flagged), and copies, rotates or deletes its secret link. This is a post-MVP
  schema addition - the P0-1 freeze covered only the MVP waves - adding `collections` and
  `collection_clips` (migration `0001_clip_collections`), each collection carrying its own
  `share_token`. Membership is intersected with the ready-clip set server-side, so a share link can
  never reach a clip that is not cut yet, and the share query joins strictly through this collection's
  membership so one link can never leak another collection's clips.
- Drop-a-folder game ingest (P2-9, `src/app/api/ingest/**`, `src/features/games/**`). A coach drops
  the raw recording into a watched folder; the `hockey-video-pipeline` stitches the ordered GoPro
  chapter files and then registers the assembled game via `POST /api/ingest`, so it appears in the
  portal automatically with only the title left to fill in. The endpoint is machine-to-machine, so
  it authenticates with a new server-only `INGEST_TOKEN` (`Authorization: Bearer <token>`,
  SHA-256 constant-time compare, unset disables the endpoint entirely) rather than a coach session.
  The JSON body is validated at the boundary (`parseIngestGame`): an optional `playedOn`
  (`YYYY-MM-DD` recording date from the files' metadata) and an ordered, non-empty `sources` array
  of `{ filePath, durationS }` chapters within the source-count cap, with a specific error naming
  the offending field. A valid call auto-creates a `games` row plus ordered `game_sources` in one
  transaction, left in a needs-a-name state - empty title, no opponent, no coach author (`createdBy`
  null) - and returns `201 { id, status: "needs_name" }`. **No whistle processing runs in this
  flow** (per the backlog scope note). The games list surfaces an unnamed game with an
  `Unbenanntes Spiel` placeholder and a `Name fehlt` badge, routing its card to a new coach-only
  `/games/[id]/edit` naming screen (`RenameGameForm` + `renameGameAction`) instead of the watch
  view; the rename path also corrects any existing title. The empty-title convention is centralized
  in `isUnnamedGame`, so the frozen schema needs no new column.
- `Heading` core primitive that gives every page heading the Saira display face
  (`src/components/core/Heading.tsx`, P2-8 / design-gap findings G1 + G2 + G8). It applies the
  display family, `--ls-tight` tracking and the `--lh-heading` line-height in one place, and
  separates the visual `size` (`display` for the marketing hero, `page` for the shared page-title
  size, `sub` for card/row sub-headings) from the semantic `level` so titles look consistent
  without distorting the document outline. The six heading sites (home hero, watch, share, games,
  roster, player row) now render through it, so headings finally read in the athletic display voice
  instead of the body font. Retires the undefined `--fs-heading` token that had been silently
  dropping the Games and Roster titles to body size; both now use the shared page-title size.
- Lighter in-browser tagging player (P2-6, `src/features/player/**`). The watch player now prefers a
  downscaled proxy rendition when `MEDIA_PROXY_BASE_URL` is set, so the browser decodes and buffers a
  fraction of the bytes a full-resolution game costs; full resolution stays server-side for clip
  cutting. Proxies are resolved by URL convention (same relative path as the chapter, duration
  preserved) with no `game_sources` schema change, and fall back to `MEDIA_BASE_URL` when unset. The
  player also releases the video decoder and buffered bytes on unmount instead of waiting on GC.
  Documented in [ADR 0006](docs/decisions/0006-proxy-rendition-for-in-browser-tagging.md), with a
  before/after RAM/CPU [measurement runbook](docs/ops/measuring-player-footprint.md); true
  forward-buffer capping (MSE/segmented media) is deferred.
- Design-quality gap audit for the reference design system (P2-8,
  `docs/design/design-gap-audit.md`). Scopes, screen by screen, where the shipped UI is rougher than
  the documented design system: the Saira display font never reaches page headings (G1), an undefined
  `--fs-heading` token drops the Games and Roster titles to body size (G2), two competing panel
  treatments and an underused elevation ramp flatten the workspace (G3/G5), and empty states are bare
  muted text (G6). Records the findings with per-site references and a prioritized list of scoped
  follow-up PRs by owning lane; the fixes themselves land separately. Docs only - no code change.
- Coach quick-start guide (P2-5, `docs/project/coach-guide.md`). A short, user-facing
  walkthrough of the whole workflow - sign in, reference a game's chapter files, tag live with
  hotkeys, confirm whistle suggestions, cut and share clips, and rotate or revoke a share link -
  naming each German on-screen label so a coach can follow it. Docs only.
- Clean light theme alongside the dark default, with a coach-facing toggle (P2-14). The token layer
  (`src/styles/tokens/colors.css`) now carries a light `paper` neutral scale and restates only the
  semantic aliases under `:root[data-theme="light"]`, so every component that references the aliases
  (`--surface`, `--text-primary`, `--border`, ...) gets both themes for free with no raw hex in JSX.
  Shadows are composed from theme-driven knobs (`--shadow-rgb`, `--shadow-strength`) in `effects.css`
  so the light theme gets soft slate elevation instead of muddy black. A header `ThemeToggle`
  (`src/components/shell/`) flips `data-theme` on `<html>` and persists the choice to `localStorage`;
  a blocking `ThemeScript` (first in `<body>`) applies the stored choice (or the OS
  `prefers-color-scheme`) before first paint, so there is no flash of the wrong theme on load. `color-scheme` follows the
  active theme so native controls and scrollbars match.
- Playback transport controls on the watch player (P2-7,
  `src/features/player/**`, `src/components/watch/**`). The coach now scrubs to a moment
  without leaving the keyboard: play/pause (`Space`), skip 10s (`Left`/`Right`), a
  frame/second step that pauses on a still frame (`Shift+Left`/`Shift+Right`), and a 1x/2x/4x
  scan-speed control (`Up`/`Down` or the on-screen button). A centred badge now marks a clear
  paused state over the frame. Composed on the existing continuous-playback controller over the
  global game-time mapping - no new time-mapping logic; the scan speed is re-applied across
  chapter boundaries, which reset the `<video>` element to 1x.
- Clip creation and cut-status in the watch page
  (`src/components/watch/ClipBoard.tsx`, `src/components/watch/clip-board.ts`, P2-1). The watch
  player's sidebar gains a clip board: each captured tag gets a control that enqueues a cut job
  through `POST /api/clips` and a status pill (pending/processing/ready/failed via `StatusBadge`)
  read back from `GET /api/clips?gameId=`. It reads the live tag store, so a moment tagged this
  session appears at once, and polls while any cut is in flight so the worker's progress surfaces
  without a reload. The enqueue reuses the route's idempotent guard - a tag with a live clip shows
  its status instead of a duplicate cut, and a failed clip can be re-cut. This closes the gap where
  the product could tag but not turn a tag into a shareable clip. No schema or route change.
- Surface the team share link to the coach (P2-4). The team clip view is reached by an
  unguessable token held in the server-only `TEAM_SHARE_TOKEN` env, but the coach had no way to
  copy it and would have to hand-build the `/share/team/<token>` URL. A new coach-only
  `TeamShareLink` surface (`src/features/share/team/TeamShareLink.tsx`) reads the token server-side
  and reuses `ShareLinkField` to render a copyable link, mounted above the roster on `/players`.
  The raw token never enters the client bundle beyond the assembled URL the coach copies; when
  `TEAM_SHARE_TOKEN` is unset the surface explains the team view is disabled instead of showing a
  dead link.
- Stop Tailwind from scanning `public/`, which froze the dev server
  (`src/styles/globals.css`). Tailwind v4's automatic source detection walked the served-assets
  directory, and in local dev `public/` commonly holds a symlink to a large media library (game
  recordings served straight from `public/` when no media base URL is set). The oxide scanner
  followed that symlink and read multi-GB video files hunting for class names, exhausting RAM until
  the Turbopack PostCSS worker was OOM-killed - which surfaced as a misleading
  `Failed to write app endpoint /page ... PostCssTransformedAsset ... unexpected end of file` panic.
  Adding `@source not "../../public"` scopes detection to real templates; `globals.css` now compiles
  in ~60 ms instead of hanging, with byte-identical output (`public/` has no class-name candidates).
- Stream full-game chapters instead of buffering them whole
  (`src/features/player/ContinuousPlayer.tsx`). The continuous player's `<video>` used
  `preload="auto"`, so the browser eagerly downloaded the entire active chapter (a multi-GB
  full-game recording) into memory on load, which could exhaust RAM and, in local dev where
  chapters are served from `public/`, starve the dev server until its Turbopack worker was
  OOM-killed. Switching to `preload="metadata"` fetches only duration/size up front and streams
  byte-ranges on demand; seeking and scrubbing keep working via HTTP range requests.
- Add the `P2` backlog section: wire the built features into one usable coach product
  (`docs/project/backlog.md`). A code audit found that several W1-W6 deliverables landed as
  API-only or as unmounted components, so the end-to-end flow (tag -> cut clip -> share link) is not
  yet clickable: no client component calls `/api/clips` (no cut trigger or status view), the
  `SuggestionReview` panel is mounted nowhere, there is no comment UI, and the team share link has no
  coach-facing surface. P2-1..P2-5 capture the composition/wiring work plus a coach quick-start
  guide. Docs-only planning change.
- Archive the completed MVP backlog. Every DS/P0/P1/UX task shipped, so
  `docs/project/backlog.md` is moved to `docs/project/archive/backlog-mvp.md` (kept verbatim as the
  historical record, with an archived-on header) and a fresh, lean `docs/project/backlog.md` takes
  its place - a short status note plus the carried-forward "Later" (post-MVP) items to promote when
  the team picks them up. Docs-only; the `README.md` / `CLAUDE.md` pointers to
  `docs/project/backlog.md` still resolve.
- Live jump markers (`src/features/tagging/GameTagsProvider.tsx`,
  `src/features/player/jump-markers/LiveJumpMarkers.tsx`, P1-1 follow-up). The jump-marker overlay
  and nav now update the instant a tag is captured, edited or deleted in-session, no page reload.
  The watch page's live tag list is lifted into a shared `GameTagsProvider` (the single client
  source of truth): `TaggingPanel` drives it and the `LiveJumpMarkerNav`/`LiveJumpMarkerTrack`
  connectors derive their markers from the same list, so the tag list and the markers can no longer
  drift. Because the markers are just those tags projected, the redundant server `listJumpMarkers`
  query is dropped - the watch page's existing `listGameTags` load seeds the store. Refs: P1-1.
- VPS setup runbook for transitional single-server storage (`docs/ops/vps-setup.md`). A concrete,
  filled-in provisioning guide for running the whole app on one Ubuntu 24.04 VPS as a stopgap until
  the NAS arrives: the app server, PostgreSQL, and video files share a single 200 GB data disk
  mounted at `/srv/hockey` (with `db/` and `media/` kept as siblings so the later NAS migration is a
  mount swap, not a data rewrite). Covers the `yannik` sudo user and SSH hardening, ufw, the data
  disk (partition/format/fstab), Docker Compose with a production override, nginx + certbot serving
  both the app and `/media/` (autoindex off, `noindex` to protect the login-free share surfaces),
  nightly `pg_dump` backups, the `.env.production` checklist, and an 80% disk alert. This
  deliberately collapses the ADR 0003 roles onto one machine while keeping its one hard rule (the
  VPS only does `ffmpeg -c copy` cuts, no re-encoding). Linked from the README documentation list.
- Mark UX-8 (design QA token/a11y audit) complete in the backlog: all follow-up fix PRs in
  `docs/design/ux-audit.md` (A1-A5, T1-T3) have merged, so the "box stays open" caveat is dropped.
  Docs-only. Refs: UX-8.
- Roster surface for share-token rotation and player erasure (`src/app/players/`,
  `src/features/players/roster/`, `src/components/players/`, P1-6 UI). A coach-only page at
  `/players` (guarded, `noindex`, added to the primary nav as "Kader") lists every team player with
  their secret share link and a copy-to-clipboard control, and mounts the two P1-6 server actions
  per row as confirm-gated forms: rotating the share token (revoking the current link, then showing
  the fresh one) and erasing the player and their personal data. Each destructive control reveals a
  warning and the real submit button only on a first click rather than firing immediately, and the
  roster refreshes on success so a rotated link updates and an erased player disappears. The
  `useActionState` shape and seed moved out of the `"use server"` action modules into sibling
  `state.ts` files, since a server-action file may only export async functions. Refs: P1-6.
- Tag players/visibility picker (`src/features/tag-players/TagPlayersEditor`, P0-7, PRD 5.2). The
  coach-facing picker that completes P0-7: a per-tag inline editor in the watch sidebar's tag list
  (opened from a "Spieler" button) that sets a tag's visibility (`Team-weit` / `Einzeln`) and links
  the involved players, driving the existing `GET`/`PUT /api/tags/[id]/players` route - live data
  never touches the DB from the client. A new server-only `listRoster` feeds the checkbox list (the
  team-wide roster, ordered by jersey number then name, loaded server-side by the watch page and
  passed down through `TaggingPanel`); the editor loads a tag's current links on open and mirrors
  the server invariant, blocking a save of a `single` tag with no player (whose clip would reach no
  share link). The `tag-players` barrel is now client-safe (server queries import from `./queries`
  directly, matching the `player` feature's split). Refs: P0-7.
- Whistle-suggestion review (`src/features/suggestions/`, `src/app/api/suggestions/`, P1-5, PRD 5.3).
  The `hockey-video-pipeline` double-whistle detector reports candidate goal timestamps into
  `whistle_candidates`; this is the coach-only surface that reviews them, and it never auto-commits -
  a spectator whistle is a false positive, so every candidate waits on a coach decision. `GET
/api/suggestions?gameId=` lists a game's candidates in game-time order; `PATCH
/api/suggestions/[id]` applies one verdict. Confirming transitions the candidate `pending ->
confirmed` and, in the same transaction, commits a `goal` tag (`source = suggestion`, stamped with
  the reviewing coach) at the candidate's `at_s` using the goal type's default clip window - the pure
  `goalTagFromCandidate` does that window math and is unit-tested directly. Rejecting only marks the
  candidate `rejected`. The `status = pending` guard on the update makes confirm idempotent, so two
  racing confirms cannot both flip the row and only one goal tag is ever minted; an unknown decision
  is rejected before any query runs, a missing id maps to 404 and an already-reviewed one to 409.
  `SuggestionReview` is the client panel (jump-to-moment plus confirm/reject) a future watch-page
  mount places in the player sidebar. Refs: P1-5.
- Share-token rotation and player erasure (`src/features/access/rotation/`,
  `src/features/players/gdpr/`, P1-6, PRD s8). Two coach-only capabilities for the private team
  workspace, each a validated, guarded server action a future roster-admin surface mounts.
  Rotation (`rotateShareTokenAction`) writes a fresh 256-bit `players.share_token` over the old
  one; because a per-player secret link resolves by matching that value exactly, the previous
  link stops resolving the instant it is overwritten - that overwrite _is_ the revocation, the
  way to kill a leaked or stale link (collisions on the `unique` column are retried). Erasure
  (`deletePlayerAction` -> `deletePlayerWithData`) deletes a player together with their personal
  data in one transaction: their own sole-owned `single` tags first (cascading those tags' clips
  and links), then the player row (cascading its remaining team-tag links), returning a summary of
  what was removed. A `single` tag shared with another player is kept, and team tags/clips are team
  data and always stay, so erasing one player never strips a moment another may still see. The
  player id is UUID-validated before any query and a missing player is reported without confirming
  which ids exist. Refs: P1-6.
- Presentation mode for team sessions (`src/features/share/presentation/`, P1-8, PRD Phase 4). A
  `PresentationMode` button on both the team and per-player share links opens a fullscreen,
  distraction-free overlay that plays one large clip at a time with a prominent next button,
  previous/play-pause controls, and a
  `Clip n / N` position readout. It reuses the shared `PlaylistItem` contract and the pure playlist
  navigation, auto-advancing through the session and stopping on the last clip - so it stays as
  view-agnostic as the `PlaylistPlayer` it sits beside and never reaches past the resolved clip list
  on the login-free surface. Arrow keys step between clips and Escape closes; native fullscreen is a
  best-effort upgrade (thin, defensive wrappers) so the overlay still works where the Fullscreen API
  is unavailable. Refs: P1-8.
- Chapter-boundary clips (`src/lib/time-mapping/boundaries/`, `src/features/clips/boundary/`, P1-7,
  ADR 0002/0004, PRD s3 risk 2). A clip window is a single global game-time interval, so it can
  straddle the seam between two GoPro chapter files; the cut-worker copies each source stream
  separately (ADR 0004) and cannot span two files in one pass. The new pure `toSourceSegments`
  splits a global `[startS, endS]` window into the ordered per-chapter segments it covers - one per
  file it touches, sharing the half-open seam rule of `toSourcePoint` so a window ending exactly on
  a seam does not spill a zero-length segment into the next file - instead of clamping at the
  chapter edge and silently dropping the rest of the clip; `windowCrossesBoundary` is the flag-only
  convenience. On top of it, `planClipCut` layers the ordered `game_sources` file paths onto those
  segments to produce the per-file cut plan (`ClipCutPlan`) the worker copies and concatenates,
  reporting `spansBoundary` and per-cut lengths. Both are DB-free and unit-tested, and form the
  app-side of the mapping contract shared verbatim with the pipeline worker. Refs: P1-7.
- Per-player clip view via secret link (P0-11). A login-free `/share/player/<token>` page, keyed by
  the player's existing `players.share_token`, lists every ready clip that player may see - all
  `team`-visible clips plus that player's own `single` clips (those whose tag is linked to the player
  via `tag_players`) - as a playlist. The `single` set is scoped to the token's player, so no other
  player's private clips can appear, mirroring the reachability rule already enforced for clip
  comments. A token that resolves to no player 404s, so a leaked-but-wrong link never confirms which
  tokens exist. The page reuses the shared `PlaylistPlayer` (P0-10) inside the nav-free, `noindex`
  `ShareShell`, and builds its display-ready `PlaylistItem[]` (media URL + German labels) server-side
  in its own `src/features/share/player/` clip-items mapper. No schema or env change: the secret is
  the per-player `share_token`, not an env var. Refs: P0-11.
- Edit and delete tags after capture (`src/features/tagging/edit/`, `src/app/api/tags/[id]/`,
  P0-8). A new `tagging/edit` feature validates an untrusted `{ type, startS, endS }` body - `type`
  must be a configured tag-type key, `startS` non-negative, and an explicit `endS` must exceed it -
  and updates a tag's type and clip window in place, deletes a tag by id (its player links and cut
  clips cascade away), and lists a game's tags in start order to seed the UI. The coach-only
  `PATCH`/`DELETE /api/tags/[id]` route exposes it, mapping a missing tag to 404. The watch sidebar
  gains an editable tag list beside the hotkey legend: jump the timeline to a tag, retype it or
  re-stamp its window from the live game time, or delete it behind an inline confirm - and a fresh
  hotkey capture appears there immediately, since the panel owns the shared list state. Visibility
  and player links keep their own route (P0-7); their picker stays a follow-up. Refs: P0-8.
- Team clip view via secret link (P0-10). A login-free `/share/team/<token>` page lists every ready,
  team-visible clip (`clips.status = 'ready'` on a `team`-visibility tag) as a playlist, so no
  player-specific (`single`) clip can ever leak onto the team link. The schema (frozen since P0-1)
  has no team-wide token, so the single team link's secret lives in the server-only
  `TEAM_SHARE_TOKEN` env var (declared in `.env.schema`/`.env.example`); a wrong, missing or
  disabled token 404s via a constant-time (SHA-256) compare, so nothing confirms which tokens exist.
  The page renders inside the nav-free, `noindex` `ShareShell` (UX-7) and introduces the shared
  `PlaylistPlayer` (`src/features/share/playlist/`) - a view-agnostic client component fed a
  display-ready `PlaylistItem[]` (media URL + German labels built server-side) that auto-advances
  through the clips - which the per-player link (P0-11) reuses. Refs: P0-10.
- Comments on clips (`src/features/clips/comments/`, `src/app/api/clips/[id]/comments/`, P1-2, PRD
  5.6). A comment carries a free-text `author`, a `body`, and a server-set `created_at` on the
  existing `comments` table; validation trims both fields and rejects an empty or over-long value.
  `GET`/`POST /api/clips/[id]/comments` serve two audiences: a signed-in coach, or a login-free
  share-link viewer who passes a player `?shareToken=`. A share token is authorized against the clip
  (`canShareTokenReachClip`) - it reaches every `team`-visible clip but only those `single` clips
  whose tag is linked to that token's player, so a link never reads or writes comments beyond what it
  may see; an unknown or non-reaching token is a 401, which also hides whether the clip exists from a
  share viewer. `author` is free text because share-link writers have no coach account to reference.
  Refs: P1-2.
- Link players to a tag and set its visibility (P0-7). A new `tag-players` feature validates an
  untrusted `{ visibility, playerIds }` body - it dedupes player ids and requires a `single`
  (player-specific) tag to name at least one player, so a player-less `single` clip can never end up
  unreachable - and replaces a tag's whole player set plus visibility in one transaction. The
  coach-only `GET`/`PUT /api/tags/[id]/players` route exposes it, mapping a missing tag to 404 and an
  unknown player id to 400. Refs: P0-7.
- Enqueue clip cut jobs from confirmed tags and read their status
  (`src/features/clips/`, `src/app/api/clips/`, P0-9). Enqueuing inserts a
  `pending` row in `clips` - the DB-queue handoff to the hockey-video-pipeline
  worker (ADR 0003), which polls, cuts with `ffmpeg -c copy` (ADR 0004), and
  writes back `processing -> ready | failed` plus `output_path` on the same row;
  the app never calls the worker in-process. `POST /api/clips` (coach-only) is
  idempotent per tag: a tag with a live clip (`pending`/`processing`/`ready`)
  returns that clip (200) instead of queuing a duplicate cut, and only a prior
  `failed` attempt lets a fresh job be inserted (201) - an app-level guard since
  the frozen schema carries no unique constraint. `GET /api/clips?tagId=... |
?gameId=...` (coach-only) reads clip status back, per tag or as a game's
  cut-progress board joined with each source tag. Refs: P0-9.
- Add instant jump-marker mode to the watch player (`src/features/player/jump-markers/`, P1-1). The
  coach can jump between tagged moments the instant a game is loaded, with no dependency on the
  clip-cutting pipeline: markers come straight from the `tags` table (`listJumpMarkers`). Three
  affordances share one pure navigation core (`nextMarker`/`previousMarker`/`activeMarker`, a small
  `AT_MARKER_EPSILON_S` so repeated presses always step past the marker under the playhead):
  `JumpMarkerTrack` draws colour-coded ticks across the timeline (fills the player's `timelineOverlay`
  slot beside the quarter bands, `--tag-*` tokens matching each `TagChip`), and `JumpMarkerNav` (a
  sidebar panel) offers prev/next controls, the `,` / `.` hotkeys, and a clickable marker list with
  an `aria-live` announcement and active-marker highlight for keyboard-first coaches. German copy
  lives in a `jumpMarkersContent` layer; tokens only, no raw hex. The watch page loads markers
  server-side and mounts both into the player's typed slots. Unit-tested (navigation math, colour
  map) and component-tested (list, seek-on-click, hotkey jumps, editable-target guard, empty state).
  Follow-up: markers refresh on page load, not yet live as new tags are captured in-session. Refs:
  P1-1.
- Resolve the UX-8 accessibility findings (A1-A5) in one pass. **A1:** lighten `--ink-400` (muted
  text) from `#6b7a8c` to `#8593a4` so it clears WCAG AA on `--surface`/`--surface-raised`/
  `--surface-hover` (5.74/5.35/4.88:1), fixing ~37 sites through the single token. **A2:** add a
  `--danger-strong` (`#cf3346`) fill for solid danger buttons so white `--danger-ink` clears AA
  (4.75:1, up from 3.22:1); `--danger` stays for danger text/borders on dark surfaces. **A3:** give
  `:focus-visible` a transparent 2px outline alongside the box-shadow glow so keyboard focus stays
  visible under forced-colors / Windows High Contrast, where the glow is dropped. **A4:** give the
  `GameCard`/`RecentGamesPeek` card-links the card's `--radius-lg` so the focus ring is rounded, not
  a rectangle around a rounded card. **A5:** document on the `Card` `interactive` prop that it is
  presentational and must sit inside a real `<a>`/`<button>`. Refs: UX-8.
- Resolve the UX-8 token findings (T1/T2/T3) in one design-system pass. **T1:** converge on the
  arbitrary-value `[var(--...)]` token form - convert the two `bg-background text-foreground`
  stragglers (`layout.tsx`, `ShareShell.tsx`) and drop the dead `@theme` color map (keeping only
  `--font-sans`), so the shipped convention and the globals.css comment agree. **T3:** add the
  missing semantic aliases `--danger-ink`, `--scrim` (a `color-mix` overlay), and `--knob` to
  `tokens/colors.css` and document them in `docs/design/README.md`. **T2:** swap the raw ramp-step
  refs for those aliases - the video backdrop uses `--surface-inset` and the buffering overlay
  `--scrim` (replacing the unreliable `/40` opacity modifier on a bare `var()`), the danger button
  uses `--danger-ink`, the Switch thumb `--knob`, and the avatar palette `--accent`/`--accent-ink`.
  Token-only: the danger-fill contrast value change stays with accessibility finding A2. Refs: UX-8.
- Add the cross-cutting design QA (`docs/design/ux-audit.md`, UX-8). A token and accessibility
  audit of the shipped app against WCAG 2.1 AA and the design system. Findings: no raw hex or
  Tailwind named-palette colors anywhere (good), but the app runs two token syntaxes side by side
  (the `@theme` color map is dead in all but two files), a few sites reach past aliases into the raw
  `--ink-*`/`--turf-*` ramp, `--text-muted` fails AA for normal text (4.1/3.8/3.5:1), the danger
  button label fails AA (3.22:1), and the box-shadow-only focus ring disappears in forced-colors
  mode. The audit records each finding with file:line and computed contrast ratios, and tracks the
  fixes as small scoped follow-up PRs per owning lane. This PR is the audit record only; no app code
  changes. Refs: UX-8.
- Compose the watch page into one coherent layout with keyboard hints
  (`src/components/watch/`, UX-6). Presentational-only chrome the watch page swaps to via imports:
  `WatchLayout` (centered max-width frame), `WatchHeader` (title over a middot-joined meta line),
  `WatchSidebar` (the beside-player rail), `WatchEmptyState` (no-video message) and `HotkeyHints` - a
  token-driven panel that documents the tagging and timeline hotkeys with `Kbd` key caps so a
  keyboard-first coach learns the shortcuts without leaving the player. `buildWatchHotkeyGroups()`
  builds the reference from the single sources of truth (the `TAG_TYPES` config for capture keys plus
  the player's native arrow-key timeline navigation), keeping the caps in lockstep with the tagging
  leaf. German copy lives in a `watchContent` layer; tokens only, no raw hex. Coordination touch: the
  player's sidebar slot was pinned to the 60px `--rail-w` (unusable for the content panels), so its
  `<aside>` now uses the `--sidebar-w` content width, making the beside-player rail readable down to a
  laptop screen. Component-tested for the header meta rules, the empty/layout composition and the
  hotkey mapping. Refs: UX-6.
- Polish the games list and create surfaces onto DS components (`src/components/games/`, UX-5). The
  games page now composes a `GamesHeader` (title, subtitle and a "plus"-iconed new-game action) and a
  `GamesList` that renders each game as an interactive `GameCard` linking into its watch view - title
  and opponent/date on the left, the chapter roll-up on the right - or a centered empty-state card
  when there are none. A route-level `loading.tsx` fallback reuses the header and swaps the body for a
  pulsing `GamesListSkeleton`, so the frame does not jump while `listGames()` resolves. The create
  page moves its accent panel and heading into a presentational `GameFormCard` wrapper around the
  existing `GameForm`. No query or route changes; German copy stays in the `gamesContent` layer
  (adding a `loading` label) and the components hold no data access. Component-tested for the list,
  empty state, watch links, roll-up fallback, skeleton status region and the form-card framing.
  Refs: UX-5.
- Fill the watch player's quarter overlay slot (`src/features/quarters/overlay/`, UX-4). A new
  `QuarterTimelineOverlay` connector bridges the live player controller into the presentational
  `QuarterMarkers`: the marker component needs the game's total length to place its bands, which is
  only known live from the video metadata, so the connector reads `durationS` off
  `usePlayerController()` and passes it through. The watch page now mounts it into the player's
  `timelineOverlay` slot and mounts the existing `QuarterEditor` beside the tagging panel, so quarter
  boundaries show on the timeline and a coach can mark them while watching (PRD 5.3). No new quarter
  logic - the bands and editor were already built in P1-4; this only wires them into the player's
  typed slots. Component-tested that the bands honour the controller's live duration. Refs: UX-4.
- Add the login-free share surface shell (`src/features/share/shell/`, UX-7). A branded, nav-free
  chrome for the secret-link team (P0-10) and per-player (P0-11) clip views: `ShareShell` frames its
  children with a brand header, a "Privater Link" badge and a private-link footer note, and carries
  no coach navigation or sign-out so a token recipient can never hop into the coach app or onto
  another player's clips (PRD 5.5, s8). The presentational state blocks - `ShareLoading`,
  `ShareEmptyState` and `ShareExpiredState` (with a reusable `ShareMessage` primitive) - cover the
  loading, empty and expired/revoked-token cases. `shareMetadata`/`shareRobots` give pages the
  `noindex, nofollow, nocache` directives every secret-link surface must carry. German copy lives in
  a `content` layer; tokens only, no raw hex. P0-10 and P0-11 render their `PlaylistPlayer` as
  `ShareShell` children. Component-tested for the framing, the no-nav guarantee and the state copy.
  Refs: UX-7.
- Replace the static homepage placeholder with an auth-aware coach landing (`src/app/page.tsx`,
  `src/features/home/`, UX-2). Signed-out visitors see the value proposition and an "Anmelden" call
  to action to `/login`; a signed-in coach is greeted by name, offered a "Zu den Spielen" action and
  shown a short peek at their most recent games (`RecentGamesPeek`, top `RECENT_GAMES_PEEK_LIMIT` of
  the newest-first `listGames()`), each row linking straight into that game's watch view with a
  fallback to the full list. The page reads the session through the read-only `getCurrentCoach()`, so
  it is now server-rendered on demand; all copy lives in the German `homeContent` layer rather than
  scattered literals, and the peek's empty/populated states are unit-tested. Refs: UX-2.
- Add the coach app shell and primary navigation (`src/components/shell/`, UX-1). A reusable
  `AppShell` reads the session through the read-only `getCurrentCoach()` and, when a coach is signed
  in, draws a top bar with the brand/home link, a `PrimaryNav`, the signed-in coach's name and the
  existing `SignOutForm`; with no session (login, signup and the login-free share surfaces) it
  renders children bare, so those pages never leak the coach chrome. `PrimaryNav` is a client leaf
  that reads the live pathname and marks the active section with `aria-current="page"` (exact or
  descendant route, driven by the pure `isNavItemActive` helper) while keeping plain `next/link`
  anchors that work without JS. The root layout now wraps its children in `AppShell`, replacing the
  inline top bar that P0-2 had put in `src/app/games/layout.tsx`; that layout is removed as
  redundant so every coach page shares one chrome. All controls reuse the DS primitives and tokens
  (no raw hex). Pure active-state logic and the nav's active marking are unit-tested. Refs: UX-1.
- Visual pass on the auth screens (`src/app/(auth)/**`, UX-3). The login and invite-signup pages
  keep their P0-2 logic but gain a shared brand lockup (an accent "H" monogram plus the wordmark)
  above the `Card`, so the standalone screens carry the same identity as the coach shell's top bar.
  The signup-disabled notice becomes a proper empty state - a muted `alert-triangle` badge over a
  centered title and body. The existing DS `Card`/`Input`/`Button` error and loading states in
  `src/features/access/**` are unchanged. Refs: UX-3.
- Plan the UI/UX wave (W6, UX-1..UX-8) in `docs/project/backlog.md`: a coach app shell and primary
  nav, an auth-aware homepage, an auth-screen visual pass, mounting the quarter overlay into the
  watch page's empty slot, games/watch presentation polish, a login-free share surface shell, and a
  token/accessibility audit. Composes the isolated W1-W5 feature lanes into one coherent, polished
  product; no application code yet. Refs: UX-1..UX-8.
- Mount the sign-out control in the coach app shell, completing P0-2. A new `/games` layout
  (`src/app/games/layout.tsx`) wraps every authenticated coach surface (games list, create, watch)
  in a top bar showing the brand, the signed-in coach's name and a `SignOutForm`
  (`src/features/access/`). The form posts to the existing `logoutAction` server action - a real
  POST that works without client JS - which invalidates the session, clears the cookie and
  redirects to login; its submit button disables itself via `useFormStatus` while the action runs.
  The bar reads the session through the read-only `getCurrentCoach()` and only renders once a coach
  is present, so unauthenticated hits still fall through to each page's `requireCoach()` redirect.
  Refs: P0-2.
- Re-source `TagChip` from the P1-3 tag-type config and delete the DS-3 stand-in
  (`src/components/data/tag-types.ts`). The chip's `type` prop now takes real `tags.type` keys
  (`goal`/`corner_short`/`action_good`/`action_bad`) and reads its default German label from
  `getTagType`, so it renders live tags directly; P1-3 exports a `TagTypeKey` literal union for the
  typed prop. The `whistle` (AI double-whistle suggestion) chip stays as a component variant with a
  locally owned label, since a suggestion is a `tags.source`, not a `tags.type`. Refs: DS-3, P1-3.
- Add the quarter split (`src/features/quarters/`, `src/app/api/quarters/`, P1-4). A coach marks each
  quarter's start on the global game timeline (ADR 0002) to enable timeline navigation and per-quarter
  clip creation (PRD 5.3). The pure navigation module maps a game-time offset to its quarter
  (`quarterAt`, half-open intervals so a boundary belongs to the next span), resolves a quarter's clip
  window (`quarterWindow` - explicit end, else the next quarter's start, else the game end, clamped to
  the game length) for the clip flow (P0-9), and lays out timeline bands (`quarterBands`). The
  coach-only `GET`/`PUT /api/quarters` reads and replaces a game's boundaries as a whole set: the
  untrusted `PUT` body is validated (a contiguous `1..N` run of strictly ordered, non-overlapping
  quarters) before `replaceQuarters` swaps the `quarters` rows in one transaction. The `QuarterEditor`
  sidebar leaf marks starts from the live player time and jumps back to any quarter, saving through the
  route handler (never a direct DB call from the client), and `QuarterMarkers` draws the boundaries
  over the player's timeline slot. Pure navigation, validation, and draft shaping are unit-tested, plus
  component tests for the editor and markers. Refs: P1-4.
- Add hotkey tagging. A single keypress captures the current global game time plus a tag type and
  saves it, applying that type's default clip window (PRD 5.2). Lands the configurable tag-type
  module (`src/lib/tag-types/`, P1-3): the type set (Tor, Ecke kurz, Aktion gut, Aktion schlecht),
  each type's hotkey and default lead-in/follow-through window live in one config that the UI reads
  rather than hard-coding, and `getTagType`/`isTagTypeKey`/`tagTypeForHotkey` resolve keys and
  hotkeys (the config self-validates its keys, hotkeys, and windows at load). The `HotkeyTagger`
  capture leaf (`src/features/tagging/`) listens for the bound keys - ignoring modifiers and
  text-entry focus - reads live game-time through a `getCurrentTimeS` prop so it stays decoupled
  from the player (P0-5 mounts it into the watch page's tagging slot), and shows a hotkey legend
  plus an aria-live capture confirmation. The pure `captureTag` window math (start/end clamped to
  the game bounds) is unit-tested, and the coach-only `POST /api/tags` route validates the untrusted
  body, rejects unknown tag types, and stamps `author` from the session and `source: manual`
  server-side. Refs: P0-6, P1-3.
- Mount hotkey tagging into the watch page. A new `TaggingPanel`
  (`src/features/tagging/`) fills the player's `sidebar` slot, reads the live player controller
  (frame-current game time and total duration), and forwards them to the `HotkeyTagger` leaf, so
  a coach watching a game can now capture tags by keypress. Refs: P0-6.
- Fix `next build` failing without a database. The DB client (`src/lib/db/`) now connects lazily
  on first query instead of throwing at module import when `DATABASE_URL` is unset. Build-time
  page-data collection imports server modules (pages, route handlers) that transitively reach the
  client, so an eager throw broke the build (e.g. `/login`, `/signup`) in CI, which runs `pnpm
build` without a database. The check now fires at request time, where a missing connection
  string is a genuine misconfiguration. Callers use `db` unchanged.
- Add the continuous multi-chapter player and the coach watch page
  (`src/app/games/[id]/watch/`, `src/features/player/`). A game's N ordered chapter files play
  through a single `<video>` element as one seamless game timeline: the element's `src` is swapped
  at each chapter boundary (resume the next chapter at its start) and a seek that lands in another
  chapter loads it, then applies the local offset once its metadata is ready - so the coach only
  ever scrubs global game time, never file time (PRD 5.2, ADR 0002). The `(chapter, local offset)`
  mapping is confined to the player, which builds on the P0-4 time-mapping contract via a pure
  `planSeek` transition helper. NAS `game_sources.file_path` values are resolved to playable URLs
  server-side against the new optional `MEDIA_BASE_URL` env var (added to the env contract), so the
  raw NAS layout never ships to the browser. The watch page is the shared player shell and leaves
  typed slots for the sibling lanes to compose without editing it: a published `usePlayerController`
  hook plus `videoOverlay` / `timelineOverlay` / `sidebar` / `transportExtras` slots for hotkey
  tagging (P0-6) and the quarter overlay (P1-4). Unit tests cover the pure source resolution,
  timecode formatting, and seek/boundary transitions, plus a component test for the shell wiring,
  slots, and controller context. Refs: P0-5.
- Add creating a game with its ordered chapter files (`src/features/games/`, `/games` and
  `/games/new`). A coach enters title, optional opponent and played-on date, then references
  1..N source file paths in order with each file's duration in seconds - the files already live
  on the NAS, so nothing is re-uploaded. Creation runs behind `requireCoach()` and persists the
  game plus its `game_sources` rows in one transaction, stamping each chapter's `order_index`
  from its position so the global game-time mapping (ADR 0002) has stable, ordered durations. Pure
  input validation (`validateGame`, per-row source errors, a German decimal comma accepted for
  durations) is unit-tested and shared by the server action; the list page shows every game with
  its chapter count and total length, and `GET /api/games` exposes the same list as coach-only
  JSON for client components. Refs: P0-3.
- Build the design-system domain components in production React/TS + Tailwind, styled from the
  design tokens (no raw hex), under `src/components/data/`: `TagChip`, `StatusBadge`, `Timecode`,
  `PlayerChip`, and `Kbd`. `Timecode` formats a global game-time offset per the P0-4 time-mapping
  contract (pure `formatGameTime` helper: auto `H:MM:SS` / `M:SS`, optional accent hundredths,
  clamps non-finite/negative to zero). `TagChip` reads its tag-type set and German labels from a
  config module; because P1-3 has not landed yet, that module ships as a narrow local stand-in
  (`data/tag-types.ts`) to be re-sourced from `src/lib/tag-types/` when P1-3 exists. `StatusBadge`
  pulses while `processing`; `PlayerChip` derives deterministic, token-based avatar colors and
  initials from the player name. Adds unit tests for each component and the pure helpers. Refs: DS-3.
- Document how to run the whole system on a single Mac - app, local Postgres, and video files in a
  local folder - without the NAS or VPS (`docs/ops/local-development.md`), and link it from the
  README. Clarifies that the three-machine split (ADR 0003) is a deployment choice: the database URL
  and file paths are the only things that re-home when you later move to the VPS/M4/NAS topology, so
  no application code changes.
- Add coach login. Coaches authenticate with email + password to create and edit content, while
  players and the team keep login-free read access via secret links. Passwords are hashed with
  Node's memory-hard `scrypt` (self-describing cost params, constant-time verify); sessions are
  opaque 256-bit tokens stored only as their SHA-256 hash in `sessions`, carried in an HttpOnly,
  SameSite=Lax, Secure-in-production cookie with a fixed 30-day lifetime. `src/middleware.ts` does a
  coarse cookie-presence redirect at the edge; `requireCoach()` is the authoritative DB-validated
  guard and `getCurrentCoach()` the shared read later tasks use to stamp `author`. Self-registration
  at `/signup` is gated by `AUTH_INVITE_CODE` (disabled when unset); login is rate-limited per
  IP+email and errors stay generic to avoid account enumeration. Adds `AUTH_INVITE_CODE` to the env
  contract, ADR 0005, unit tests for the pure logic (hashing, tokens, validation, invite gating,
  rate limiting), and a Vitest `server-only` stub so server modules are testable. Refs: P0-2.
- Fix the CSS import order that broke the app build and the Playwright smoke gate. The remote
  Google Fonts `@import` (in `src/styles/tokens/fonts.css`) was pulled in after
  `@import "tailwindcss"`, which expands inline to real style rules; CSS requires every `@import`
  to precede all rules, so Lightning CSS rejected the stylesheet and the dev server served a 500,
  timing out the smoke job's web-server wait. Import `fonts.css` before Tailwind so the webfont
  `@import` stays first. Also add the first real smoke spec (`tests/e2e/home.smoke.spec.ts`)
  asserting the home page responds `200` and renders its hero heading, so an unrenderable page
  fails fast with a clear assertion instead of a web-server timeout.
- Add the global game-time mapping utility (`src/lib/time-mapping/`): a pure,
  DB-free conversion between a global game-time offset and a `(source file, local
offset)` pair, computed from the ordered `game_sources.duration_s` durations
  (`toSourcePoint`, `toGameTime`, `totalDurationS`). This is the shared contract
  with the pipeline worker (ADR 0002); interior chapter boundaries resolve to the
  start of the next chapter and the exact game end resolves to the last chapter's
  end, with unit tests pinning the boundary and round-trip semantics. Refs: P0-4.
- Build the design-system primitive components in production React/TS + Tailwind, styled from the
  design tokens (no raw hex): `Card` and `Icon` under `src/components/core/`, and `Button`,
  `IconButton`, `Input`, `Select`, `Switch` under `src/components/forms/`. `Icon` wraps a curated,
  tree-shakeable Lucide glyph set; a `cn` helper (tailwind-merge) lets callers override classes.
  Adds `lucide-react` and `tailwind-merge`, and component unit tests under `tests/unit/components/`.
  Refs: DS-2.
- Fix the lint/type toolchain, which was broken repo-wide by bleeding-edge major
  versions the plugin stack does not yet support. Pin `typescript` to `6.0.3`
  (the native TypeScript 7 port is unsupported by `@typescript-eslint`, whose
  peer caps at `<6.1.0`) and `eslint` to `^9.39.5` (ESLint 10 removed the
  deprecated context APIs `eslint-plugin-react` still calls). Migrate
  `eslint.config.mjs` off the broken `FlatCompat` shim to the native flat-config
  exports of `eslint-config-next`, drop the now-unused `@eslint/eslintrc`, and
  align `setup.sh` so fresh scaffolds do not regenerate the break. `pnpm lint`,
  `typecheck`, `test`, and `build` all pass again.
- Sharpen the backlog-marker convention in the git workflow and backlog docs: tick a task's box
  before the merge PR (not after), use `- [~]` whenever concrete steps still remain (a CLI
  command, server/route wiring, a follow-up) and `- [x]` only when nothing is left, and never
  leave a started task `- [ ]`.
- Track `.env.schema` in git (un-ignore it in `.gitignore`). The broad `.env.*`
  ignore rule was hiding the schema, so a fresh CI clone had no schema file and
  `scripts/check-env.sh` exited green without validating anything - the env
  contract was documented but never enforced.
- Stand up the Next.js app shell (root layout, landing page, Tailwind v4 design
  tokens, `output: "standalone"`) and the full Postgres schema via Drizzle: all
  tables (`coaches`, `sessions`, `games`, `game_sources`, `players`, `tags`,
  `tag_players`, `clips`, `comments`, `quarters`, `whistle_candidates`) with the
  initial migration under `drizzle/`, a server-only db client, and the `postgres`
  (compose `db` service) and `auth` flavors wired. Refs: P0-1.
- Import the design-system foundation from the claude.ai design project: dark-first design tokens
  (`src/styles/tokens/*.css`), a global entry stylesheet (`src/styles/globals.css`), and a
  `docs/design/` reference covering brand foundations, copy rules, iconography, the component
  catalogue, and provenance caveats (no real logo, Google Fonts substitutes, approximate brand
  green). Adds design-system tasks DS-1..DS-3 to the backlog waves.
- Project scaffolded from DevBlueprint (Web app (Next.js + pnpm)).
- Tailor `CLAUDE.md` to the project: add a domain summary, make stack notes concrete
  (global game-time model, secret-link safety, db/auth flavors), and sharpen the workflow
  rules - every code change in its own worktree, and agents push/open PRs while only the
  human merges.
- Group the backlog into five parallel execution waves (4 lanes) with per-task `[W1]`..`[W5]`
  badges and per-task owned-path assignments, so four instances can work a wave concurrently
  with minimal merge conflicts.
- Fix the CI install gate: allowlist the `unrs-resolver` native build script via pnpm 11's
  `allowBuilds` so `pnpm install --frozen-lockfile` no longer exits with
  ERR_PNPM_IGNORED_BUILDS.
- Pass a `GITHUB_TOKEN` to the gitleaks action, which now requires it to scan pull requests.
- Let `pnpm test` pass on the empty scaffold (`vitest --passWithNoTests`) until the first tests
  land, and ignore `*.tsbuildinfo`.
