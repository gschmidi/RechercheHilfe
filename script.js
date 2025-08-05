document.addEventListener('DOMContentLoaded', () => {
    const contentArea = document.getElementById('contentArea');
    const buttons = document.querySelectorAll('.option-btn');
    const themeInput = document.getElementById('themeInput');

    const mainContainer = document.querySelector('.container');

    // Referenzen zu den Benachrichtigungselementen
    const memeNotification = document.getElementById('memeNotification');
    const notificationMessage = document.getElementById('notificationMessage');
    const notificationSpinner = document.getElementById('notificationSpinner');
    const notificationDismiss = document.getElementById('notificationDismiss');
    const btnMemes = document.getElementById('btnMemes'); // Referenz zum Memes-Button

    let twitterWidgetsLoaded = false;

    let youtubeAPIReady = false;
    const videoInitializationQueue = [];
    const youtubePlayers = {};

    let currentPlayingVideoPlayer = null;
    let videoIntersectionObserver = null;

    let isGloballyMuted = true;

    const loadedCategoriesPerTheme = {};

    const currentThemeKey = themeInput.value.toLowerCase();

    const loadingMessages = {
        memes: {
            searching: "Durchsuche die Datenbank nach vorhandenen Memes...",
            notFoundPrompt: "Zu diesem Thema wurden leider keine Memes gefunden. Möchtest du, dass ich ein Meme dazu erstelle?",
            creating: "Erstelle Meme zum Thema Weltraumtourismus mit Hilfe von ChatGPT. Dies kann einige Minuten dauern, sieh dir daher inzwischen die anderen Kategorien dieser Website durch. Du bekommst eine Nachricht, sobald sie fertig ist.",
            creating2: "Erstelle Meme",
	    askAgain: "Soll ich noch ein Meme erstellen?",
	    allShown: "Es können keine neuen Memes mehr erstellt werden..."
        },
        videos: [
            "Suche nach Kurzvideos.",
            "Füge auch englische Videos hinzu."
        ],
        postings: "Durchstöbere X (Twitter) nach aktuellen Beiträgen...",
        zeitungsartikel: "Scanne Online-Archive nach relevanten Zeitungsartikeln...",
        chatbot: "Verbinde mit dem Experten für Weltraumtourismus..."
    };

    let currentMainLoadingTimeoutId = null;
    let memeGenerationTimeoutId = null;
    let generatedMemeBuffer = null;
    let isMemeGenerationActive = false;
	
    // Variable für das aktuell/zuletzt angezeigte Meme
    let currentDisplayedMeme = null;

    let memesArrayForGeneration = [];


    function showLoadingScreen(category, messageType = 'searching') {
        window.scrollTo({ top: 0, behavior: 'instant' });

        let message;
        if (category === 'memes' && typeof loadingMessages.memes === 'object') {
            message = loadingMessages.memes[messageType];
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

    // NEU: Funktionen zur Steuerung der Meme-Benachrichtigung
    function showMemeNotification(message, type = 'info', clickable = false) {
        notificationMessage.textContent = message;
        memeNotification.className = `meme-notification ${type}`; // Setzt die Klasse für Styling (loading, success, info)

        // Spinner nur bei 'loading' anzeigen
        if (type === 'loading') {
            notificationSpinner.style.display = 'block';
        } else {
            notificationSpinner.style.display = 'none';
        }

        // Klickbarkeit der gesamten Notification
        if (clickable) {
            memeNotification.style.cursor = 'pointer';
            memeNotification.onclick = () => {
                if (btnMemes) {
                    btnMemes.click(); // Klickt den Memes-Button, um zur Kategorie zu wechseln
                }
                hideMemeNotification(); // Notification ausblenden nach Klick
            };
        } else {
            memeNotification.style.cursor = 'default';
            memeNotification.onclick = null;
        }

        memeNotification.classList.remove('hidden');
    }

    function hideMemeNotification() {
        memeNotification.classList.add('hidden');
        memeNotification.onclick = null; // Klick-Handler entfernen
    }

    // Event Listener für den Schließen-Button der Notification
    notificationDismiss.addEventListener('click', (event) => {
        event.stopPropagation(); // Verhindert, dass der Klick das Notification-Element selbst auslöst
        hideMemeNotification();
    });
    // ENDE NEU: Funktionen zur Steuerung der Meme-Benachrichtigung


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
        for (const playerId in youtubePlayers) {
            if (youtubePlayers[playerId] && typeof youtubePlayers[playerId].destroy === 'function') {
                youtubePlayers[playerId].destroy();
            }
            delete youtubePlayers[playerId];
        }
        currentPlayingVideoPlayer = null;

    }

    const volumeUpSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.98 7-4.66 7-8.77s-2.99-7.79-7-8.77z"/></svg>`;
    const volumeOffSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .96-.24 1.86-.65 2.68l1.66 1.66C21.23 14.6 22 13.31 22 12c0-4.07-3.05-7.44-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27l4.98 4.98L3 12v6h4l5 5V12.72L19.73 21 21 19.73 12.27 11 4.27 3zM10 15.27V12.73L12.42 15.15l-2.42.12z"/></svg>`;


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

    const allThemesContentData = {
        "weltraumtourismus": { 
            memes: [
  	  {
                    title: " Der Neid…",
                    image: "pro-memes/Neid.png"
                },
  	  {
                    title: "Bewertungen in 2050",
                    image: "pro-memes/Both-bewertunggoogle.png"
                },
  	  {
                    title: "Raketenemoji",
                    image: "pro-memes/Emoji.png"
                },
  	  {
                    title: "Wifi im All?",
                    image: "pro-memes/wifi.png"
                },
  	  {
                    title: "Ready for Upgrade?",
                    image: "pro-memes/Upgrade.png"
                },
  	  {
                    title: "Selfie im All",
                    image: "pro-memes/Selfie.png"
                }

            ],
            videos: [
                {
                    title: "Der Weltraumtourismus – Der neue Goldrausch!",
                    embedUrl: "https://www.youtube.com/embed/Lnpp7_Plpvc", 
                    description: "vladi_facts"
                },
                {
                    title: "Weltraumtourismus: Wem steht der nächste Start ins All bevor?",
                    embedUrl: "https://www.youtube.com/embed/tiZuKdg-2PA", 
                    description: "Sajoai"
                },
                {
                    title: "Die Aufgaben eines Weltraumtourismus Managers",
                    embedUrl: "https://www.youtube.com/embed/vrz7Wt89gK8", 
                    description: "UnglaublicheFaktenzu"
                },
                {
                    title: "Do You Think Space Tourism is Useless? w/ Brian Cox",
                    embedUrl: "https://www.youtube.com/embed/E8McWcKL27U", 
                    description: "spacein1minute"
                },
                {
                    title: "When Will Space Tourism Be Affordable?",
                    embedUrl: "https://www.youtube.com/embed/cQG-3TtVWlA", 
                    description: "science.and.beyond"
                },
                {
                    title: "Space Tourism's Impact: Women, Overview Effect, and Beyond!",
                    embedUrl: "https://www.youtube.com/embed/qEGcbMtT7pI", 
                    description: "expeditionmoney"
                },
                {
                    title: "The Future of Space Tourism: When Can We Visit Space?",
                    embedUrl: "https://www.youtube.com/embed/qfJLG71yNsQ", 
                    description: "CuriosityaboutFacts-07"
                },
                {
                    title: "Space Tourism: A Reality in the 2030s",
                    embedUrl: "https://www.youtube.com/embed/2iBk8jsy5KU", 
                    description: "TheScience-t3m"
                }
            ],
            postings: [
    {
        'type': 'twitter',
        'html': '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Space Perspective wants to take tourists on balloon rides to the stratosphere <a href="https://t.co/PReUPCdL6X">https://t.co/PReUPCdL6X</a> <a href="https://t.co/i9ffRuGysD">pic.twitter.com/i9ffRuGysD</a></p>— SPACE.com (@SPACEdotcom) <a href="https://twitter.com/SPACEdotcom/status/1273725686654488576?ref_src=twsrc%5Etfw">June 18, 2020</a></blockquote>'
    },
    {
        'type': 'twitter',
        'html': '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">NASA releases even more of its fantastical space tourism posters <a href="https://t.co/h7X1e8w21k">https://t.co/h7X1e8w21k</a> <a href="https://t.co/6Q5Kl8ciSt">pic.twitter.com/6Q5Kl8ciSt</a></p>— Verge Video (@VergeVideo) <a href="https://twitter.com/VergeVideo/status/697400889921839105?ref_src=twsrc%5Etfw">February 10, 2016</a></blockquote>'
    },
    {
        'type': 'twitter',
        'html': '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Astronauts aboard the International <a href="https://twitter.com/Space_Station?ref_src=twsrc%5Etfw">@Space_Station</a> have free time that they can spend as they choose. One of the most popular activities is simply looking down at the Earth, soaking up rare and spectacular views from above. <a href="https://t.co/kBaGxpb1V1">pic.twitter.com/kBaGxpb1V1</a></p>— Planetary Society (@exploreplanets) <a href="https://twitter.com/exploreplanets/status/1438900959950766080?ref_src=twsrc%5Etfw">September 17, 2021</a></blockquote>'
    },
    {
        'type': 'twitter',
        'html': '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">🚀 The Rise of Space Tourism with SpaceX 🌍✨<br><br>SpaceX is revolutionizing space travel, making it more accessible for civilians!🌟<br><br> Here’s how:<br><br>🛰️ Crew Dragon & Private Missions – SpaceX’s Dragon capsule has already taken private citizens to orbit, including the Inspiration4…</p>— Epic_zooner Buchi_Hyper (@epic_zooner) <a href="https://twitter.com/epic_zooner/status/1897925645453107674?ref_src=twsrc%5Etfw">March 7, 2025</a></blockquote>'
    },
    {
        'type': 'twitter',
        'html': '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Space tourism is becoming a reality. The final frontier, accessible. 🚀 <a href="https://twitter.com/hashtag/SpaceTourism?src=hash&ref_src=twsrc%5Etfw">#SpaceTourism</a> <a href="https://twitter.com/hashtag/CommercialSpace?src=hash&ref_src=twsrc%5Etfw">#CommercialSpace</a></p>— erdalkaradag (@erdalkaradag85) <a href="https://twitter.com/erdalkaradag85/status/1950632417972347308?ref_src=twsrc%5Etfw">July 30, 2025</a></blockquote>'
    },
    {
        'type': 'twitter',
        'html': '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Starship will open the door to Space tourism for the masses :<br><br>Currently avail. sub-orbital flights price : <br>• Virgin Gapactiy: $450k for 1.5h<br>• Blue Origin: >$200k for 11 min<br><br>Starship can bring down this cost to ~$50k or even much lower in the long term. <a href="https://t.co/vPN8CQCGZM">pic.twitter.com/vPN8CQCGZM</a></p>— Tahreem Hussain (@tahreem57) <a href="https://twitter.com/tahreem57/status/1950292126815965546?ref_src=twsrc%5Etfw">July 29, 2025</a></blockquote>'
    },
    {
        'type': 'twitter',
        'html': '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Space tourism is now accessible to private citizens, opening a new era of exploration. <a href="https://twitter.com/hashtag/SpaceTourism?src=hash&ref_src=twsrc%5Etfw">#SpaceTourism</a> <a href="https://twitter.com/hashtag/NewFrontier?src=hash&ref_src=twsrc%5Etfw">#NewFrontier</a><br>Global carbon emissions have decreased due to widespread adoption of green technologies. <a href="https://twitter.com/hashtag/ClimateAction?src=hash&ref_src=twsrc%5Etfw">#ClimateAction</a> <a href="https://twitter.com/hashtag/GreenTech?src=hash&ref_src=twsrc%5Etfw">#GreenTech</a></p>— Liu Luz (@LiuLuz581593) <a href="https://twitter.com/LiuLuz581593/status/1949495160095830164?ref_src=twsrc%5Etfw">July 27, 2025</a></blockquote>'
    }
            ],
            zeitungsartikel: [
    {
        'title': "Weltraumtourismus, der neue Trend",
        'snippet': "Weltraumtourismus ist mehr als ein PR-Gag für Superreiche. Er markiert einen Paradigmenwechsel in der Raumfahrt: von staatlich gelenkter Forschung zu kommerziell geprägter Exploration. Auch wenn heute nur Wenige teilnehmen können, werden die technologischen Fortschritte, die Wettbewerbsdynamik und das wachsende Interesse auf lange Sicht dafür sorgen, dass das All immer näher rückt – nicht nur physisch, sondern auch emotional und kulturell.",
        'link': "https://finanzkun.de/artikel/weltraumtourismus-der-neue-trend/",
        'date': "11.04.2025",
        'readTime': "4 Minuten",
        'journal': "FinanzKun.de kompetent.transparent.informativ."
    },
    {
        'title': "Müssen wir zuerst die Probleme auf der Erde lösen bevor wir uns auf den Weg in den Weltraum machen?",
        'snippet': "Kurz gesagt: Ich bin der Meinung, dass sich die Frage „Müssen wir zuerst die Probleme auf der Erde lösen bevor wir uns auf den Weg in den Weltraum machen?“ gar nicht erst stellt. Wir müssen die Probleme lösen, ja! Aber der Weg spielt keine Rolle. Die Ressourcen die wir in eine etwaige Erforschung des Weltraums stecken sind nicht verschwendet, weil sie am Ende dabei helfen, die Probleme auf der Erde zu lösen. Und umgekehrt gilt das gleiche. Je mehr Wege wir bei der Lösung dieser Probleme verfolgen, desto besser! Und am Ende waren wir Menschen immer dann am erfolgreichsten, wenn wir unserer Neugier und unserer Faszination gefolgt sind…",
        'link': "https://astrodicticum-simplex.at/2017/03/muessen-wir-zuerst-die-probleme-auf-der-erde-loesen-bevor-wir-uns-auf-den-weg-in-den-weltraum-machen/",
        'date': "20.03.2017",
        'readTime': "3 Minuten",
        'journal': "Astrodicticum Simplex"
    },
    {
        'title': "Der hohe Preis des Weltraumtourismus",
        'snippet': "Reiter bleibt in Bezug auf künftigen Weltraumtourismus aber zuversichtlich: „Unser Wunsch wäre es, dass möglichst viele Menschen eher heute als morgen die Gelegenheit bekommen, unseren schönen blauen Planeten von oben zu sehen“, so der ehemalige Astronaut. Wird der Faktor Nachhaltigkeit beim Weltraumtourismus mitgedacht, könnte er in Reiters Augen nämlich noch eine Sache bewirken: „Ein Bewusstsein für die Umwelt, für den Klimawandel und für die Schützenswürdigkeit unseres Planeten – das ist etwas, das man dort oben sehr eindringlich erlangen kann.“",
        'link': "https://nationalgeographic.de/reise-und-abenteuer/2021/09/der-hohe-preis-des-weltraumtourismus/",
        'date': "02.09.2021",
        'readTime': "6 Minuten",
        'journal': "National Geographic"
    },
    {
        'title': "Die Rolle des Weltraumtourismus in der modernen Raumfahrt",
        'snippet': "Der Weltraumtourismus spricht sowohl innere Antriebe wie Neugier und den Wunsch nach Ruhm an, als auch äußere Reize wie die Aussicht auf die Erde aus dem All und das Gefühl der Schwerelosigkeit. Diese Kombination aus inneren und äußeren Faktoren macht den Reiz des Weltraumtourismus aus.",
        'link': "https://www.it-boltwise.de/die-rolle-des-weltraumtourismus-in-der-modernen-raumfahrt.html",
        'date': "19.05.2025",
        'readTime': "3 Minuten",
        'journal': "IT BOLTWISE"
    },
    {
        'title': "Urlaub im All?",
        'snippet': "Reisewarnungen und geschlossene Grenzen – nicht erst seit der Coronapandemie klingt die Vorstellung verlockend, einmal alles auf der Erde hinter sich lassen zu können. Doch wie realistisch ist Space Tourism? ÖAW-Weltraumexperte Günter Kargl erzählt im Interview, wo die Weltraumreise derzeit hingeht – und warum Ferien am Mond Zukunftsmusik bleiben werden.",
        'link': "https://www.oeaw.ac.at/news/urlaub-im-all",
        'date': "28.09.2020",
        'readTime': "3 Minuten",
        'journal': "Österreichische Akademie der Wissenschaften"
    }
            ],
            chatbot: [] 
        },
    };

    function formatDate(dateString) {
        const months = {
            "JAN": "01", "FEB": "02", "MÄR": "03", "APR": "04", "MAI": "05", "JUN": "06",
            "JUL": "07", "AUG": "08", "SEP": "09", "OKT": "10", "NOV": "11", "DEZ": "12",
            "JANUARY": "01", "FEBRUARY": "02", "MARCH": "03", "APRIL": "04", "MAY": "05", "JUNE": "06",
            "JULY": "07", "AUGUST": "08", "SEPTEMBER": "09", "OCTOBER": "10", "NOVEMBER": "11", "DECEMBER": "12"
        };

        let match = dateString.match(/([A-ZÄÖÜ]+)\s+(\d{1,2}),?\s+(\d{4})/i);
        if (match) {
            const day = match[2].padStart(2, '0');
            const month = months[match[1].toUpperCase()];
            const year = match[3];
            if (month) return `${day}.${month}.${year}`;
        }

        match = dateString.match(/(\d{1,2})\s*(\.|\s)([A-ZÄÖÜa-z]{3}|\d{1,2})\s*(\.|\s)(\d{4})/);
        if (match) {
            let day = match[1].padStart(2, '0');
            let month = match[3];
            let year = match[5];

            if (isNaN(month)) {
                month = months[month.toUpperCase()];
            } else {
                month = month.padStart(2, '0');
            }
            if (month) return `${day}.${month}.${year}`;
        }

        return dateString;
    }


    function displayMeme(memeData) {
        contentArea.innerHTML = '';

        const memeDiv = document.createElement('div');
        memeDiv.classList.add('content-item');
        memeDiv.innerHTML = `
            <h3>${memeData.title}</h3>
            <img src="${memeData.image}" alt="${memeData.title}" style="max-width: 100%; height: auto; display: block; margin: 15px auto; border-radius: 4px;">
        `;
        contentArea.appendChild(memeDiv);
        currentDisplayedMeme = memeData;
    }

    function showMemeGenerationPrompt() {
        contentArea.innerHTML = `<p style="text-align: center; margin-top: 20px;">${loadingMessages.memes.notFoundPrompt}</p>`;
        const generateButton = document.createElement('button');
        generateButton.textContent = "Ja, bitte";
        generateButton.classList.add('option-btn');
        generateButton.style.marginTop = '20px';
        generateButton.addEventListener('click', () => {
            if (!isMemeGenerationActive) {
                startMemeGenerationProcess();
            }
        });
        contentArea.appendChild(generateButton);
    }

    function startMemeGenerationProcess() {
        if (isMemeGenerationActive) {
            console.log("Meme generation already active. Ignoring request.");
            return;
        }

        isMemeGenerationActive = true;
        showLoadingScreen('memes', 'creating'); // Zeigt die "Erstelle Meme..." Nachricht

        showMemeNotification(loadingMessages.memes.creating2, 'loading');

        if (memesArrayForGeneration.length === 0) {
            memesArrayForGeneration = shuffleArray(allThemesContentData[currentThemeKey].memes);
        }

        if (memeGenerationTimeoutId) {
            clearTimeout(memeGenerationTimeoutId);
            memeGenerationTimeoutId = null;
        }

        memeGenerationTimeoutId = setTimeout(() => {
            isMemeGenerationActive = false;
            memeGenerationTimeoutId = null;

            if (memesArrayForGeneration.length > 0) {
                generatedMemeBuffer = memesArrayForGeneration.shift();
                // NEU: Globale Notification aktualisieren
                showMemeNotification("Dein Meme ist fertig!", 'success', true); // Klickbar machen
            } else {
                generatedMemeBuffer = null;
                // NEU: Globale Notification aktualisieren
                showMemeNotification(loadingMessages.memes.allShown, 'info', false); // Nicht klickbar
            }

            const currentContent = contentArea.querySelector('#loadingMessageText');
            if (currentContent && currentContent.textContent.includes(loadingMessages.memes.creating)) {
                if (generatedMemeBuffer) {
                    displayMeme(generatedMemeBuffer);
                    askForAnotherMemePrompt();
                    generatedMemeBuffer = null;
                } else {
                    contentArea.innerHTML = `<p style="text-align: center; margin-top: 20px;">${loadingMessages.memes.allShown}</p>`;
                }
            } else {
                console.log("Meme generated in background, waiting for user to return to Memes category.");
            }
        }, 60000);
    }

    function askForAnotherMemePrompt() {
        if (memesArrayForGeneration.length > 0) {
            const askAgainDiv = document.createElement('div');
            askAgainDiv.style.textAlign = 'center';
            askAgainDiv.style.marginTop = '20px';
            askAgainDiv.innerHTML = `<p>${loadingMessages.memes.askAgain}</p>`;

            const yesButton = document.createElement('button');
            yesButton.textContent = "Ja, bitte";
            yesButton.classList.add('option-btn');
            yesButton.addEventListener('click', () => {
                if (!isMemeGenerationActive) {
                    startMemeGenerationProcess();
                }
            });

            askAgainDiv.appendChild(yesButton);
            contentArea.appendChild(askAgainDiv);
        } else {
            contentArea.innerHTML += `<p style="text-align: center; margin-top: 20px;">${loadingMessages.memes.allShown}</p>`;
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

        contentArea.innerHTML = '';


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

        if (category === 'videos') {
            const videoMessageDiv = document.createElement('div');
            videoMessageDiv.classList.add('video-top-message');
            videoMessageDiv.innerHTML = `
                <p>Swipe im Videoplayer nach unten, um weitere Kurzvideos zu entdecken.</p>
            `;
            contentArea.appendChild(videoMessageDiv); // Füge die Nachricht zuerst hinzu

            const videoPlayerContainer = document.createElement('div');
            videoPlayerContainer.classList.add('video-player-container');

            const videosToInit = [];

            const videos = shuffleArray([...allThemesContentData[currentThemeKey].videos]);


            videoIntersectionObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    const playerId = entry.target.querySelector('.youtube-player-placeholder').id;
                    const player = youtubePlayers[playerId];

                    if (!player || !player.muteButtonElement) {
                        console.warn(`Player ${playerId} oder zugehörige Buttons nicht gefunden oder nicht bereit für IntersectionObserver.`);
                        return;
                    }

                    if (entry.isIntersecting && entry.intersectionRatio >= 0.8) {
                        if (currentPlayingVideoPlayer && currentPlayingVideoPlayer !== player) {
                            console.log(`Stopping player ${currentPlayingVideoPlayer.h.id}`);
                            currentPlayingVideoPlayer.pauseVideo();
                            currentPlayingVideoPlayer.seekTo(0);
                        }

                        if (player.getPlayerState() !== YT.PlayerState.PLAYING) {
                            console.log(`Playing player ${playerId}`);
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
                    } else if (!entry.isIntersecting && player.getPlayerState() === YT.PlayerState.PLAYING) {
                        console.log(`Pausing player ${playerId} because it's out of view.`);
                        player.pauseVideo();
                        if (currentPlayingVideoPlayer === player) {
                            currentPlayingVideoPlayer = null;
                        }
                    }
                });
            }, {
                root: videoPlayerContainer,
                rootMargin: '0px',
                threshold: 0.8
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


            contentArea.appendChild(videoPlayerContainer);

            videosToInit.forEach(videoData => {
                if (youtubeAPIReady) {
                    initializeYouTubePlayer(videoData);
                } else {
                    videoInitializationQueue.push(videoData);
                }
            });

            if (videosToInit.length > 0) {
                setTimeout(() => {
                    const firstVideoPlayer = youtubePlayers[videosToInit[0].id];
                    if (firstVideoPlayer && typeof firstVideoPlayer.playVideo === 'function') {
                        console.log('Manually playing first video');
                        firstVideoPlayer.playVideo();
                        currentPlayingVideoPlayer = firstVideoPlayer;

                        if (isGloballyMuted) {
                            firstVideoPlayer.mute();
                            if (firstVideoPlayer.muteButtonElement) firstVideoPlayer.muteButtonElement.innerHTML = volumeOffSvg;
                        } else {
                            firstVideoPlayer.unMute();
                            firstVideoPlayer.setVolume(10);
                            if (firstVideoPlayer.muteButtonElement) firstVideoPlayer.muteButtonElement.innerHTML = volumeUpSvg;
                        }
                    }
                }, 100);
            }

            return;
        }


        const items = allThemesContentData[currentThemeKey] ? allThemesContentData[currentThemeKey][category] : null;

        if (!items || items.length === 0) {
            contentArea.innerHTML = `<p>Leider keine ${category}-Beiträge zum Thema "${themeInput.value}" gefunden.</p>`;
            return;
        }

        switch (category) {
case 'memes':
            // Prüfe, ob eine Generierung aktiv ist (höchste Priorität, da Ladebildschirm angezeigt werden muss)
            if (isMemeGenerationActive) {
                showLoadingScreen(category, 'creating');
                showMemeNotification(loadingMessages.memes.creating, 'loading');
                return;
            }

            // Prüfe, ob ein Meme im Puffer ist (wurde im Hintergrund generiert und wartet auf Anzeige)
            if (generatedMemeBuffer) {
                contentArea.innerHTML = ''; // Leere den Bereich für das neue Meme
                displayMeme(generatedMemeBuffer); // Zeigt das neue Meme an (und setzt currentDisplayedMeme)
                askForAnotherMemePrompt(); // Fügt den "Noch ein Meme?"-Prompt hinzu
                generatedMemeBuffer = null; // Puffer leeren
                hideMemeNotification(); // Notification ausblenden
                return;
            }

            // Prüfe, ob es ein zuletzt angezeigtes Meme gibt
            if (currentDisplayedMeme) {
                // Überprüfe, ob das Meme bereits im DOM ist, um unnötiges Neurendern zu vermeiden
                const memeImageInDOM = contentArea.querySelector(`img[src="${currentDisplayedMeme.image}"]`);

                if (!memeImageInDOM) {
                    // Wenn das Meme nicht im DOM ist (z.B. nach Kategoriewechsel), render es neu
                    contentArea.innerHTML = ''; // Bereich leeren, bevor das Meme neu hinzugefügt wird
                    displayMeme(currentDisplayedMeme);
                }
                // Füge immer den "Noch ein Meme?"-Prompt oder die "Alle gezeigt"-Nachricht hinzu
                askForAnotherMemePrompt();
                hideMemeNotification(); // Notification ausblenden
                return; // Beende hier, da das Meme nun sichtbar ist und der Prompt korrekt gesetzt wurde
            }

            // Wenn keine der obigen Bedingungen zutrifft (z.B. erster Klick auf Memes, oder alle Memes durch und kein currentDisplayedMeme gespeichert)
            // Dann initialisiere das Array, wenn es leer ist.
            if (memesArrayForGeneration.length === 0) {
                memesArrayForGeneration = shuffleArray(allThemesContentData[currentThemeKey].memes);
            }

            // Zeige den "Möchtest du erstellen?"-Prompt, wenn noch Memes zum Generieren da sind
            if (memesArrayForGeneration.length > 0) {
                showMemeGenerationPrompt();
                hideMemeNotification();
            } else {
                // Alle Memes sind durch und keine weiteren generierbar (und kein currentDisplayedMeme zu zeigen)
                contentArea.innerHTML = `<p style="text-align: center; margin-top: 20px;">${loadingMessages.memes.allShown}</p>`;
                showMemeNotification(loadingMessages.memes.allShown, 'info', false);
            }
            break; // Ende des 'memes'-Case
            case 'postings':
                items.forEach(item => {
                    if (item.type === 'twitter') {
                        const tweetWrapper = document.createElement('div');
                        tweetWrapper.classList.add('content-item');
                        tweetWrapper.innerHTML = item.html;
                        contentArea.appendChild(tweetWrapper);
                    }
                });
                loadTwitterWidgets(contentArea);
                break;
            case 'zeitungsartikel':
                items.forEach(item => {
                    const articleDiv = document.createElement('div');
                    articleDiv.classList.add('content-item');
                    articleDiv.innerHTML = `
                        <h3>${item.title}</h3>
                        <p>${item.snippet}</p>
                        <p class="article-meta">
                            Veröffentlicht: <strong>${formatDate(item.date)}</strong> |
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

    window.onYouTubeIframeAPIReady = function() {
        console.log('YouTube API is ready!');
        youtubeAPIReady = true;
        while (videoInitializationQueue.length > 0) {
            const videoData = videoInitializationQueue.shift();
            initializeYouTubePlayer(videoData);
        }
    };

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

        console.log(`Player ${videoData.id} initialization attempted for video ID ${videoData.videoId}.`);
    }

    function onPlayerReady(event, muteButtonElement) {
        console.log(`Player ${event.target.h.id} is ready.`);
        if (muteButtonElement) {
            muteButtonElement.addEventListener('click', () => toggleMute(event.target, muteButtonElement));
            if (isGloballyMuted) {
                event.target.mute();
                muteButtonElement.innerHTML = volumeOffSvg;
            } else {
                event.target.unMute();
                event.target.setVolume(10);
                muteButtonElement.innerHTML = volumeUpSvg;
            }
        }
    }

    function onPlayerStateChange(event, muteButtonElement) {
        const playerId = event.target.h.id;
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
        console.error(`YouTube Player Error for ${event.target.h.id}:`, event.data);
        const errorElement = document.getElementById(event.target.h.id);
        if (errorElement && errorElement.parentNode) {
            const videoData = allThemesContentData[currentThemeKey].videos.find(v => v.embedUrl.includes(event.target.getVideoData().video_id));
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
            } else if (!currentThemeLoadedCategories.has(category)) {
                showLoadingScreen(category);

                if (category === 'videos' && Array.isArray(loadingMessages.videos)) {
                    const loadingMessageTextElement = document.getElementById('loadingMessageText');
                    setTimeout(() => {
                        if (loadingMessageTextElement && loadingMessages.videos.length > 1) {
                            loadingMessageTextElement.textContent = loadingMessages.videos[1];
                        }
                    }, 2500);
                }

                currentMainLoadingTimeoutId = setTimeout(() => {
                    if (allThemesContentData[currentThemeKey] && allThemesContentData[currentThemeKey].videos) {
                        allThemesContentData[currentThemeKey].videos = shuffleArray(allThemesContentData[currentThemeKey].videos);
                    }
                    displayContent(category);
                    currentThemeLoadedCategories.add(category);

                    if (category === 'videos' && mainContainer) {
                        setTimeout(() => {
                           const targetScrollPosition = mainContainer.offsetTop + mainContainer.offsetHeight - window.innerHeight + 20;

                           window.scrollTo({
                               top: targetScrollPosition > 0 ? targetScrollPosition : 0,
                               behavior: 'smooth'
                           });
                        }, 500);
                    }
                    currentMainLoadingTimeoutId = null;
                }, 5000);
            } else { // Wenn Kategorie bereits geladen
                // NEU: Logik für Memes-Kategorie
                if (category === 'memes') {
                    // Wenn ein Meme bereits fertig generiert wurde (im Puffer)
                    if (generatedMemeBuffer) {
                        displayMeme(generatedMemeBuffer);
                        askForAnotherMemePrompt();
                        generatedMemeBuffer = null;
                        isMemeGenerationActive = false;
                        hideMemeNotification(); // Notification ausblenden, da Meme jetzt angezeigt wird
                    }
                    // Wenn eine Generierung läuft (aber das Meme noch nicht im Puffer ist)
                    else if (isMemeGenerationActive) {
                        showLoadingScreen(category, 'creating');
                        showMemeNotification(loadingMessages.memes.creating, 'loading'); // Notification erneut anzeigen
                    }
                    // Wenn keine Generierung läuft und kein Meme im Puffer ist (alle durch oder erster Klick nach Reset)
                    else {
                        if (memesArrayForGeneration.length === 0) {
                            memesArrayForGeneration = shuffleArray(allThemesContentData[currentThemeKey].memes);
                        }
                        if (memesArrayForGeneration.length > 0) {
                            showMemeGenerationPrompt();
                            hideMemeNotification(); // Notification ausblenden, da der Prompt gezeigt wird
                        } else {
                            contentArea.innerHTML = `<p style="text-align: center; margin-top: 20px;">${loadingMessages.memes.allShown}</p>`;
                            showMemeNotification(loadingMessages.memes.allShown, 'info', false);
                        }
                    }
                } else { // Für alle anderen Kategorien
                    displayContent(category);
                }
            }
        });
    });

    contentArea.innerHTML = '<p>Wähle eine Option, um Beiträge zum Thema Weltraumtourismus zu sehen.</p>';
    resetContentAreaStyles();

    // Initial die Notification verstecken
    hideMemeNotification();
});