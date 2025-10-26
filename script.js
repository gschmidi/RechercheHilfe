
// **********************************************
// NEU: Globale Variablen und onYouTubeIframeAPIReady Definition an den Anfang verschieben
// Dies stellt sicher, dass sie IMMER verfügbar ist, wenn das YouTube API Script lädt.
// **********************************************
let youtubeAPIReady = false;
const videoInitializationQueue = [];

// Diese Funktion wird von der YouTube Iframe API aufgerufen, sobald sie vollständig geladen ist.
// Sie muss global sein.
window.onYouTubeIframeAPIReady = function() {
    console.log('YouTube API is ready!');
    youtubeAPIReady = true;
    // Verarbeite alle Videos, die in die Warteschlange gestellt wurden, bevor die API bereit war
    while (videoInitializationQueue.length > 0) {
        const videoData = videoInitializationQueue.shift();
        initializeYouTubePlayer(videoData);
    }
};


document.addEventListener('DOMContentLoaded', () => {
    const contentArea = document.getElementById('contentArea');
    const buttons = document.querySelectorAll('.option-btn');
    const themeInput = document.getElementById('themeInput');

    const mainContainer = document.querySelector('.container');

    const memeNotification = document.getElementById('memeNotification');
    const notificationMessage = document.getElementById('notificationMessage');
    const notificationSpinner = document.getElementById('notificationSpinner');
    const notificationDismiss = document.getElementById('notificationDismiss');
    const btnMemes = document.getElementById('btnMemes');

    let twitterWidgetsLoaded = false;

    // youtubeAPIReady und videoInitializationQueue sind jetzt global definiert (siehe oben)
    const youtubePlayers = {};

    let currentPlayingVideoPlayer = null;
    let videoIntersectionObserver = null;

    let isGloballyMuted = true;

    // allThemesContentData wird jetzt aus einer externen Datei geladen
    let allThemesContentData = {};

    const loadedCategoriesPerTheme = {};

    // currentThemeKey wird erst nach dem Laden der Daten initialisiert
    let currentThemeKey;

    // Zustand für die Post-Übersetzung
    let arePostsTranslated = false;
    let hasAskedForTranslation = false; // Stellt sicher, dass die Übersetzungsfrage nur einmal gestellt wird

    // Konstante für die Anzahl der Memes, die pro Batch generiert werden sollen
    const MEMES_TO_GENERATE_BATCH = 4;

    const loadingMessages = {
        memes: {
            searching: "Durchsuche die Datenbank nach vorhandenen Memes...",
            notFoundPrompt: "Zu diesem Thema wurden leider keine Memes gefunden. Möchtest du, dass ich Memes dazu erstelle?", // Geändert zu Plural
            creating: "Erstelle Memes zum Thema Weltraumtourismus. Dies kann einige Sekunden dauern, sieh dir daher inzwischen die anderen Kategorien dieser Website durch. Du bekommst eine Nachricht, sobald sie fertig sind.", // Geändert zu Plural
            creating2: "Erstelle Memes", // Geändert zu Plural
	        askAgain: "Soll ich noch ein Meme erstellen?", // Diese Nachricht wird nicht mehr verwendet
	        allShown: "Es können keine neuen Memes mehr erstellt werden..."
        },
        videos: [
            "Suche nach Kurzvideos.",
            "Füge auch englische Videos hinzu."
        ],
        postings: { // Als Objekt für verschiedene Nachrichtentypen
            searching: "Durchstöbere X (Twitter) nach aktuellen Beiträgen...",
            translating: "Übersetze Beiträge..." // Neue Nachricht für die Übersetzung
        },
        zeitungsartikel: "Scanne Online-Archive nach relevanten Zeitungsartikel...",
        chatbot: "Verbinde mit dem Experten für Weltraumtourismus..."
    };

    let currentMainLoadingTimeoutId = null;
    let memeGenerationTimeoutId = null;
    let generatedMemeBuffer = []; // Temporäres Array für die aktuell generierten Memes
    let lastDisplayedMemeBatch = []; // Permanentes Array für die zuletzt generierten und angezeigten Memes
    let isMemeGenerationActive = false;
	
    let memesArrayForGeneration = [];

    // **********************************************
    // NEU: Video-Zustandsvariablen für die "All Ready"-Meldung
    // **********************************************
    let totalVideosExpected = 0;
    let videosReadyCount = 0;
    let allVideosReadyConsoleLogged = false;
    let videoContentWrapperElement = null;
    // NEU: Zeitstempel des Klicks auf die Video-Kategorie
    let videoCategoryClickTime = 0;


    function showLoadingScreen(category, messageType = 'searching') {
        window.scrollTo({ top: 0, behavior: 'instant' });

        let message;
        if (category === 'memes' && typeof loadingMessages.memes === 'object') {
            message = loadingMessages.memes[messageType];
        } else if (category === 'postings' && typeof loadingMessages.postings === 'object') {
            message = loadingMessages.postings[messageType];
        } else if (Array.isArray(loadingMessages[category])) {
            message = loadingMessages[category][0];
        } else {
            message = loadingMessages[category];
        }

        contentArea.innerHTML = `
            <div class="loading-overlay">
                <div class="spinner"></div>
                <p id="loadingMessageText" class="loading-message">${message || "Wird geladen..."}</p>
            </div>
        `;
        resetContentAreaStyles();
    }

    function showMemeNotification(message, type = 'info', clickable = false) {
        notificationMessage.textContent = message;
        memeNotification.className = `meme-notification ${type}`;

        if (type === 'loading') {
            notificationSpinner.style.display = 'block';
        } else {
            notificationSpinner.style.display = 'none';
        }

        if (clickable) {
            memeNotification.style.cursor = 'pointer';
            notificationMessage.style.textDecoration = 'underline'; // Optional: Unterstreichung als visueller Hinweis
            memeNotification.onclick = () => {
                if (btnMemes) {
                    btnMemes.click();
                }
                hideMemeNotification();
            };
        } else {
            memeNotification.style.cursor = 'default';
            notificationMessage.style.textDecoration = 'none';
            memeNotification.onclick = null;
        }

        memeNotification.classList.remove('hidden');
    }

    function hideMemeNotification() {
        memeNotification.classList.add('hidden');
        memeNotification.onclick = null;
    }


    notificationDismiss.addEventListener('click', (event) => {
        event.stopPropagation();
        hideMemeNotification();
    });


    function loadTwitterWidgets(targetElement) {
        if (window.twttr && window.twttr.widgets) {
            window.twttr.widgets.load(targetElement);
        } else if (!twitterWidgetsLoaded) {
            const script = document.createElement('script');
            script.src = "https://platform.twitter.com/widgets.js";
            script.async = true;
            script.charset = "utf-8";
            script.onload = () => {
                if (window.twttr && window.twttr.widgets) {
                    window.twttr.widgets.load(targetElement);
                }
            };
            document.body.appendChild(script);
            twitterWidgetsLoaded = true;
        }
    }

    function shuffleArray(array) {
        const shuffledArray = [...array];
        for (let i = shuffledArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
        }
        return shuffledArray;
    }

    function resetContentAreaStyles() {
        contentArea.style.minHeight = '300px';
        contentArea.style.padding = '25px';
        contentArea.style.border = '1px solid #ced4da';
        contentArea.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.1)';
        contentArea.style.backgroundColor = '#e9ecef';
        contentArea.style.borderRadius = '8px';
        contentArea.style.overflowY = 'auto';
        contentArea.classList.remove('video-mode');
        contentArea.classList.remove('chatbot-mode');


        if (videoIntersectionObserver) {
            videoIntersectionObserver.disconnect();
            videoIntersectionObserver = null;
        }
        // Destroy existing YouTube players
        Object.values(youtubePlayers).forEach(player => {
            if (player && typeof player.destroy === 'function') {
                try {
                    player.destroy();
                } catch (e) {
                    console.error("Error destroying YouTube player:", e);
                }
            }
        });
        // Clear the youtubePlayers object
        for (const key in youtubePlayers) {
            if (youtubePlayers.hasOwnProperty(key)) {
                delete youtubePlayers[key];
            }
        }
        currentPlayingVideoPlayer = null;
        videoContentWrapperElement = null; // NEU: Resetten des Containers, wenn die Anzeige wechselt
        videoCategoryClickTime = 0; // NEU: Resetten des Timestamps
    }

    const volumeUpSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.98 7-4.66 7-8.77s-2.99-7.79-7-8.77z"/></svg>`;
    const volumeOffSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .96-.24 1.86-.65 2.68l1.66 1.66C21.23 14.6 22 13.31 22 12c0-4.07-3.05-7.44-7-8.77v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71zM4.27 3L3 4.27l4.98 4.98L3 12v6h4l5 5V12.72L19.73 21 21 19.73 12.27 11 4.27 3zM10 15.27V12.73L12.42 15.15l-2.42.12z"/></svg>`;


    function toggleMute(player, buttonElement) {
        if (player.isMuted()) {
            player.unMute();
            player.setVolume(10);
            buttonElement.innerHTML = volumeUpSvg;
            isGloballyMuted = false;
        } else {
            player.mute();
            buttonElement.innerHTML = volumeOffSvg;
            isGloballyMuted = true;
        }
    }

    function showMemeGenerationPrompt() {
        const promptWrapper = document.createElement('div');
        promptWrapper.style.textAlign = 'center';
        promptWrapper.style.marginTop = '20px';
        promptWrapper.style.padding = '20px';
        promptWrapper.style.backgroundColor = '#f8f9fa';
        promptWrapper.style.border = '1px solid #dee2e6';
        promptWrapper.style.borderRadius = '8px';
        promptWrapper.style.boxShadow = '0 4px 8px rgba(0,0,0,0.05)';
        promptWrapper.style.maxWidth = '400px';
        promptWrapper.style.margin = '20px auto';

        const promptParagraph = document.createElement('p');
        promptParagraph.style.fontSize = '1.1em';
        promptParagraph.style.marginBottom = '20px';
        promptParagraph.textContent = loadingMessages.memes.notFoundPrompt;
        promptWrapper.appendChild(promptParagraph);

        const generateButton = document.createElement('button');
        generateButton.textContent = "Ja, bitte";
        generateButton.classList.add('option-btn');
        generateButton.style.padding = '15px 35px';
        generateButton.style.fontSize = '1.3em';
        generateButton.style.fontWeight = 'bold';
        generateButton.style.minWidth = '150px';

        generateButton.addEventListener('click', () => {
            if (!isMemeGenerationActive) {
                startMemeGenerationProcess();
            }
        });
        promptWrapper.appendChild(generateButton);

        contentArea.innerHTML = '';
        contentArea.appendChild(promptWrapper);
    }

    function startMemeGenerationProcess() {
        if (isMemeGenerationActive) {
            console.log("Meme generation already active. Ignoring request.");
            return;
        }

        isMemeGenerationActive = true;
        showLoadingScreen('memes', 'creating');
        showMemeNotification(loadingMessages.memes.creating2, 'loading');

        if (!allThemesContentData[currentThemeKey] || !allThemesContentData[currentThemeKey].memes) {
            console.error("Meme-Daten sind für das aktuelle Thema nicht verfügbar.");
            isMemeGenerationActive = false;
            hideMemeNotification();
            contentArea.innerHTML = `<p style="text-align: center; margin-top: 20px;">Es konnten keine Memes geladen werden.</p>`;
            return;
        }

        if (memesArrayForGeneration.length === 0 && allThemesContentData[currentThemeKey].memes.length > 0) {
            memesArrayForGeneration = shuffleArray([...allThemesContentData[currentThemeKey].memes]);
        }
        
        generatedMemeBuffer = [];

        const memesToGenerateInBatch = Math.min(MEMES_TO_GENERATE_BATCH, memesArrayForGeneration.length);
        for (let i = 0; i < memesToGenerateInBatch; i++) {
            generatedMemeBuffer.push(memesArrayForGeneration.shift());
        }

        if (memeGenerationTimeoutId) {
            clearTimeout(memeGenerationTimeoutId);
        }

        memeGenerationTimeoutId = setTimeout(() => {
            isMemeGenerationActive = false;
            memeGenerationTimeoutId = null;

            if (generatedMemeBuffer.length > 0) {
                lastDisplayedMemeBatch = [...generatedMemeBuffer];
                showMemeNotification("Deine Memes sind fertig!", 'success', true);
            } else {
                lastDisplayedMemeBatch = [];
                showMemeNotification(loadingMessages.memes.allShown, 'info', false);
            }
            
            memesArrayForGeneration = [];
            generatedMemeBuffer = [];

            const currentLoadingMessageElement = contentArea.querySelector('#loadingMessageText');
            if (currentLoadingMessageElement && currentLoadingMessageTextElement.textContent.includes(loadingMessages.memes.creating)) {
                contentArea.innerHTML = ''; 

                if (lastDisplayedMemeBatch.length > 0) {
                    lastDisplayedMemeBatch.forEach(meme => {
                        const memeDiv = document.createElement('div');
                        memeDiv.classList.add('content-item', 'generated-meme');
                        memeDiv.innerHTML = `
                            <h3>${meme.title}</h3>
                            <img src="${meme.image}" alt="${meme.title}" style="max-width: 100%; height: auto; display: block; margin: 15px auto; border-radius: 4px;">
                        `;
                        contentArea.appendChild(memeDiv);
                    });
                }
                
                const allShownMessageDiv = document.createElement('div');
                allShownMessageDiv.style.textAlign = 'center';
                allShownMessageDiv.style.marginTop = '20px';
                allShownMessageDiv.innerHTML = `<p>${loadingMessages.memes.allShown}</p>`;
                contentArea.appendChild(allShownMessageDiv);
                
                hideMemeNotification();
            } else {
                console.log("Memes generated in background, waiting for user to return to Memes category.");
            }
        }, 4000);
    }

    function extractTweetText(htmlString) {
        if (!htmlString) return '';
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        const pTag = doc.querySelector('blockquote.twitter-tweet p');
        if (pTag) {
            const clone = pTag.cloneNode(true);
            clone.querySelectorAll('a').forEach(a => a.remove());
            return clone.innerHTML.replace(/<br\s*\/?>/g, '\n').replace(/&amp;/g, '&').trim();
        }
        return '';
    }

    function renderPostings(useTranslated) {
        contentArea.innerHTML = '';
        arePostsTranslated = useTranslated;
        hasAskedForTranslation = true;

        if (!allThemesContentData[currentThemeKey] || !allThemesContentData[currentThemeKey].postings) {
            console.error("Postings-Daten sind für das aktuelle Thema nicht verfügbar.");
            contentArea.innerHTML = `<p style="text-align: center; margin-top: 20px;">Es konnten keine Beiträge geladen werden.</p>`;
            return;
        }

        const itemsToDisplay = shuffleArray([...allThemesContentData[currentThemeKey].postings]);

        itemsToDisplay.forEach(item => { 
            const postItemDiv = document.createElement('div');
            postItemDiv.classList.add('content-item');
            postItemDiv.style.marginBottom = '30px';

            if (useTranslated && item.translatedHtml) {
                const translatedText = extractTweetText(item.translatedHtml);
                if (translatedText) {
                    const translatedTextElem = document.createElement('p');
                    translatedTextElem.classList.add('translated-tweet-text');
                    translatedTextElem.innerHTML = `<strong>Übersetzung:</strong><br>${translatedText.replace(/\n/g, '<br>')}`;
                    postItemDiv.appendChild(translatedTextElem);
                }
            }
            const tweetWrapper = document.createElement('div');
            tweetWrapper.innerHTML = item.html;
            postItemDiv.appendChild(tweetWrapper);
            contentArea.appendChild(postItemDiv);
        });
        loadTwitterWidgets(contentArea);
    }

    function showTranslationPrompt() {
        contentArea.innerHTML = `
            <div id="translationPrompt" style="text-align: center; margin-top: 20px; padding: 20px; background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05);">
                <p style="font-size: 1.1em; margin-bottom: 20px;">Viele der gefundenen Posts sind auf Englisch. Sollen diese übersetzt werden?</p>
                <button id="translateYes" class="option-btn" style="margin-right: 30px; padding: 10px 20px;">Ja</button>
                <button id="translateNo" class="option-btn" style="padding: 10px 20px;">Nein</button>
            </div>
        `;
        const yesButton = document.getElementById('translateYes');
        const noButton = document.getElementById('translateNo');

        yesButton.addEventListener('click', () => {
            showLoadingScreen('postings', 'translating');
            setTimeout(() => {
                renderPostings(true);
            }, 3000);
        });

        noButton.addEventListener('click', () => {
            renderPostings(false);
        });
    }

    // **********************************************
    // NEU: Funktion zum Prüfen und Anzeigen des Video-Containers
    // **********************************************
    function checkAndDisplayVideoContent() {
        // Mindestens 5 Sekunden müssen seit dem Klick vergangen sein.
        // `videoCategoryClickTime` wird auf 0 gesetzt, wenn die Videos angezeigt werden,
        // um zu verhindern, dass die Bedingungen für eine zukünftige Anzeige fälschlicherweise erfüllt sind.
        const fiveSecondsPassed = (Date.now() - videoCategoryClickTime) >= 5000;
        
        // Beide Bedingungen müssen erfüllt sein: Alle Videos sind bereit UND die Wartezeit ist abgelaufen.
        if (allVideosReadyConsoleLogged && fiveSecondsPassed) {
            console.log(`%c[VIDEO STATUS] Both conditions met: Videos are ready AND 5 seconds have passed. Displaying video content.`, 'color: #007bff; font-weight: bold;');
            
            const loadingOverlay = contentArea.querySelector('.loading-overlay');
            if (loadingOverlay) loadingOverlay.remove();
            
            if (videoContentWrapperElement) {
                videoContentWrapperElement.style.display = 'block'; // Videos sichtbar machen

                // ******************************************************************************
                // NEU: Scroll-Logik hier hinzufügen
                // ******************************************************************************
                if (mainContainer && videoContentWrapperElement) {
                   // Berechne die Position des videoContentWrapperElement im Verhältnis zum Dokument
                   const wrapperRect = videoContentWrapperElement.getBoundingClientRect();
                   const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
                   
                   // Die gewünschte Scroll-Position ist der obere Rand des Wrappers
                   // abzüglich eines kleinen Offsets (z.B. für eine mögliche feste Kopfzeile oder Polsterung)
                   // oder um sicherzustellen, dass der gesamte Player im View ist.
                   const targetScrollPosition = wrapperRect.top + currentScrollY;
                   
                   window.scrollTo({
                       top: targetScrollPosition,
                       behavior: 'smooth'
                   });
                   console.log(`[SCROLL] Scrolled to video content at Y-position: ${targetScrollPosition}`);
                }
            }
            videoCategoryClickTime = 0; // Reset für den nächsten Klick auf Videos
        } else {
            console.log(`%c[VIDEO STATUS] Waiting for conditions: Ready: ${allVideosReadyConsoleLogged}, 5s Passed: ${fiveSecondsPassed}.`, 'color: orange;');
            // Wenn die 5 Sekunden abgelaufen sind, aber Videos noch nicht bereit,
            // setzen wir einen kurzen Timer, um erneut zu prüfen.
            // Dies ist wichtig, da `onPlayerReady` nur bei Video-Bereitschaft triggert,
            // aber nicht, wenn die 5s später ablaufen.
            if (fiveSecondsPassed && !allVideosReadyConsoleLogged) {
                 setTimeout(checkAndDisplayVideoContent, 500); // Erneut prüfen, falls Player noch nicht bereit
            }
        }
    }


    function displayContent(category) {
        if (videoIntersectionObserver) {
            videoIntersectionObserver.disconnect();
            videoIntersectionObserver = null;
        }

        if (category === 'chatbot') {
            contentArea.classList.add('chatbot-mode');
            contentArea.classList.remove('video-mode');
        } else if (category === 'videos') {
            contentArea.classList.add('video-mode');
            contentArea.classList.remove('chatbot-mode');
        }
        else {
            resetContentAreaStyles();
        }

        if (category === 'chatbot') {
            contentArea.innerHTML = `
                <iframe
                    src="chat-app.html"
                    title="Experten-Chat zum Weltraumtourismus"
                    style="width: 100%; height: 100%; border: none; border-radius: 0; overflow: hidden;"
                ></iframe>
            `;
            const iframe = contentArea.querySelector('iframe');
            if (iframe) {
                iframe.focus({ preventScroll: true });
            }
            setTimeout(() => {
                if (contentArea) {
                    contentArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 50);

            return;
        }

        if (!allThemesContentData[currentThemeKey]) {
            contentArea.innerHTML = `<p class="error-message">Fehler: Inhaltsdaten für das Thema "${currentThemeKey}" konnten nicht geladen werden oder existieren nicht anhand des aktuellen Themes: "${currentThemeKey}".</p>`;
            console.error(`Inhaltsdaten für das Thema "${currentThemeKey}" nicht verfügbar.`);
            return;
        }

        if (category === 'videos') {
            showLoadingScreen(category); // Zeigt den Ladebildschirm.

            videoContentWrapperElement = document.createElement('div');
            videoContentWrapperElement.style.display = 'none'; // Initial ausgeblendet
            videoContentWrapperElement.classList.add('video-content-wrapper');

            const videoMessageDiv = document.createElement('div');
            videoMessageDiv.classList.add('video-top-message');
            videoMessageDiv.innerHTML = `
                <p>Swipe im Videoplayer nach unten, um weitere Kurzvideos zu entdecken.</p>
            `;
            videoContentWrapperElement.appendChild(videoMessageDiv);

            const videoPlayerContainer = document.createElement('div');
            videoPlayerContainer.classList.add('video-player-container');
            videoContentWrapperElement.appendChild(videoPlayerContainer);

            contentArea.appendChild(videoContentWrapperElement);

            const videosToInit = [];
            const videos = shuffleArray([...allThemesContentData[currentThemeKey].videos]);

            totalVideosExpected = videos.length;
            videosReadyCount = 0;
            allVideosReadyConsoleLogged = false;

            if (totalVideosExpected === 0) {
                console.log(`%c[VIDEO STATUS] No videos to initialize for this theme. All (0) videos are considered ready.`, 'color: green; font-weight: bold;');
                allVideosReadyConsoleLogged = true; // Markiere als bereit, da keine Videos zu laden sind
                videoContentWrapperElement.style.display = 'block';
                const loadingOverlay = contentArea.querySelector('.loading-overlay');
                if (loadingOverlay) loadingOverlay.remove();
                return;
            }


            videoIntersectionObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    const playerPlaceholder = entry.target.querySelector('.youtube-player-placeholder');
                    if (!playerPlaceholder) return; 

                    const playerId = playerPlaceholder.id;
                    const player = youtubePlayers[playerId];

                    if (!player || !player.isApiReady || !player.muteButtonElement || !player.originalVideoId) {
                        return;
                    }

                    // --- Playback Logic: Video enters full view (>= 80%) ---
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.8) {
                        if (player.getPlayerState() !== YT.PlayerState.PLAYING) {
                            console.log(`[IO] Playing video: ${playerId}`);

                            Object.values(youtubePlayers).forEach(p => {
                                if (p !== player && p.isApiReady && typeof p.getPlayerState === 'function' && 
                                    (p.getPlayerState() === YT.PlayerState.PLAYING || p.getPlayerState() === YT.PlayerState.BUFFERING)) {
                                    console.log(`[IO] Force pausing video: ${p.getIframe().id} (another video is now active).`);
                                    p.pauseVideo();
                                }
                            });
                            
                            player.playVideo();
                            currentPlayingVideoPlayer = player;

                            const muteBtn = player.muteButtonElement;
                            if (isGloballyMuted) {
                                player.mute();
                                if (muteBtn) muteBtn.innerHTML = volumeOffSvg;
                            } else {
                                player.unMute();
                                player.setVolume(10);
                                if (muteBtn) muteBtn.innerHTML = volumeUpSvg; 
                            }
                        }
                        player.isCued = true;
                    }
                    // --- Pre-buffering/Cueing Logic: Video enters partial view (0% to < 80%) ---
                    else if (entry.isIntersecting && entry.intersectionRatio > 0 && entry.intersectionRatio < 0.8) {
                        if (player.getPlayerState() === YT.PlayerState.UNSTARTED && !player.isCued) {
                            console.log(`[IO] Cueing video for pre-buffering: ${playerId}`);
                            player.cueVideoById(player.originalVideoId);
                            player.isCued = true;
                        }
                    }
                    // --- Out of View Logic: Video leaves view (0% or less intersection) ---
                    else if (!entry.isIntersecting) {
                        if (player.getPlayerState() === YT.PlayerState.PLAYING || player.getPlayerState() === YT.PlayerState.BUFFERING) {
                            console.log(`[IO] Pausing video out of view: ${playerId}`);
                            player.pauseVideo();
                        }
                        if (currentPlayingVideoPlayer === player) {
                            console.log(`[IO] Clearing currentPlayingVideoPlayer: ${playerId}`);
                            currentPlayingVideoPlayer = null;
                        }
                        player.isCued = false;
                    }
                });
            }, {
                root: videoPlayerContainer,
                rootMargin: '0px 0px 300px 0px',
                threshold: [0, 0.8]
            });


            videos.forEach((item, index) => {
                const videoSlide = document.createElement('div');
                videoSlide.classList.add('video-slide');
                const uniquePlayerId = `youtube-player-${category}-${index}`;

                const videoControlsDiv = document.createElement('div');
                videoControlsDiv.classList.add('video-controls');

                const muteButton = document.createElement('button');
                muteButton.classList.add('mute-button');
                muteButton.dataset.playerId = uniquePlayerId;
                muteButton.innerHTML = (isGloballyMuted ? volumeOffSvg : volumeUpSvg);
                videoControlsDiv.appendChild(muteButton);

                videoSlide.innerHTML = `
                    <div id="${uniquePlayerId}" class="youtube-player-placeholder"></div>
                `;
                videoSlide.appendChild(videoControlsDiv);
                videoPlayerContainer.appendChild(videoSlide);

                videosToInit.push({
                    id: uniquePlayerId,
                    videoId: item.embedUrl.split('/').pop().split('?')[0],
                    autoplay: false,
                    muteButton: muteButton,
                });

                videoIntersectionObserver.observe(videoSlide);
            });

            const endSlide = document.createElement('div');
            endSlide.classList.add('video-end-slide');
            endSlide.innerHTML = `
                <p>Keine weiteren Videos zu diesem Thema gefunden.</p>
            `;
            videoPlayerContainer.appendChild(endSlide);
            videoIntersectionObserver.observe(endSlide);


            videosToInit.forEach(videoData => {
                if (youtubeAPIReady) {
                    initializeYouTubePlayer(videoData);
                } else {
                    videoInitializationQueue.push(videoData);
                }
            });

            return; // Beende displayContent hier. Die Videos werden später sichtbar gemacht.
        }
        // ******************************************************************************
        // ENDE DER VIDEO-SPEZIFISCHEN LOGIK IN displayContent
        // ******************************************************************************


        contentArea.innerHTML = ''; // Leere den contentArea für nicht-Video-Kategorien, falls ein Ladebildschirm aktiv war
        let itemsToDisplay = allThemesContentData[currentThemeKey] ? allThemesContentData[currentThemeKey][category] : null;

        if (!itemsToDisplay || itemsToDisplay.length === 0) {
            contentArea.innerHTML = `<p>Leider keine ${category}-Beiträge zum Thema "${themeInput.value}" gefunden.</p>`;
            return;
        }

        if (category === 'zeitungsartikel') {
            itemsToDisplay = shuffleArray(itemsToDisplay);
        }

        switch (category) {
            case 'memes':
                if (lastDisplayedMemeBatch.length > 0) {
                    contentArea.innerHTML = ''; 
                    lastDisplayedMemeBatch.forEach(meme => {
                        const memeDiv = document.createElement('div');
                        memeDiv.classList.add('content-item', 'generated-meme');
                        memeDiv.innerHTML = `
                            <h3>${meme.title}</h3>
                            <img src="${meme.image}" alt="${meme.title}" style="max-width: 100%; height: auto; display: block; margin: 15px auto; border-radius: 4px;">
                        `;
                        contentArea.appendChild(memeDiv);
                    });
                    
                    const allShownMessageDiv = document.createElement('div');
                    allShownMessageDiv.style.textAlign = 'center';
                    allShownMessageDiv.style.marginTop = '20px';
                    allShownMessageDiv.innerHTML = `<p>${loadingMessages.memes.allShown}</p>`;
                    contentArea.appendChild(allShownMessageDiv);
                    hideMemeNotification();
                    return;
                }

                if (memesArrayForGeneration.length === 0 && allThemesContentData[currentThemeKey] && allThemesContentData[currentThemeKey].memes && allThemesContentData[currentThemeKey].memes.length > 0) {
                    memesArrayForGeneration = shuffleArray([...allThemesContentData[currentThemeKey].memes]);
                }

                if (isMemeGenerationActive) {
                    showLoadingScreen(category, 'creating');
                    showMemeNotification(loadingMessages.memes.creating, 'loading');
                    return;
                }

                if (memesArrayForGeneration.length === 0) {
                    contentArea.innerHTML = `<p style="text-align: center; margin-top: 20px;">${loadingMessages.memes.allShown}</p>`;
                    showMemeNotification(loadingMessages.memes.allShown, 'info', false);
                    return;
                }

                showMemeGenerationPrompt();
                hideMemeNotification(); 
                break;
            case 'postings':
                if (!hasAskedForTranslation) {
                    showTranslationPrompt(); // Frage nach Übersetzung stellen
                } else {
                    renderPostings(arePostsTranslated); // Direkt rendern basierend auf vorheriger Wahl
                }
                break;
            case 'zeitungsartikel':
                itemsToDisplay.forEach(item => {
                    const articleDiv = document.createElement('div');
                    articleDiv.classList.add('content-item');
                    articleDiv.innerHTML = `
                        <h3>${item.title}</h3>
                        <p>${item.snippet}</p>
                        <p class="article-meta">
                            Veröffentlicht: <strong>${item.date}</strong> |
                            Lesezeit: <strong>${item.readTime}</strong> |
                            Quelle: <strong>${item.journal}</strong>
                        </p>
                        <a href="${item.link}" target="_blank" class="zeitungsartikel-link">Artikel lesen</a>
                    `;
                    contentArea.appendChild(articleDiv);
                });
                break;
            default:
                contentArea.innerHTML = '<p>Diese Kategorie existiert nicht.</p>';
        }
    }

    function initializeYouTubePlayer(videoData) {
        const playerElement = document.getElementById(videoData.id);
        if (!playerElement) {
            console.warn(`Platzhalter für Player-ID ${videoData.id} nicht gefunden. Video wird nicht initialisiert. Dies kann vorkommen, wenn die Kategorie schnell gewechselt wird.`);
            return;
        }

        const player = new YT.Player(videoData.id, {
            videoId: videoData.videoId,
            playerVars: {
                autoplay: 0,
                controls: 0,
                mute: 1,
                loop: 1,
                playlist: videoData.videoId,
                playsinline: 1,
                modestbranding: 1,
                rel: 0,
                showinfo: 0,
                iv_load_policy: 3
            },
            events: {
                'onReady': (event) => onPlayerReady(event, videoData.muteButton),
                'onStateChange': (event) => onPlayerStateChange(event, videoData.muteButton),
                'onError': onPlayerError
            }
        });
        youtubePlayers[videoData.id] = player;
        player.muteButtonElement = videoData.muteButton;
        player.isApiReady = false; // Initialisiere den Ready-Zustand des Players
        player.isCued = false;    // NEU: Zustand für Cueing initialisieren
        player.originalVideoId = videoData.videoId; // NEU: VideoId auf dem Player-Objekt speichern

        console.log(`Player ${videoData.id} initialization attempted for video ID ${videoData.videoId}.`);
    }

    function onPlayerReady(event, muteButtonElement) {
        const player = event.target;
        player.isApiReady = true; // Markiere den Player als API-ready
        const playerId = player.getIframe().id; // Robustere ID-Abfrage
        console.log(`Player ${playerId} is ready.`);

        if (muteButtonElement) {
            muteButtonElement.addEventListener('click', () => toggleMute(player, muteButtonElement));
            if (isGloballyMuted) {
                player.mute();
                muteButtonElement.innerHTML = volumeOffSvg;
            } else {
                player.unMute();
                player.setVolume(3);
                muteButtonElement.innerHTML = volumeUpSvg;
            }
        }

        videosReadyCount++;
        if (videosReadyCount === totalVideosExpected && !allVideosReadyConsoleLogged) {
            console.log(`%c[VIDEO STATUS] All ${totalVideosExpected} YouTube players are ready for the current theme!`, 'color: green; font-weight: bold;');
            allVideosReadyConsoleLogged = true;
            checkAndDisplayVideoContent(); // NEU: Prüfe, ob Videos angezeigt werden sollen
        }
    }

    function onPlayerStateChange(event, muteButtonElement) {
        if (!event.target.isApiReady) {
            console.warn("onPlayerStateChange fired for a non-API-ready player. Ignoring.");
            return;
        }

        const playerId = event.target.getIframe().id;
        const player = youtubePlayers[playerId];

        if (muteButtonElement) {
            if (player.isMuted()) {
                muteButtonElement.innerHTML = volumeOffSvg;
            } else {
                muteButtonElement.innerHTML = volumeUpSvg;
            }
        }

        if (event.data === YT.PlayerState.ENDED) {
            event.target.playVideo();
        }
    }

    function onPlayerError(event) {
        const playerId = event.target && typeof event.target.getIframe === 'function' ? event.target.getIframe().id : 'Unknown Player (pre-API-ready error?)';
        console.error(`YouTube Player Error for ${playerId}:`, event.data);

        const errorElement = document.getElementById(playerId);
        if (errorElement && errorElement.parentNode) {
            const videoData = allThemesContentData[currentThemeKey]?.videos.find(v => v.embedUrl.includes(event.target.getVideoData ? event.target.getVideoData().video_id : ''));
            errorElement.parentNode.innerHTML = `
                <div style="color: white; padding: 20px; text-align: center; background-color: #333; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                    <h3>Video nicht verfügbar</h3>
                    <p>Das Video '${videoData ? videoData.title : 'Unbekannt'}' konnte nicht geladen werden.</p>
                    <p style="font-size: 0.8em;">(Fehlercode: ${event.data}).</p>
                    <p style="font-size: 0.8em;">Dies kann an Einbettungsbeschränkungen liegen.</p>
                </div>
            `;
        }
    }

    function initializeApplicationLogic() {
        currentThemeKey = themeInput.value.toLowerCase();

        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const category = button.id.replace('btn', '').toLowerCase();

                if (currentMainLoadingTimeoutId) {
                    clearTimeout(currentMainLoadingTimeoutId);
                    currentMainLoadingTimeoutId = null;
                }

                window.scrollTo({ top: 0, behavior: 'instant' });

                if (!loadedCategoriesPerTheme[currentThemeKey]) {
                    loadedCategoriesPerTheme[currentThemeKey] = new Set();
                }
                const currentThemeLoadedCategories = loadedCategoriesPerTheme[currentThemeKey];

                if (category === 'chatbot') {
                    displayContent(category);
                    currentThemeLoadedCategories.add(category);
                } else if (category === 'postings') {
                    if (!currentThemeLoadedCategories.has(category) || !hasAskedForTranslation) {
                        showLoadingScreen(category, 'searching');
                        currentMainLoadingTimeoutId = setTimeout(() => {
                            displayContent(category);
                            currentThemeLoadedCategories.add(category);
                            currentMainLoadingTimeoutId = null;
                        }, 5000);
                    } else {
                        displayContent(category);
                    }
                } else if (category === 'videos') { // ANGEPASST für Videos
                    // ******************************************************************************
                    // Ladebildschirm wird in displayContent(category) aufgerufen.
                    // Der 5-Sekunden-Timer startet hier.
                    // displayContent(category) wird direkt aufgerufen, um die Videos zu initialisieren.
                    // ******************************************************************************
                    videoCategoryClickTime = Date.now(); // Zeitstempel des Klicks setzen
                    
                    // Setze den Timer, der nach 5 Sekunden `checkAndDisplayVideoContent` aufruft.
                    // Dieser Timer muss immer laufen, auch wenn Videos schneller bereit sind.
                    currentMainLoadingTimeoutId = setTimeout(() => {
                        checkAndDisplayVideoContent(); 
                        currentMainLoadingTimeoutId = null; // Lösche die ID, da der Timer abgelaufen ist.
                    }, 5000);

                    if (allThemesContentData[currentThemeKey] && allThemesContentData[currentThemeKey].videos) {
                        allThemesContentData[currentThemeKey].videos = shuffleArray(allThemesContentData[currentThemeKey].videos);
                    }
                    displayContent(category); // Rufe displayContent direkt auf, um Videos im Hintergrund zu initialisieren
                    currentThemeLoadedCategories.add(category);

                } else { // Für andere bereits geladene Kategorien
                    displayContent(category);
                }
            });
        });

        contentArea.innerHTML = '<p>Wähle eine Option, um Beiträge zum Thema Weltraumtourismus zu sehen.</p>';
        resetContentAreaStyles();
        hideMemeNotification();
    }

    // **********************************************
    // Dynamisches Laden des YouTube Iframe API Scripts IM DOMContentLoaded
    // Dies wird nach der globalen Definition der onYouTubeIframeAPIReady platziert.
    // **********************************************
    if (typeof YT === 'undefined' || !YT.Player) {
        console.log("Dynamisch lade YouTube Iframe API Script...");
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
        console.log("YouTube API Objekt existiert bereits. Synchronisiere internen Bereitschaftsstatus.");
        if (!youtubeAPIReady) {
            window.onYouTubeIframeAPIReady();
        }
    }


    fetch('contentData.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status} - Konnte contentData.json nicht laden.`);
            }
            return response.json();
        })
        .then(data => {
            allThemesContentData = data;
            console.log("Inhaltsdaten erfolgreich geladen:", allThemesContentData);
            initializeApplicationLogic();
        })
        .catch(error => {
            console.error("Fehler beim Laden der Inhaltsdaten:", error);
            contentArea.innerHTML = `<p class="error-message">Ein Fehler ist aufgetreten: ${error.message}. Die Inhalte konnten nicht geladen werden.</p>`;
            resetContentAreaStyles();
            hideMemeNotification();
        });
});