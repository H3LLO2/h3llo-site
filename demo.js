document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const demoForm = document.getElementById('demo-form');
    const userMessageInput = document.getElementById('user-message');
    const charCount = document.getElementById('char-count');
    const uploadArea = document.getElementById('upload-area');
    const imageUploadInput = document.getElementById('image-upload');
    const imagePreviewsContainer = document.getElementById('image-previews');
    const submitBtn = document.getElementById('submit-btn');
    const errorMessage = document.getElementById('error-message');
    const attemptCounterDisplay = document.getElementById('attempt-counter');

    // Modal DOM Elements
    const signupModal = document.getElementById('signup-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const signupForm = document.getElementById('signup-form');
    const modalNameInput = document.getElementById('modal-name'); // Added for Name field
    const modalEmailInput = document.getElementById('modal-email');
    const modalCompanyInput = document.getElementById('modal-company');
    const modalConsentCheckbox = document.getElementById('modal-consent');
    const modalErrorMessage = document.getElementById('modal-error-message');
    const modalSubmitBtn = document.getElementById('modal-submit-btn');

    const inputSection = document.getElementById('demo-input-section');
    const outputSection = document.getElementById('demo-output-section');
    const loadingIndicator = document.getElementById('loading-indicator');
    const outputContent = document.getElementById('output-content');

    const facebookText = document.getElementById('facebook-text');
    const facebookImages = document.getElementById('facebook-images');
    const instagramText = document.getElementById('instagram-text');
    // const instagramCarousel = document.getElementById('instagram-carousel'); // Referenced in displayResults
    const tryAgainBtn = document.getElementById('try-again-btn');
    const currentYearDemo = document.getElementById('current-year-demo');

    // --- Constants & State ---
    const MAX_IMAGES = 1;
    const MAX_FILE_SIZE_MB = 3;
    const MAX_ATTEMPTS = 1; // For the initial free try
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
    let uploadedFiles = [];
    let attemptsMade = 0; // Tracks the initial free try
    let overrideLimit = false;

    const USER_ACCESS_KEY = 'h3lloDemoUserAccess';
    const FREE_TRY_DATA_KEY = 'h3lloDemoData';

    // --- Initial Setup ---
    const urlParams = new URLSearchParams(window.location.search);
    overrideLimit = urlParams.get('override') === 'true';

    if (currentYearDemo) {
        currentYearDemo.textContent = new Date().getFullYear();
    }

    if (!overrideLimit) {
        const twoHours = 2 * 60 * 60 * 1000;
        let demoData = null;
        try {
            const storedData = localStorage.getItem(FREE_TRY_DATA_KEY);
            if (storedData) {
                demoData = JSON.parse(storedData);
            }
        } catch (e) {
            console.error("Error parsing free try data from localStorage", e);
            demoData = null;
        }

        const now = Date.now();
        if (demoData && demoData.timestamp && typeof demoData.attempts === 'number') {
            const timeDiff = now - demoData.timestamp;
            if (timeDiff < twoHours) {
                attemptsMade = demoData.attempts;
            } else {
                attemptsMade = 0;
                localStorage.setItem(FREE_TRY_DATA_KEY, JSON.stringify({ attempts: attemptsMade, timestamp: now }));
            }
        } else {
            attemptsMade = 0;
            localStorage.setItem(FREE_TRY_DATA_KEY, JSON.stringify({ attempts: attemptsMade, timestamp: now }));
        }
    }

    updateAttemptCounterDisplay();
    checkFormValidity();

    // --- Modal Event Listeners ---
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', hideSignupModal);
    if (signupForm) signupForm.addEventListener('submit', handleSignupFormSubmit);
    if (signupModal) {
        signupModal.addEventListener('click', (event) => {
            if (event.target === signupModal) hideSignupModal();
        });
    }

    // --- Existing Event Listeners ---
    if (userMessageInput) {
        userMessageInput.addEventListener('input', () => {
            const currentLength = userMessageInput.value.length;
            if (charCount) charCount.textContent = `${currentLength} / 200`;
            checkFormValidity();
        });
    }


    // --- Dynamic Placeholder Logic ---
    const placeholderExamples = [
        "Nye forårsjakker!", "Weekendtilbud: -20%!", "Åbent til kl. 18 i dag!",
        "Friskbagte croissanter klar nu! 🥐", "Udsalg på alle sommerjakker - spar 30%!",
        "Kaffe + croissant kun 35 kr. indtil kl. 11!", "Live musik på lørdag!"
    ];
    let placeholderInterval = null;
    let currentPlaceholderIndex = 0;
    const defaultPlaceholder = userMessageInput ? userMessageInput.placeholder : "";

    function startPlaceholderRotation() {
        if (!userMessageInput) return;
        if (placeholderInterval) return;
        if (userMessageInput.value.trim() !== '') return;

        const initialPlaceholder = placeholderExamples[currentPlaceholderIndex] + '|';
        userMessageInput.placeholder = initialPlaceholder;
        userMessageInput.classList.remove('placeholder-hiding');
        placeholderInterval = setInterval(() => {
            userMessageInput.placeholder = userMessageInput.placeholder.replace('|', '');
            userMessageInput.classList.add('placeholder-hiding');
            setTimeout(() => {
                currentPlaceholderIndex = (currentPlaceholderIndex + 1) % placeholderExamples.length;
                const newPlaceholder = placeholderExamples[currentPlaceholderIndex] + '|';
                userMessageInput.placeholder = newPlaceholder;
                userMessageInput.classList.remove('placeholder-hiding');
            }, 250);
        }, 3500);
    }

    function stopPlaceholderRotation(restoreDefault = true) {
        if (!userMessageInput) return;
        clearInterval(placeholderInterval);
        placeholderInterval = null;
        userMessageInput.classList.remove('placeholder-hiding');
        if (restoreDefault) {
            userMessageInput.placeholder = defaultPlaceholder;
        } else {
            userMessageInput.placeholder = userMessageInput.placeholder.replace('|', '');
        }
    }
    if (userMessageInput) {
        userMessageInput.addEventListener('focus', () => stopPlaceholderRotation(false));
        userMessageInput.addEventListener('input', () => {
            if (userMessageInput.value.trim() !== '') {
                stopPlaceholderRotation(true);
            } else {
                setTimeout(() => {
                    if (userMessageInput.value.trim() === '' && document.activeElement !== userMessageInput) {
                        startPlaceholderRotation();
                    }
                }, 500);
            }
        });
        userMessageInput.addEventListener('blur', () => {
            if (userMessageInput.value.trim() === '') startPlaceholderRotation();
        });
        startPlaceholderRotation();
    }
    // --- End Dynamic Placeholder Logic ---


    // --- Image Upload Logic ---
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        });
    }
    if (imageUploadInput) {
        imageUploadInput.addEventListener('change', (e) => {
            if (e.target && e.target.files) handleFiles(e.target.files);
            imageUploadInput.value = null;
        });
    }
    // --- End Image Upload Logic ---

    // Form Submission
    if (demoForm) {
        demoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (checkFormValidity() || overrideLimit) {
                 processSubmission();
            } else {
                const freeTryAvailable = attemptsMade < MAX_ATTEMPTS;
                const userAccessData = JSON.parse(localStorage.getItem(USER_ACCESS_KEY));
                const hasExtraTries = userAccessData && userAccessData.triesRemaining > 0;
                if (!freeTryAvailable && !hasExtraTries) {
                    showSignupModal();
                }
            }
        });
    }

    // Try Again Button
    if (tryAgainBtn) tryAgainBtn.addEventListener('click', resetDemo);


    // --- Modal Functions ---
    function showSignupModal() {
        if (signupModal) {
            signupModal.style.display = 'flex';
            if (modalEmailInput) modalEmailInput.focus();
        }
    }

    function hideSignupModal() {
        if (signupModal) {
            signupModal.style.display = 'none';
            if (modalErrorMessage) modalErrorMessage.style.display = 'none';
        }
    }

    async function handleSignupFormSubmit(event) {
        event.preventDefault();
        // Added modalNameInput to the check
        if (!modalNameInput || !modalEmailInput || !modalCompanyInput || !modalConsentCheckbox || !modalSubmitBtn || !modalErrorMessage) return;

        const name = modalNameInput.value.trim(); // Get name value
        const email = modalEmailInput.value.trim();
        const company = modalCompanyInput.value.trim();
        const consentGiven = modalConsentCheckbox.checked;

        // Added validation for name
        if (!name) {
            modalErrorMessage.textContent = 'Indtast venligst dit navn.';
            modalErrorMessage.style.display = 'block';
            return;
        }
        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            modalErrorMessage.textContent = 'Indtast venligst en gyldig e-mailadresse.';
            modalErrorMessage.style.display = 'block';
            return;
        }
        modalErrorMessage.style.display = 'none';
        modalSubmitBtn.disabled = true;
        modalSubmitBtn.textContent = 'Behandler...';

        try {
            const response = await fetch('/api/register-demo-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Added name to the body
                body: JSON.stringify({ name, email, companyName: company, consentGiven })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({ error: 'Ukendt serverfejl ved registrering.' }));
                throw new Error(errData.error || `Serverfejl: ${response.status}`);
            }

            localStorage.setItem(USER_ACCESS_KEY, JSON.stringify({
                email: email,
                triesRemaining: 5,
                consentGiven: consentGiven,
                grantedTimestamp: Date.now()
            }));
            hideSignupModal();
            updateAttemptCounterDisplay();
            checkFormValidity();
            if (submitBtn) submitBtn.textContent = 'Lav Opslag';

        } catch (error) {
            console.error("Signup form error:", error);
            modalErrorMessage.textContent = error.message || 'Der opstod en fejl. Prøv igen.';
            modalErrorMessage.style.display = 'block';
        } finally {
            modalSubmitBtn.disabled = false;
            modalSubmitBtn.textContent = 'Lås op for 5 forsøg';
        }
    }
    // --- End Modal Functions ---


    // --- Core Functions ---
    function handleFiles(files) {
        hideError();
        let currentFileCount = uploadedFiles.length;
        for (const file of files) {
            if (currentFileCount >= MAX_IMAGES) {
                showError(`Du kan højst uploade ${MAX_IMAGES} billeder.`);
                break;
            }
            if (!validateFileType(file)) {
                showError(`Filtype ikke tilladt: ${file.name}. Brug venligst JPG eller PNG.`);
                continue;
            }
            if (!validateFileSize(file)) {
                showError(`Filen er for stor: ${file.name}. Max ${MAX_FILE_SIZE_MB}MB pr. fil.`);
                continue;
            }
            uploadedFiles.push(file);
            createImagePreview(file, uploadedFiles.length - 1);
            currentFileCount++;
        }
        checkFormValidity();
    }

    function validateFileType(file) {
        return ALLOWED_TYPES.includes(file.type);
    }

    function validateFileSize(file) {
        return file.size <= MAX_FILE_SIZE_MB * 1024 * 1024;
    }

    function createImagePreview(file, index) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewWrapper = document.createElement('div');
            previewWrapper.classList.add('img-preview-wrapper');
            previewWrapper.dataset.index = index;

            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = `Preview af ${file.name}`;

            const removeBtn = document.createElement('button');
            removeBtn.classList.add('remove-img-btn');
            removeBtn.textContent = 'X';
            removeBtn.type = 'button';
            removeBtn.onclick = () => removeImage(index);

            previewWrapper.appendChild(img);
            previewWrapper.appendChild(removeBtn);
            if (imagePreviewsContainer) imagePreviewsContainer.appendChild(previewWrapper);
        };
        reader.readAsDataURL(file);
    }

    function removeImage(indexToRemove) {
        uploadedFiles = uploadedFiles.filter((_, i) => i !== indexToRemove);
        if (imagePreviewsContainer) {
            const previewToRemove = imagePreviewsContainer.querySelector(`.img-preview-wrapper[data-index="${indexToRemove}"]`);
            if (previewToRemove) imagePreviewsContainer.removeChild(previewToRemove);

            const remainingPreviews = imagePreviewsContainer.querySelectorAll('.img-preview-wrapper');
            remainingPreviews.forEach((preview, newIndex) => {
                preview.dataset.index = newIndex;
                const btn = preview.querySelector('.remove-img-btn');
                if (btn) btn.onclick = () => removeImage(newIndex);
            });
        }
        checkFormValidity();
        hideError();
    }

    function checkFormValidity() {
        if (!userMessageInput || !submitBtn) return false;

        const messageValid = userMessageInput.value.trim().length > 0;
        const imagesValid = uploadedFiles.length > 0 && uploadedFiles.length <= MAX_IMAGES;

        if (!messageValid || !imagesValid) {
            submitBtn.disabled = true;
            if (attemptCounterDisplay && !attemptCounterDisplay.textContent.includes("overridden")) {
                if (attemptCounterDisplay.innerHTML.includes("Registrer dig") || attemptCounterDisplay.textContent.includes("forsøg")) {
                    attemptCounterDisplay.style.display = 'none';
                }
            }
            return false;
        }

        if (overrideLimit) {
            submitBtn.disabled = false;
            updateAttemptCounterDisplay();
            return true;
        }

        const userAccessData = JSON.parse(localStorage.getItem(USER_ACCESS_KEY));
        const freeTryAvailable = attemptsMade < MAX_ATTEMPTS;

        if (freeTryAvailable) {
            submitBtn.disabled = false;
            updateAttemptCounterDisplay();
            return true;
        }

        if (userAccessData && userAccessData.triesRemaining > 0) {
            submitBtn.disabled = false;
            updateAttemptCounterDisplay();
            return true;
        }

        submitBtn.disabled = true;
        if (attemptCounterDisplay) {
            attemptCounterDisplay.innerHTML = `Dit gratis forsøg er brugt. <a href="#" id="show-signup-modal-link" class="modal-link">Registrer dig</a> for 5 ekstra forsøg.`;
            attemptCounterDisplay.style.color = 'var(--accent-pink)';
            attemptCounterDisplay.style.display = 'block';

            const existingLink = document.getElementById('show-signup-modal-link');
            if (existingLink) {
                const newLink = existingLink.cloneNode(true);
                if (existingLink.parentNode) existingLink.parentNode.replaceChild(newLink, existingLink);
                newLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    showSignupModal();
                });
            }
        }
        return false;
    }

    function processSubmission() {
        hideError();
        if (!submitBtn || !inputSection || !outputSection || !loadingIndicator || !outputContent) return;

        if (!overrideLimit) {
            const freeTryAvailable = attemptsMade < MAX_ATTEMPTS;
            const userAccessData = JSON.parse(localStorage.getItem(USER_ACCESS_KEY));
            const hasExtraTries = userAccessData && userAccessData.triesRemaining > 0;

            if (!freeTryAvailable && !hasExtraTries) {
                showSignupModal();
                updateAttemptCounterDisplay();
                return;
            }
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'AI genererer...';
        if (inputSection) inputSection.style.display = 'none';
        if (outputSection) outputSection.style.display = 'block';
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if (outputContent) outputContent.style.display = 'none';

        fetch('/api/generate-post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userMessage: userMessageInput.value }),
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    throw new Error(errData.error || `HTTP error! status: ${response.status}`);
                }).catch(() => {
                    throw new Error(`HTTP error! status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.result) {
                if (!overrideLimit) {
                    const freeTryWasAvailableAndUsed = attemptsMade < MAX_ATTEMPTS;
                    if (freeTryWasAvailableAndUsed) {
                        attemptsMade++;
                        localStorage.setItem(FREE_TRY_DATA_KEY, JSON.stringify({ attempts: attemptsMade, timestamp: Date.now() }));
                    } else {
                        const userAccessData = JSON.parse(localStorage.getItem(USER_ACCESS_KEY));
                        if (userAccessData && userAccessData.triesRemaining > 0) {
                            userAccessData.triesRemaining--;
                            localStorage.setItem(USER_ACCESS_KEY, JSON.stringify(userAccessData));
                        }
                    }
                }
                displayResults(data.result);
                if (!overrideLimit) {
                    updateAttemptCounterDisplay();
                    checkFormValidity();
                }
            } else {
                throw new Error("Invalid response structure from API.");
            }
        })
        .catch(error => {
            console.error("Error calling backend API:", error);
            showError(`Fejl: ${error.message || 'Kunne ikke generere opslag.'}`);
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            if (submitBtn) submitBtn.textContent = 'Lav Opslag';
            if (inputSection) inputSection.style.display = 'block';
            if (outputSection) outputSection.style.display = 'none';
            checkFormValidity();
        });
    }

    function displayResults(generatedText) {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (outputContent) outputContent.style.display = 'block';
        if (submitBtn) submitBtn.textContent = 'Lav Opslag';

        const fbTextElement = document.getElementById('facebook-text');
        if (fbTextElement) {
            const fbSeeMoreBtn = fbTextElement.nextElementSibling;
            fbTextElement.innerText = generatedText;
            if (fbSeeMoreBtn) setupSeeMore(fbTextElement, fbSeeMoreBtn);
        }

        const facebookImagesContainer = document.getElementById('facebook-images');
        if (facebookImagesContainer) {
            facebookImagesContainer.innerHTML = '';
            uploadedFiles.forEach(file => {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                img.alt = "Uploadet billede";
                facebookImagesContainer.appendChild(img);
            });
            facebookImagesContainer.className = 'post-images';
            if (uploadedFiles.length === 1) {
                facebookImagesContainer.classList.add('single-image');
            }
        }

        const igTextElement = document.getElementById('instagram-text');
        const igCarousel = document.getElementById('instagram-carousel'); // Get it here

        if (igTextElement && igCarousel) {
            const igSeeMoreBtn = igTextElement.nextElementSibling;
            igTextElement.innerText = generatedText;
            if (igSeeMoreBtn) setupSeeMore(igTextElement, igSeeMoreBtn);

            igCarousel.innerHTML = '';

            const slidesWrapper = document.createElement('div');
            slidesWrapper.classList.add('carousel-slides-wrapper');
            const numSlides = uploadedFiles.length;
            slidesWrapper.style.width = `${numSlides * 100}%`;

            uploadedFiles.forEach((file) => {
                const slideDiv = document.createElement('div');
                slideDiv.classList.add('carousel-slide');
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                img.alt = "Uploadet billede";
                slideDiv.appendChild(img);
                slidesWrapper.appendChild(slideDiv);
            });
            igCarousel.appendChild(slidesWrapper);
            slidesWrapper.style.transform = 'translateX(0%)';
            slidesWrapper.dataset.currentSlide = 0; // Initialize current slide index

            if (numSlides > 1) {
                const controls = document.createElement('div');
                controls.classList.add('carousel-controls');
                const prevBtn = document.createElement('button');
                prevBtn.classList.add('prev');
                prevBtn.innerHTML = '‹';
                prevBtn.onclick = () => moveCarousel(-1, slidesWrapper, numSlides, indicators);
                const nextBtn = document.createElement('button');
                nextBtn.classList.add('next');
                nextBtn.innerHTML = '›';
                nextBtn.onclick = () => moveCarousel(1, slidesWrapper, numSlides, indicators);
                controls.appendChild(prevBtn);
                controls.appendChild(nextBtn);
                igCarousel.appendChild(controls);

                const indicators = document.createElement('div');
                indicators.classList.add('carousel-indicators');
                for (let i = 0; i < numSlides; i++) {
                    const dot = document.createElement('span');
                    dot.classList.add('dot');
                    if (i === 0) dot.classList.add('active');
                    // Pass a function that calls moveCarousel with the correct index for this dot
                    dot.onclick = ((slideIndex) => {
                        return () => {
                            // Calculate direction based on current and target
                            const currentSlide = parseInt(slidesWrapper.dataset.currentSlide || 0);
                            moveCarousel(slideIndex - currentSlide, slidesWrapper, numSlides, indicators);
                        };
                    })(i);
                    indicators.appendChild(dot);
                }
                igCarousel.appendChild(indicators);
            }
        }
        const postDemoCta = document.getElementById('post-demo-cta');
        if (postDemoCta) {
            postDemoCta.style.display = 'block';
        }
    }

    let currentIgSlideIndex = 0; // Renamed for clarity

    function moveCarousel(direction, slidesWrapper, numSlides, indicatorsContainer) {
        if (!slidesWrapper || numSlides <= 1) return;

        let newIndex = parseInt(slidesWrapper.dataset.currentSlide || 0) + direction;

        if (newIndex < 0) {
            newIndex = numSlides - 1;
        } else if (newIndex >= numSlides) {
            newIndex = 0;
        }
        
        // Calculate the percentage for translateX. Each slide is 100% / numSlides of the wrapper.
        // So to show slide `newIndex`, we translate by `newIndex * (100 / numSlides)`.
        // Since the slidesWrapper itself is `numSlides * 100%` wide, and each slide inside it is `100% / numSlides` of that.
        // Simpler: each slide is 100% of the *viewport* of the carousel. So we translate by `newIndex * 100%` of viewport.
        slidesWrapper.style.transform = `translateX(-${newIndex * 100}%)`;
        slidesWrapper.dataset.currentSlide = newIndex;
        currentIgSlideIndex = newIndex; // Update global tracker if needed elsewhere

        if (indicatorsContainer) {
            const dots = indicatorsContainer.querySelectorAll('.dot');
            dots.forEach((dot, idx) => {
                dot.classList.toggle('active', idx === newIndex);
            });
        }
    }


    function resetDemo() {
        if (userMessageInput) userMessageInput.value = '';
        if (charCount) charCount.textContent = '0 / 200';
        if (imagePreviewsContainer) imagePreviewsContainer.innerHTML = '';
        uploadedFiles = [];

        hideError();
        if (inputSection) inputSection.style.display = 'block';
        if (outputSection) outputSection.style.display = 'none';
        const postDemoCta = document.getElementById('post-demo-cta');
        if (postDemoCta) {
            postDemoCta.style.display = 'none';
        }
        if (submitBtn) submitBtn.textContent = 'Lav Opslag';

        updateAttemptCounterDisplay();
        checkFormValidity();
        if (userMessageInput) startPlaceholderRotation();
    }

    function setupSeeMore(textElement, buttonElement) {
        if (!textElement || !buttonElement) return;
        const maxHeight = 60;
        // Ensure textElement.innerText is used for calculation if scrollHeight depends on rendered text
        textElement.style.maxHeight = 'none'; // Temporarily allow full height for accurate scrollHeight
        const scrollHeight = textElement.scrollHeight;


        if (scrollHeight > maxHeight) {
            textElement.style.maxHeight = `${maxHeight}px`;
            textElement.style.overflow = 'hidden';
            buttonElement.style.display = 'inline-block';
            const isInstagram = textElement.id === 'instagram-text';
            buttonElement.textContent = isInstagram ? 'mere' : 'Se mere';


            buttonElement.onclick = () => {
                if (textElement.style.maxHeight === `${maxHeight}px`) {
                    textElement.style.maxHeight = 'none';
                    buttonElement.textContent = isInstagram ? 'mindre' : 'Se mindre';
                } else {
                    textElement.style.maxHeight = `${maxHeight}px`;
                    buttonElement.textContent = isInstagram ? 'mere' : 'Se mere';
                }
            };
        } else {
            textElement.style.maxHeight = 'none'; // Ensure it's reset if not overflowing
            buttonElement.style.display = 'none';
        }
    }

    function showError(message) {
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
        }
    }

    function hideError() {
        if (errorMessage) errorMessage.style.display = 'none';
    }

    function updateAttemptCounterDisplay() {
        if (!attemptCounterDisplay) return;

        if (overrideLimit) {
            attemptCounterDisplay.textContent = 'Demo limit overridden.';
            attemptCounterDisplay.style.color = 'var(--text-muted)';
            attemptCounterDisplay.style.display = 'block';
            return;
        }

        const existingLink = attemptCounterDisplay.querySelector('a[id^="show-signup-modal-link"]');
        if (existingLink && submitBtn && submitBtn.disabled) {
             // If the "Registrer dig" link is showing (meaning submit is disabled due to no tries), don't change this message.
            return;
        }


        const userAccessData = JSON.parse(localStorage.getItem(USER_ACCESS_KEY));
        const freeTryAvailable = attemptsMade < MAX_ATTEMPTS;

        if (freeTryAvailable) {
            attemptCounterDisplay.textContent = `Du har ${MAX_ATTEMPTS - attemptsMade} gratis forsøg tilbage.`;
            attemptCounterDisplay.style.color = 'var(--text-muted)';
            attemptCounterDisplay.style.display = 'block';
        } else if (userAccessData && userAccessData.triesRemaining > 0) {
            attemptCounterDisplay.textContent = `Du har ${userAccessData.triesRemaining} ekstra forsøg tilbage.`;
            attemptCounterDisplay.style.color = 'var(--text-muted)';
            attemptCounterDisplay.style.display = 'block';
        } else {
            // This state (free try used, no extra tries) is primarily handled by checkFormValidity
            // to show the "Registrer dig" link. If form is invalid for other reasons (no text/image),
            // or if the link is already there, this specific counter message might be hidden or superseded.
            const messageValid = userMessageInput && userMessageInput.value.trim().length > 0;
            const imagesValid = uploadedFiles.length > 0 && uploadedFiles.length <= MAX_IMAGES;

            if (!messageValid || !imagesValid) { // If form is incomplete, hide general try messages
                 attemptCounterDisplay.style.display = 'none';
            } else if (!existingLink) { // If form is complete, but no tries left and no link shown yet (should be rare)
                attemptCounterDisplay.innerHTML = `Dit gratis forsøg er brugt. <a href="#" id="show-signup-modal-link-fallback" class="modal-link">Registrer dig</a> for 5 ekstra forsøg.`;
                attemptCounterDisplay.style.color = 'var(--accent-pink)';
                attemptCounterDisplay.style.display = 'block';
                const fallbackLink = document.getElementById('show-signup-modal-link-fallback');
                if (fallbackLink) {
                    const newFallbackLink = fallbackLink.cloneNode(true);
                    if (fallbackLink.parentNode) fallbackLink.parentNode.replaceChild(newFallbackLink, fallbackLink);
                    newFallbackLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        showSignupModal();
                    });
                }
            } else if (!existingLink && submitBtn && !submitBtn.disabled) {
                // If no link, but button is enabled (e.g. override), hide counter
                 attemptCounterDisplay.style.display = 'none';
            }
            // If existingLink is present, checkFormValidity has already set the message.
        }
    }
});