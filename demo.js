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

    const inputSection = document.getElementById('demo-input-section');
    const outputSection = document.getElementById('demo-output-section');
    const loadingIndicator = document.getElementById('loading-indicator');
    const outputContent = document.getElementById('output-content');

    const facebookText = document.getElementById('facebook-text');
    const facebookImages = document.getElementById('facebook-images');
    const instagramText = document.getElementById('instagram-text');
    const instagramCarousel = document.getElementById('instagram-carousel');
    const tryAgainBtn = document.getElementById('try-again-btn');
    const currentYearDemo = document.getElementById('current-year-demo');



    // --- Constants & State ---
    const MAX_IMAGES = 2; // Limit to 2 images
    const MAX_FILE_SIZE_MB = 3;
    // Attempt limit constants removed
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
    let uploadedFiles = []; // Array to hold File objects

    // --- Initial Setup ---
    if (currentYearDemo) {
        currentYearDemo.textContent = new Date().getFullYear();
    }
    // Attempt counter display hidden
    if (attemptCounterDisplay) attemptCounterDisplay.style.display = 'none';
    checkFormValidity(); // Initial check

    // --- Event Listeners ---

    // Message Input: Character Count & Validation
    userMessageInput.addEventListener('input', () => {
        const currentLength = userMessageInput.value.length;



        charCount.textContent = `${currentLength} / 200`;
        checkFormValidity();
    });


    // --- Dynamic Placeholder Logic ---
    const placeholderExamples = [
        "Nye forårsjakker!",
        "Weekendtilbud: -20%!",
        "Åbent til kl. 18 i dag!",
        "Friskbagte croissanter klar nu! 🥐",
        "Udsalg på alle sommerjakker - spar 30%!",
        "Kaffe + croissant kun 35 kr. indtil kl. 11!",
        "Live musik på lørdag!"
    ];
    let placeholderInterval = null;
    let currentPlaceholderIndex = 0;
    const defaultPlaceholder = userMessageInput.placeholder; // Store original placeholder

    function startPlaceholderRotation() {
        console.log("Attempting to start placeholder rotation..."); // DEBUG
        if (placeholderInterval) { console.log(" - Interval already running."); return; }
        if (userMessageInput.value.trim() !== '') { console.log(" - Input not empty, not starting."); return; }
        console.log(" - Starting interval."); // DEBUG

        // Set initial placeholder with cursor immediately
        const initialPlaceholder = placeholderExamples[currentPlaceholderIndex] + '|';
        userMessageInput.placeholder = initialPlaceholder;
        userMessageInput.classList.remove('placeholder-hiding'); // Ensure visible

        placeholderInterval = setInterval(() => {
            // Fade out (remove cursor first)
            userMessageInput.placeholder = userMessageInput.placeholder.replace('|', ''); // Remove cursor before fade
            userMessageInput.classList.add('placeholder-hiding');

            // Wait for fade out, then change text (with cursor) and fade in
            setTimeout(() => {
                currentPlaceholderIndex = (currentPlaceholderIndex + 1) % placeholderExamples.length;
                const newPlaceholder = placeholderExamples[currentPlaceholderIndex] + '|'; // Add cursor
                console.log("Setting placeholder:", newPlaceholder); // DEBUG
                userMessageInput.placeholder = newPlaceholder;
                userMessageInput.classList.remove('placeholder-hiding'); // Fade in
            }, 250); // Slightly longer than CSS transition to ensure fade out completes
        }, 3500); // Change every 3.5 seconds
    }

    function stopPlaceholderRotation(restoreDefault = true) {
        console.log("Stopping placeholder rotation. Restore default:", restoreDefault); // DEBUG
        clearInterval(placeholderInterval);
        placeholderInterval = null;
        userMessageInput.classList.remove('placeholder-hiding'); // Ensure it's visible if stopped mid-fade
        if (restoreDefault) {
            userMessageInput.placeholder = defaultPlaceholder; // Restore original without cursor
        } else {
             // If keeping current text (on focus), just remove the cursor
             userMessageInput.placeholder = userMessageInput.placeholder.replace('|', '');
        }
    }

    // Stop rotation when user focuses or types
    userMessageInput.addEventListener('focus', () => { console.log("Input focused"); stopPlaceholderRotation(false); }); // Keep current example on focus
    userMessageInput.addEventListener('input', () => {
        console.log("Input event fired"); // DEBUG
        if (userMessageInput.value.trim() !== '') {
            stopPlaceholderRotation(true); // Restore default if typing starts
        } else {
             // If user deletes everything, restart rotation after a short delay
             setTimeout(() => {
                 if (userMessageInput.value.trim() === '' && document.activeElement !== userMessageInput) {
                    startPlaceholderRotation();
                 }
             }, 500);
        }
    });

    // Restart rotation if field is blurred and empty
    userMessageInput.addEventListener('blur', () => {
        console.log("Input blurred"); // DEBUG
        if (userMessageInput.value.trim() === '') {
            startPlaceholderRotation();
        }
    });

    // Initial start if empty
    console.log("Initial placeholder rotation check"); // DEBUG
    startPlaceholderRotation();
    // --- End Dynamic Placeholder Logic ---


    // Image Upload: Drag & Drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        handleFiles(files);
    });

    // Image Upload: Browse Button Click (Handled by label now)
    // uploadArea.addEventListener('click', () => {
    //     imageUploadInput.click(); // Trigger hidden file input - REMOVED
    // });
    imageUploadInput.addEventListener('change', (e) => {
        const files = e.target.files;
        handleFiles(files);
        // Reset input value to allow re-uploading the same file after removal
        imageUploadInput.value = null;
    });

    // Form Submission
    demoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        // Attempt limit check fully removed
        if (checkFormValidity()) {

            processSubmission();

        }
    });

    // Try Again Button
    tryAgainBtn.addEventListener('click', () => {
        resetDemo();
    });



    // --- Functions ---

    function handleFiles(files) {
        hideError();
        let currentFileCount = uploadedFiles.length;
        for (const file of files) {
            if (currentFileCount >= MAX_IMAGES) {
                showError(`Du kan højst uploade ${MAX_IMAGES} billeder.`);
                break; // Stop processing more files
            }
            if (!validateFileType(file)) {
                showError(`Filtype ikke tilladt: ${file.name}. Brug venligst JPG eller PNG.`);
                continue; // Skip this file
            }
            if (!validateFileSize(file)) {
                showError(`Filen er for stor: ${file.name}. Max ${MAX_FILE_SIZE_MB}MB pr. fil.`);
                continue; // Skip this file
            }

            uploadedFiles.push(file);
            createImagePreview(file, uploadedFiles.length - 1); // Pass index for removal
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
            previewWrapper.dataset.index = index; // Store index

            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = `Preview af ${file.name}`;

            const removeBtn = document.createElement('button');
            removeBtn.classList.add('remove-img-btn');
            removeBtn.textContent = 'X';
            removeBtn.type = 'button'; // Prevent form submission
            removeBtn.onclick = () => removeImage(index);

            previewWrapper.appendChild(img);
            previewWrapper.appendChild(removeBtn);
            imagePreviewsContainer.appendChild(previewWrapper);
        };
        reader.readAsDataURL(file);
    }

    function removeImage(indexToRemove) {
        // Remove file from array (more complex due to index changes)
        // Easiest is to rebuild the array and previews based on remaining DOM elements
        uploadedFiles = uploadedFiles.filter((_, i) => i !== indexToRemove);

        // Remove preview from DOM
        const previewToRemove = imagePreviewsContainer.querySelector(`.img-preview-wrapper[data-index="${indexToRemove}"]`);
        if (previewToRemove) {
            imagePreviewsContainer.removeChild(previewToRemove);
        }

        // Re-index remaining previews in the DOM
        const remainingPreviews = imagePreviewsContainer.querySelectorAll('.img-preview-wrapper');
        remainingPreviews.forEach((preview, newIndex) => {
            preview.dataset.index = newIndex;
            // Update the remove button's onclick handler index
            const btn = preview.querySelector('.remove-img-btn');
            if (btn) {
                btn.onclick = () => removeImage(newIndex);
            }
        });


        checkFormValidity();
        hideError(); // Hide any previous errors
    }

    function checkFormValidity() {
        const messageValid = userMessageInput.value.trim().length > 0;
        const imagesValid = uploadedFiles.length > 0 && uploadedFiles.length <= MAX_IMAGES;

        const isValid = messageValid && imagesValid; // Limit check removed
        submitBtn.disabled = !isValid;
        return isValid;
    }

    function processSubmission() {
        hideError();
        submitBtn.disabled = true; // Disable button immediately
        submitBtn.textContent = 'AI genererer...'; // Update button text

        // Hide input, show output area with loader
        inputSection.style.display = 'none';
        outputSection.style.display = 'block';
        loadingIndicator.style.display = 'block';
        outputContent.style.display = 'none';

        // Attempt count logic removed

        // ** SIMULATE AI CALL **
        // In a real app, you'd send `userMessageInput.value` and potentially image data/URLs
        // to your backend, which then calls the OpenAI API.
        // ** IMPORTANT: API Call Simulation **
        // In a real application, DO NOT expose your OpenAI API key directly in client-side JavaScript.
        // 1. Create a backend endpoint (e.g., using Node.js, Python/Flask, etc.).
        // 2. Send the userMessage and potentially image data/URLs from this script to your backend endpoint.
        // 3. Your backend server securely stores your API key and makes the call to the OpenAI API.
        // 4. Your backend sends the generated text back to this script.
        // 5. This script then calls displayResults() with the text received from the backend.

        // Call the backend API endpoint
        fetch('/api/generate-post', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userMessage: userMessageInput.value }),
        })
        .then(response => {
            if (!response.ok) {
                // Attempt to read error message from backend if available
                return response.json().then(errData => {
                    throw new Error(errData.error || `HTTP error! status: ${response.status}`);
                }).catch(() => {
                    // Fallback if response is not JSON or reading fails
                    throw new Error(`HTTP error! status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.result) {
                displayResults(data.result);
            } else {
                throw new Error("Invalid response structure from API.");
            }
        })
        .catch(error => {
            console.error("Error calling backend API:", error);
            showError(`Fejl: ${error.message || 'Kunne ikke generere opslag.'}`);
            loadingIndicator.style.display = 'none';
            // Reset button and show input section on error
            submitBtn.textContent = 'Lav Opslag';
            submitBtn.disabled = false; // Re-enable button
            inputSection.style.display = 'block'; // Show input again
            outputSection.style.display = 'none'; // Hide output
        });
    }

    // Placeholder for the function that would call your backend
    async function callBackendApi(message) {
        // const backendUrl = '/api/generate-post'; // Example backend endpoint
        // try {
        //     const response = await fetch(backendUrl, {
        //         method: 'POST',
        //         headers: { 'Content-Type': 'application/json' },
        //         body: JSON.stringify({ message: message /*, imageData: ... */ })
        //     });
        //     if (!response.ok) {
        //         throw new Error(`Backend error: ${response.statusText}`);
        //     }
        //     const data = await response.json();
        //     return data.generatedText; // Assuming backend returns { generatedText: "..." }
        // } catch (error) {
        //     console.error("Error calling backend:", error);
        //     throw error; // Re-throw to be caught by caller
        // }
        // --- End of real backend call example ---

        // --- Simulation for Demo ---
        return new Promise((resolve) => {
             setTimeout(() => {
                const simulatedText = generateSimulatedPost(message);
                resolve(simulatedText);
            }, 2000); // Simulate 2 seconds loading time
        });
        // --- End Simulation ---
    }

    // Removed simulateApiCall and generateSimulatedPost functions

    function displayResults(generatedText) {
        loadingIndicator.style.display = 'none';
        outputContent.style.display = 'block';
        submitBtn.textContent = 'Lav Opslag'; // Reset button text on success

        // --- Populate Facebook Preview ---
        const fbTextElement = document.getElementById('facebook-text');
        const fbSeeMoreBtn = fbTextElement.nextElementSibling; // Assumes button is next sibling
        fbTextElement.innerText = generatedText;
        setupSeeMore(fbTextElement, fbSeeMoreBtn); // Setup "See more" for Facebook

        const facebookImagesContainer = document.getElementById('facebook-images');
        facebookImagesContainer.innerHTML = ''; // Clear previous images
        uploadedFiles.forEach(file => {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.alt = "Uploadet billede";
            facebookImagesContainer.appendChild(img);
        });
        // Add class for styling single vs multiple images
        facebookImagesContainer.className = 'post-images'; // Reset class
        if (uploadedFiles.length === 1) {
            facebookImagesContainer.classList.add('single-image');
        }


        // --- Populate Instagram Preview ---
        const igTextElement = document.getElementById('instagram-text');
        const igSeeMoreBtn = igTextElement.nextElementSibling; // Assumes button is next sibling
        igTextElement.innerText = generatedText;
        setupSeeMore(igTextElement, igSeeMoreBtn); // Setup "See more" for Instagram

        const carouselContainer = instagramCarousel; // The main container div
        carouselContainer.innerHTML = ''; // Clear previous content (including placeholders)

        // Create an inner wrapper for slides
        const slidesWrapper = document.createElement('div');
        slidesWrapper.classList.add('carousel-slides-wrapper');
        // Set wrapper width
        const numSlides = uploadedFiles.length;
        slidesWrapper.style.width = `${numSlides * 100}%`;
        // console.log("Setting IG wrapper width:", slidesWrapper.style.width); // DEBUG REMOVED

        // Create and append slides with images
        uploadedFiles.forEach((file, index) => {
            const slideDiv = document.createElement('div');
            slideDiv.classList.add('carousel-slide'); // Add class for styling

            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.alt = "Uploadet billede";
            // img.dataset.index = index; // Index not strictly needed on img anymore

            slideDiv.appendChild(img); // Append img to slide div
            slidesWrapper.appendChild(slideDiv); // Append slide div to wrapper
        });

        carouselContainer.appendChild(slidesWrapper); // Add wrapper to main container
        slidesWrapper.style.transform = 'translateX(0%)'; // Reset transform after appending

        // Add Carousel Controls and Indicators if multiple images
        if (numSlides > 1) {
            // Controls
            const controlsDiv = document.createElement('div');
            controlsDiv.classList.add('carousel-controls');
            const prevBtn = document.createElement('button');
            prevBtn.classList.add('prev');
            prevBtn.innerHTML = '<';
            prevBtn.style.display = 'none'; // Initially hide prev
            prevBtn.onclick = () => moveCarousel(-1);

            const nextBtn = document.createElement('button');
            nextBtn.classList.add('next');
            nextBtn.innerHTML = '›'; // Use right-pointing angle bracket
            nextBtn.style.display = 'block'; // Initially show next
            nextBtn.onclick = () => moveCarousel(1);

            controlsDiv.appendChild(prevBtn);
            controlsDiv.appendChild(nextBtn);
            carouselContainer.appendChild(controlsDiv); // Append controls directly to carousel container
            currentSlide = 0; // Reset slide index
        }

        // Add indicators container dynamically
        const indicatorsContainer = document.createElement('div');
        indicatorsContainer.classList.add('carousel-indicators');
        carouselContainer.appendChild(indicatorsContainer); // Append indicators container

        // Add Carousel Controls and Indicators if multiple images
        // REMOVED - CSS scroll snap handles navigation

        // Ensure wrapper transform is reset - REMOVED (not needed for scroll snap)
        // slidesWrapper.style.transform = 'translateX(0%)';

        // Show the post-demo CTA section
        console.log("Attempting to show CTA..."); // DEBUG
        const postDemoCta = document.getElementById('post-demo-cta');
        if (postDemoCta) {
            postDemoCta.style.display = 'block';
            console.log("CTA display set to block."); // DEBUG
        } else {
            console.error("CTA element (#post-demo-cta) not found!"); // DEBUG
        }

        // Scroll to the output section smoothly
        outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }


    // --- Instagram Carousel Logic ---
    // let currentSlide = 0; // REMOVED - CSS scroll snap handles this
    // function moveCarousel(direction) { ... } // REMOVED - CSS scroll snap handles this

    // --- Facebook Carousel Logic REMOVED ---


    function resetDemo() {
        // Correct reset logic:
        uploadedFiles = [];
        imagePreviewsContainer.innerHTML = '';
        userMessageInput.value = '';
        charCount.textContent = '0 / 200';
        hideError();
        checkFormValidity();

        outputSection.style.display = 'none';
        inputSection.style.display = 'block';

        // Clear previews
        const facebookImagesContainer = document.getElementById('facebook-images');
        if(facebookImagesContainer) facebookImagesContainer.innerHTML = '';

        // Clear IG carousel completely on reset
        instagramCarousel.innerHTML = '';

        // Reset text and "See more" state
        const fbTextElement = document.getElementById('facebook-text');
        const fbSeeMoreBtn = fbTextElement?.nextElementSibling;
        if (fbTextElement) {
            fbTextElement.innerText = '';
            fbTextElement.classList.remove('collapsed');
        }
        if (fbSeeMoreBtn) fbSeeMoreBtn.style.display = 'none';

        const igTextElement = document.getElementById('instagram-text');
        const igSeeMoreBtn = igTextElement?.nextElementSibling;
         if (igTextElement) {
            igTextElement.innerText = '';
            igTextElement.classList.remove('collapsed');
        }
        if (igSeeMoreBtn) igSeeMoreBtn.style.display = 'none';


        // Hide CTA section again on reset
        const postDemoCta = document.getElementById('post-demo-cta');
        if (postDemoCta) {
            postDemoCta.style.display = 'none';
        }
    }

    // --- See More Logic ---
    function setupSeeMore(textElement, buttonElement) {
        if (!textElement || !buttonElement) return;

        // Reset state initially
        textElement.classList.remove('collapsed');
        buttonElement.style.display = 'none';
        buttonElement.textContent = buttonElement.id.includes('facebook') ? 'Se mere' : 'mere'; // Reset text

        // Check for overflow after rendering
        // Use setTimeout to allow browser to render and calculate heights
        setTimeout(() => {
            const isOverflowing = textElement.scrollHeight > textElement.clientHeight;

            if (isOverflowing) {
                textElement.classList.add('collapsed');
                buttonElement.style.display = buttonElement.id.includes('instagram') ? 'inline' : 'block'; // Show button (inline for IG)

                // Remove previous listener if any, then add new one
                buttonElement.replaceWith(buttonElement.cloneNode(true)); // Simple way to remove listeners
                const newButtonElement = textElement.nextElementSibling; // Get the new button reference
                newButtonElement.addEventListener('click', () => {
                    textElement.classList.toggle('collapsed');
                    const isCollapsed = textElement.classList.contains('collapsed');
                    newButtonElement.textContent = isCollapsed
                        ? (buttonElement.id.includes('facebook') ? 'Se mere' : 'mere')
                        : (buttonElement.id.includes('facebook') ? 'Se mindre' : 'mindre');
                });
            } else {
                textElement.classList.remove('collapsed');
                buttonElement.style.display = 'none';
            }
        }, 100); // Small delay for rendering
    }
    // --- End See More Logic ---


    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }

    function hideError() {
        errorMessage.textContent = '';
        errorMessage.style.display = 'none';
    }


    // --- Instagram Carousel Logic (Restored) ---
    let currentSlide = 0; // For Instagram
    function moveCarousel(direction) {
        const slidesWrapper = instagramCarousel.querySelector('.carousel-slides-wrapper');
        const totalSlides = uploadedFiles.length;
        if (!slidesWrapper || totalSlides <= 1) return;

        currentSlide += direction;

        // Clamp slide index
        if (currentSlide < 0) {
            currentSlide = 0;
        } else if (currentSlide >= totalSlides) {
            currentSlide = totalSlides - 1;
        }

        // Calculate and apply the transform (This is the core logic)
        const newTransform = `translateX(-${currentSlide * 100}%)`;
        console.log("moveCarousel: Applying transform", newTransform, "to", slidesWrapper); // DEBUG
        slidesWrapper.style.transform = newTransform;

        // Show/hide buttons based on current slide index
        const prevBtn = instagramCarousel.querySelector('.carousel-controls .prev');
        const nextBtn = instagramCarousel.querySelector('.carousel-controls .next');
        if (prevBtn) prevBtn.style.display = (currentSlide === 0) ? 'none' : 'block';
        if (nextBtn) nextBtn.style.display = (currentSlide === totalSlides - 1) ? 'none' : 'block';
    }





    // updateAttemptCounter function removed

}); // End DOMContentLoaded