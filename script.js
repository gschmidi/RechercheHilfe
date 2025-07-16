document.addEventListener('DOMContentLoaded', () => {
    const contentArea = document.getElementById('contentArea');
    const buttons = document.querySelectorAll('.option-btn');
    const themeInput = document.getElementById('themeInput');
    
    let twitterWidgetsLoaded = false;

    const loadedCategoriesPerTheme = {}; 

    const currentThemeKey = themeInput.value.toLowerCase(); 

    const loadingMessages = {
        memes: "Durchsuche das Netz nach humorvollen Memes...",
        videos: "Finde spannende Videos...",
        postings: "Durchstöbere X (Twitter) nach aktuellen Beiträgen...",
        zeitungsartikel: "Scanne Online-Archive nach relevanten Zeitungsartikeln...",
        chatbot: "Verbinde mit dem Experten für Weltraumtourismus..." 
    };

    function showLoadingScreen(category) {
        contentArea.innerHTML = `
            <div class="loading-overlay">
                <div class="spinner"></div>
                <p class="loading-message">${loadingMessages[category] || "Wird geladen..."}</p>
            </div>
        `;
    }

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
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array; 
    }

    const allThemesContentData = {
        "weltraumtourismus": { 
            memes: [
                {
                    title: "Geld",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQje7iaxTA9hePh4WB2kMZEd49oTn2PqLVMWQ&s", 
                    caption: "Kommentar" 
                },
                {
                    title: "Space-Visit-Meme",
                    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQdm9RU-WH5IZMhWartn-SiOClmJAwnqsPpqw&s", 
                    caption: "Kommentar2"
                }
            ],
            videos: [
                {
                    title: "SpaceX Starship Catch",
                    embedUrl: "https://www.youtube.com/embed/Gi3ZcH7g_9c", 
                    description: "Ein beeindruckendes Video vom Auffangen des Starshipslaunchers, ein Schlüssel zur Zukunft des Weltraumtourismus."
                },
                {
                    title: "Starship - Fünfter Testflug",
                    embedUrl: "https://www.youtube.com/embed/hI9HQfCAw64?si=P5wv2IIXw9x_QanA", 
                    description: "Kommentar"
                }
            ],
            postings: [
                {
                    type: 'twitter',
                    html: `<blockquote class="twitter-tweet" data-dnt="true"><p lang="en" dir="ltr">Space tourism is no longer just a dream. With new developments, reaching the stars might be closer than we think! Imagine gazing down at Earth from above and experiencing the universe firsthand. We&#39;re on the verge of a whole new adventure. The sky is not the limit!</p>&mdash; Gu4rdIr0n (@GabrielaLa33599) <a href="https://twitter.com/GabrielaLa33599/status/1943261716873416929?ref_src=twsrc%5Etfw">July 10, 2025</a></blockquote>`
                }
            ],
            zeitungsartikel: [
                {
                    title: "Schweben statt schwimmen",
                    snippet: "Bislang sind es hauptsächlich Superreiche, die sich einen Weltraumflug leisten können. Und zuletzt ist Weltraumtourismus auch eine gesundheitliche Frage, denn ein Urlaub im All ist etwas grundlegend Anderes als ein Urlaub am Strand. Schwerelosigkeit stellt einen Ausnahmezustand für den Körper dar, der die Reise weitaus unangenehmer macht, als von den meisten Menschen angenommen – und vieles ist aus medizinischer Sicht noch ungewiss. Mit mehr Unterstützung kann die Weltraummedizin nicht nur den Weltraumtourismus ankurbeln, sondern auch Innovationen vorantreiben, die den Alltag aller bereichern.",
                    link: "https://www.derpragmaticus.com/r/weltraumtourismus"
                }
            ],
            chatbot: [] // Daten für Chatbot sind leer, da der Inhalt fest im HTML eingebettet wird
        },
    };

    function displayContent(category) {
        contentArea.innerHTML = ''; 

        // Spezielle Behandlung für die Chatbot-Kategorie
        if (category === 'chatbot') {
            contentArea.innerHTML = `
                <!-- HIER DEN CHATBOT EINFÜGEN -->
                <iframe 
                    src="chat-app.html"
                    title="Experten-Chat zum Weltraumtourismus"
                    style="width: 100%; height: 95vh; border: 1px solid #ccc; border-radius: 8px; overflow: hidden;"
                ></iframe>
            `;
const iframeElement = contentArea.querySelector('iframe');
if (iframeElement) {
    iframeElement.focus({ preventScroll: true });
}
// Oder, wenn der contentArea selbst das Problem ist:
contentArea.focus({ preventScroll: true });
            return; // Beende die Funktion hier, da der Inhalt direkt eingefügt wurde
        }

        // Für alle anderen Kategorien
        const items = allThemesContentData[currentThemeKey] ? allThemesContentData[currentThemeKey][category] : null;

        if (!items || items.length === 0) {
            contentArea.innerHTML = `<p>Leider keine ${category}-Beiträge zum Thema "${themeInput.value}" gefunden.</p>`;
            return;
        }

        switch (category) {
            case 'memes':
                items.forEach(item => {
                    const memeDiv = document.createElement('div');
                    memeDiv.classList.add('content-item');
                    memeDiv.innerHTML = `
                        <h3>${item.title}</h3>
                        <img src="${item.image}" alt="${item.title}">
                        <p>${item.caption}</p>
                    `;
                    contentArea.appendChild(memeDiv);
                });
                break;
            case 'videos':
                items.forEach(item => {
                    const videoDiv = document.createElement('div');
                    videoDiv.classList.add('content-item');
                    videoDiv.innerHTML = `
                        <h3>${item.title}</h3>
                        <iframe src="${item.embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                        <p>${item.description}</p>
                    `;
                    contentArea.appendChild(videoDiv);
                });
                break;
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
                        <a href="${item.link}" target="_blank" class="zeitungsartikel-link">Artikel lesen</a>
                    `;
                    contentArea.appendChild(articleDiv);
                });
                break;
            default:
                contentArea.innerHTML = '<p>Diese Kategorie existiert nicht.</p>';
        }
    }

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const category = button.id.replace('btn', '').toLowerCase();

            // Initialisiere das Set für das aktuelle Thema, falls noch nicht vorhanden
            if (!loadedCategoriesPerTheme[currentThemeKey]) { 
                loadedCategoriesPerTheme[currentThemeKey] = new Set(); 
            }
            const currentThemeLoadedCategories = loadedCategoriesPerTheme[currentThemeKey]; 

            // NEU: Sofortiges Laden für Chatbot beim ersten Klick
            if (category === 'chatbot') {
                displayContent(category);
                currentThemeLoadedCategories.add(category); // Markiere als geladen
            } else if (!currentThemeLoadedCategories.has(category)) {
                // Für andere Kategorien: Ladebildschirm und Verzögerung
                showLoadingScreen(category);

                setTimeout(() => {
                    if (allThemesContentData[currentThemeKey] && allThemesContentData[currentThemeKey][category]) { 
                        shuffleArray(allThemesContentData[currentThemeKey][category]); 
                    }
                    displayContent(category);
                    currentThemeLoadedCategories.add(category);
                }, 5000); 
            } else {
                // Wenn bereits geladen (und nicht Chatbot), direkt anzeigen
                displayContent(category);
            }
        });
    });

    // Initialisiere den Content Area Text beim Laden der Seite
    contentArea.innerHTML = '<p>Wähle eine Option, um Beiträge zum Thema Weltraumtourismus zu sehen.</p>';
});