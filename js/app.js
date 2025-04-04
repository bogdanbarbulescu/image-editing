// js/app.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const imageLoader = document.getElementById('imageLoader');

    // Canvases
    const mainCanvas = document.getElementById('mainCanvas');             // VISIBLE Canvas
    const canvasBeforeHidden = document.getElementById('canvasBeforeHidden'); // Hidden for original state
    const canvasAfterHidden = document.getElementById('canvasAfterHidden');  // Hidden for filtered state
    const ctxMain = mainCanvas.getContext('2d');
    const ctxBeforeHidden = canvasBeforeHidden.getContext('2d');
    // Add hint for performance if reading back from canvasAfterHidden frequently (though we don't currently)
    const ctxAfterHidden = canvasAfterHidden.getContext('2d', { willReadFrequently: true });

    // Sliders
    const exposureSlider = document.getElementById('exposureSlider');
    const contrastSlider = document.getElementById('contrastSlider');
    const highlightsSlider = document.getElementById('highlightsSlider');
    const shadowsSlider = document.getElementById('shadowsSlider');
    const saturationSlider = document.getElementById('saturationSlider');
    const temperatureSlider = document.getElementById('temperatureSlider');
    const tintSlider = document.getElementById('tintSlider');
    const sepiaSlider = document.getElementById('sepiaSlider');
    const sharpnessSlider = document.getElementById('sharpnessSlider'); // Disabled in HTML, no filter logic yet

    // Buttons & Select
    const resetAllBtn = document.getElementById('resetAllBtn');
    const exportBtn = document.getElementById('exportBtn');
    const exportFormatSelect = document.getElementById('exportFormat');
    const themeToggleBtn = document.getElementById('themeToggleBtn');

    // View Toggle Buttons
    const viewBeforeBtn = document.getElementById('viewBeforeBtn');
    const viewAfterBtn = document.getElementById('viewAfterBtn');
    const viewSplitBtn = document.getElementById('viewSplitBtn');
    const viewBtnGroup = document.querySelector('.btn-group[aria-label="View Mode Toggle"]'); // Button Group Reference (Optional)

    // --- State Variables ---
    let originalImage = null;        // Holds the loaded HTML Image object
    let originalImageData = null;    // Holds the ImageData object of the original image
    let currentViewMode = 'after';   // Active view mode: 'before', 'after', 'split'. Default is 'after'.
    let debounceTimer;               // Timer ID for debouncing slider input events

    // --- Constants ---
    const THEME_STORAGE_KEY = 'imageEditorTheme'; // Key for saving theme preference in localStorage

    // --- Utility Functions ---

    /**
     * Debounce function: delays execution until after 'delay' ms have passed without invocation.
     * Useful for performance-intensive operations triggered by frequent events (like slider input).
     * @param {Function} func The function to debounce.
     * @param {number} delay Delay in milliseconds.
     * @returns {Function} The debounced version of the function.
     */
    function debounce(func, delay) {
        return function(...args) {
            clearTimeout(debounceTimer); // Clear any existing timer
            // Set a new timer
            debounceTimer = setTimeout(() => {
                func.apply(this, args); // Execute the function after the delay
            }, delay);
        };
    }

    /**
     * Clamps a numeric value between a specified minimum and maximum.
     * Essential for keeping RGB color values within the valid 0-255 range.
     * @param {number} value The value to clamp.
     * @param {number} min The minimum allowed value.
     * @param {number} max The maximum allowed value.
     * @returns {number} The value clamped between min and max.
     */
    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    // --- Theme Handling Functions ---

    /**
     * Applies the selected theme ('light' or 'dark') to the document,
     * saves the preference to localStorage, and updates the toggle button icon.
     * @param {string} theme - The theme identifier ('light' or 'dark').
     */
    function applyTheme(theme) {
        // Set the 'data-bs-theme' attribute on the root HTML element
        document.documentElement.setAttribute('data-bs-theme', theme);
        // Save the chosen theme to localStorage for persistence
        localStorage.setItem(THEME_STORAGE_KEY, theme);
        // Update the icon on the theme toggle button
        updateThemeToggleButton(theme);
        console.log(`Theme applied: ${theme}`);
        // Re-draw canvas if split view active, to update line color
        if (originalImage && currentViewMode === 'split') {
             updateMainCanvasView();
        }
    }

    /**
     * Updates the icon (sun/moon) inside the theme toggle button based on the active theme.
     * @param {string} theme - The currently active theme ('light' or 'dark').
     */
    function updateThemeToggleButton(theme) {
         if (themeToggleBtn) {
            const icon = themeToggleBtn.querySelector('i'); // Find the <i> tag within the button
            if (icon) {
                if (theme === 'dark') {
                    // Dark mode: Show sun icon, update aria-label
                    icon.classList.remove('bi-moon-stars-fill');
                    icon.classList.add('bi-sun-fill');
                    themeToggleBtn.setAttribute('aria-label', 'Switch to light theme');
                } else {
                    // Light mode: Show moon icon, update aria-label
                    icon.classList.remove('bi-sun-fill');
                    icon.classList.add('bi-moon-stars-fill');
                    themeToggleBtn.setAttribute('aria-label', 'Switch to dark theme');
                }
            }
        }
    }

    /**
     * Loads the theme preference from localStorage when the page loads.
     * Defaults to 'light' theme if no preference is found.
     */
    function loadInitialTheme() {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        // Optional: Could check system preference here as a fallback
        // const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme = savedTheme ? savedTheme : 'light'; // Use saved theme or default to 'light'
        applyTheme(initialTheme); // Apply the determined theme
    }

    /**
     * Handles the click event on the theme toggle button. Determines the
     * current theme and switches to the opposite theme.
     */
    function handleThemeToggle() {
        // Get the current theme from the root element's attribute
        const currentTheme = document.documentElement.getAttribute('data-bs-theme');
        // Determine the new theme
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        // Apply the new theme
        applyTheme(newTheme);
    }


    // --- Event Listeners Setup ---

    // Attach event listeners to interactive elements
    imageLoader.addEventListener('change', handleImageUpload);
    resetAllBtn.addEventListener('click', handleReset);
    themeToggleBtn.addEventListener('click', handleThemeToggle);

    // Attach listeners to view toggle buttons, calling handleViewChange with the mode
    viewBeforeBtn.addEventListener('click', () => handleViewChange('before'));
    viewAfterBtn.addEventListener('click', () => handleViewChange('after'));
    viewSplitBtn.addEventListener('click', () => handleViewChange('split'));

    // Setup debounced listeners for all implemented filter sliders
    setupSliderListeners();

    // Add listener for the export button (uncomment placeholder function below)
    exportBtn.addEventListener('click', handleExport);


    // --- Core Image Handling and Filtering Functions ---

    /**
     * Sets up 'input' event listeners for all filter sliders (except unimplemented ones).
     * Applies debouncing to the event handler for performance.
     */
    function setupSliderListeners() {
        const sliders = [
            exposureSlider, contrastSlider, highlightsSlider, shadowsSlider,
            saturationSlider, temperatureSlider, tintSlider, sepiaSlider
            // sharpnessSlider is excluded
        ];
        // Create a debounced version of the filter application function
        const debouncedApplyFilters = debounce(applyFilters, 150); // 150ms delay is usually a good starting point

        sliders.forEach(slider => {
            if (slider) { // Check if the element actually exists
                 // 'input' event fires continuously as the slider is dragged
                 slider.addEventListener('input', debouncedApplyFilters);
            }
        });
    }

    /**
     * Handles the file input 'change' event. Reads the selected image file,
     * loads it into an Image object, draws it onto hidden canvases, stores
     * original pixel data, and updates the main visible canvas.
     * @param {Event} e - The event object from the file input.
     */
    function handleImageUpload(e) {
        const file = e.target.files[0]; // Get the first selected file
        // Basic validation
        if (!file || !file.type.startsWith('image/')) {
            alert('Please select a valid image file (e.g., JPG, PNG).');
            imageLoader.value = ''; // Clear the input field
            resetAll();             // Reset the editor state
            return;
        }

        const reader = new FileReader(); // Initialize FileReader

        // Define callback for when the file is successfully read
        reader.onload = function(event) {
            originalImage = new Image(); // Create an Image object

            // Define callback for when the Image object finishes loading the image data
            originalImage.onload = function() {
                console.log(`Image loaded: ${originalImage.width}x${originalImage.height}`);
                const w = originalImage.width;
                const h = originalImage.height;

                // Set dimensions for the visible canvas and the two hidden canvases
                mainCanvas.width = w; mainCanvas.height = h;
                canvasBeforeHidden.width = w; canvasBeforeHidden.height = h;
                canvasAfterHidden.width = w; canvasAfterHidden.height = h;

                // Draw the original image onto the hidden 'Before' canvas
                ctxBeforeHidden.drawImage(originalImage, 0, 0);
                // Store the raw pixel data from the 'Before' canvas
                try {
                    originalImageData = ctxBeforeHidden.getImageData(0, 0, w, h);
                    console.log("Original image data stored.");
                } catch (error) {
                     console.error("Error getting original image data (tainted canvas?):", error);
                     alert("Could not process the image, it might be from a different origin or corrupted.");
                     resetAll();
                     return; // Stop processing if we can't get data
                }


                // Draw the original image onto the hidden 'After' canvas (initial state for filters)
                ctxAfterHidden.drawImage(originalImage, 0, 0);

                resetAllSliders();       // Reset slider controls visually
                setViewMode('after');    // Ensure view mode is set (default or reset)
                updateMainCanvasView();  // Update the visible canvas with the new image
                // TODO: Enable controls (sliders, buttons) if they were disabled
            }

            // Handle errors during Image object loading (e.g., corrupted image)
            originalImage.onerror = function() {
                alert('Error loading the image data. The file might be corrupt or in an unsupported format.');
                resetAll();
            }

            // Start loading the image data into the Image object using the Data URL from the FileReader
            originalImage.src = event.target.result;
        }

        // Handle errors during the FileReader process itself
        reader.onerror = function() {
            alert('Error reading the selected file.');
            resetAll();
        }

        // Start the asynchronous file reading process
        reader.readAsDataURL(file);
    }

     /**
     * Handles the click on the 'Reset All' button. Resets filter sliders
     * visually, redraws the original image onto the hidden 'After' canvas,
     * and updates the main visible canvas view.
     */
    function handleReset() {
        // Check if an image is loaded
        if (!originalImage || !originalImageData) {
            console.log("Reset called, but no image is loaded or data available.");
            return;
        }

        console.log("Resetting filters...");
        resetAllSliders(); // Reset slider positions

        // Reset the hidden 'After' canvas by drawing the original image onto it
        ctxAfterHidden.drawImage(originalImage, 0, 0);

        // Update the main visible canvas to reflect the reset state based on the current view mode
        updateMainCanvasView();
        console.log("Filters reset, hidden 'After' canvas updated, main view refreshed.");
    }


    /**
     * Resets all filter sliders to their default visual values (typically 0).
     */
    function resetAllSliders() {
        console.log("Resetting sliders visually...");
        // Check if each slider element exists before attempting to set its value
        if(exposureSlider) exposureSlider.value = 0;
        if(contrastSlider) contrastSlider.value = 0;
        if(highlightsSlider) highlightsSlider.value = 0;
        if(shadowsSlider) shadowsSlider.value = 0;
        if(saturationSlider) saturationSlider.value = 0;
        if(temperatureSlider) temperatureSlider.value = 0;
        if(tintSlider) tintSlider.value = 0;
        if(sepiaSlider) sepiaSlider.value = 0;
        if(sharpnessSlider) sharpnessSlider.value = 0; // Reset even if disabled
    }

    /**
     * Performs a full reset of the editor state: clears canvases, resets
     * state variables, resets sliders, and sets the default view mode.
     * Typically called on initial load or after critical errors.
     */
    function resetAll() {
         console.log("Performing full editor reset.");
         // Clear all canvases
         ctxMain.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
         ctxBeforeHidden.clearRect(0, 0, canvasBeforeHidden.width, canvasBeforeHidden.height);
         ctxAfterHidden.clearRect(0, 0, canvasAfterHidden.width, canvasAfterHidden.height);

         // Reset state variables
         originalImage = null;
         originalImageData = null;

         // Optional: Reset canvas dimensions to 0 or a default placeholder size
         // mainCanvas.width = 300; mainCanvas.height = 150; // etc.

         resetAllSliders();    // Reset controls
         setViewMode('after'); // Reset view mode to default
         // TODO: Disable controls (sliders, export, reset, view toggle) until image loaded
    }


    /**
     * Applies all active filter adjustments based on current slider values.
     * Reads pixel data from the *original* stored image data (via hidden 'Before' canvas),
     * applies calculations, writes the result to the hidden 'After' canvas,
     * and then triggers an update of the main visible canvas.
     */
    function applyFilters() {
        // Ensure original image data is available before proceeding
        if (!originalImage || !originalImageData) {
            console.warn("ApplyFilters called but original image data is missing.");
            return;
        }
        console.time('applyFilters'); // Start performance timer

        // --- 1. Get Current Filter Values ---
        const exposureValue = parseInt(exposureSlider.value, 10);
        let contrastFactor = (parseInt(contrastSlider.value, 10) + 100) / 100;
        contrastFactor *= contrastFactor; // Apply squaring for more effect
        const highlightValue = parseInt(highlightsSlider.value, 10) / 100;
        const shadowValue = parseInt(shadowsSlider.value, 10) / 100;
        const saturationValue = parseInt(saturationSlider.value, 10) / 100;
        const temperatureValue = parseInt(temperatureSlider.value, 10);
        const tintValue = parseInt(tintSlider.value, 10);
        const sepiaValue = parseInt(sepiaSlider.value, 10) / 100;

        // --- 2. Get Original Pixel Data ---
        // Get a fresh copy of the original image data to work on
        // Note: Using ctxBeforeHidden.getImageData() reads the canvas state,
        // which should contain the original image drawn during load.
        const workingImageData = ctxBeforeHidden.getImageData(0, 0, canvasBeforeHidden.width, canvasBeforeHidden.height);
        const data = workingImageData.data; // The pixel array [R,G,B,A,...]
        const len = data.length;

        // --- 3. Apply Filters Pixel by Pixel ---
        for (let i = 0; i < len; i += 4) {
            let r = data[i], g = data[i + 1], b = data[i + 2];

            // Apply filters sequentially (order can matter)
            // Exposure
            r += exposureValue; g += exposureValue; b += exposureValue;
            // Contrast
            r = contrastFactor * (r - 128) + 128; g = contrastFactor * (g - 128) + 128; b = contrastFactor * (b - 128) + 128;
            // Temperature
            if (temperatureValue > 0) { r += temperatureValue * 0.6; b -= temperatureValue * 0.4; }
            else { r += temperatureValue * 0.4; b -= temperatureValue * 0.6; }
            // Tint
            if (tintValue > 0) { g -= tintValue * 0.5; } else { g -= tintValue * 0.5; }
            // Saturation
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            const satFactor = 1.0 + saturationValue;
            r = gray + (r - gray) * satFactor; g = gray + (g - gray) * satFactor; b = gray + (b - gray) * satFactor;
            // Highlights & Shadows (Basic version)
            const brightness = clamp((r + g + b) / 765, 0, 1); // Normalized brightness (0-1)
            if (highlightValue !== 0) { const ha = highlightValue * brightness * 255; r += ha; g += ha; b += ha; }
            if (shadowValue !== 0) { const sa = shadowValue * (1 - brightness) * 255; r += sa; g += sa; b += sa; }
            // Sepia
            if (sepiaValue > 0) {
                const sr = r * 0.393 + g * 0.769 + b * 0.189, sg = r * 0.349 + g * 0.686 + b * 0.168, sb = r * 0.272 + g * 0.534 + b * 0.131;
                r = (1 - sepiaValue) * r + sepiaValue * sr; g = (1 - sepiaValue) * g + sepiaValue * sg; b = (1 - sepiaValue) * b + sepiaValue * sb;
            }

            // --- 4. Clamp Final Values ---
            data[i] = clamp(r, 0, 255); data[i + 1] = clamp(g, 0, 255); data[i + 2] = clamp(b, 0, 255);
            // Alpha (data[i + 3]) is typically left unchanged
        }

        // --- 5. Put Modified Data onto HIDDEN 'After' Canvas ---
        ctxAfterHidden.putImageData(workingImageData, 0, 0);

        console.timeEnd('applyFilters'); // Stop performance timer

        // --- 6. Update the VISIBLE Main Canvas ---
        // This crucial step displays the result according to the selected view mode
        updateMainCanvasView();
    }


    // --- View Mode Handling ---

    /**
     * Sets the internal state for the current view mode ('before', 'after', 'split')
     * and updates the visual styling (active state) of the toggle buttons.
     * @param {string} mode - The view mode identifier to activate.
     */
    function setViewMode(mode) {
        currentViewMode = mode; // Update the state variable

        // Update button active classes using Bootstrap conventions
        [viewBeforeBtn, viewAfterBtn, viewSplitBtn].forEach(btn => {
            // Check if the button's data attribute matches the new mode
            if (btn && btn.dataset.viewmode === mode) {
                // Activate the button
                btn.classList.add('active', 'btn-secondary');
                btn.classList.remove('btn-outline-secondary');
            } else if (btn) {
                // Deactivate the button
                btn.classList.remove('active', 'btn-secondary');
                btn.classList.add('btn-outline-secondary');
            }
        });
        console.log(`View mode set to: ${mode}`);
    }

    /**
     * Handles click events on the view mode toggle buttons. Sets the
     * new view mode state and triggers an update of the main canvas.
     * @param {string} mode - The view mode ('before', 'after', 'split') corresponding to the clicked button.
     */
     function handleViewChange(mode) {
        // Only allow view change if an image is loaded
        if (!originalImage || !originalImageData) {
            console.log("Cannot change view mode, no image loaded.");
            return;
        }
        setViewMode(mode);        // Set the new mode and update button styles
        updateMainCanvasView();   // Redraw the main canvas for the new view
     }


    /**
     * Updates the content of the visible main canvas (#mainCanvas) based
     * on the currently selected `currentViewMode`. Reads data from the
     * appropriate hidden canvas or stored ImageData.
     */
    function updateMainCanvasView() {
        // Check if we have image data to display
        if (!originalImage || !originalImageData) {
             // Clear the main canvas if no image is loaded
             ctxMain.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
             console.log("UpdateMainCanvasView: No image loaded, canvas cleared.");
            return;
        }

        const w = mainCanvas.width;
        const h = mainCanvas.height;

        // Always clear the main canvas before drawing the new view
        ctxMain.clearRect(0, 0, w, h);

        console.log(`Updating main canvas for view mode: ${currentViewMode}`);

        // Draw content based on the active view mode
        switch (currentViewMode) {
            case 'before':
                // Display the original, unmodified image data
                ctxMain.putImageData(originalImageData, 0, 0);
                break;

            case 'after':
                // Display the filtered image from the hidden 'After' canvas
                ctxMain.drawImage(canvasAfterHidden, 0, 0);
                break;

            case 'split':
                const halfWidth = Math.floor(w / 2); // Use floor for integer width

                // Draw left half: Source is left half of hidden 'Before' canvas
                ctxMain.drawImage(canvasBeforeHidden,
                    0, 0, halfWidth, h, // Source rectangle (sx, sy, sWidth, sHeight)
                    0, 0, halfWidth, h); // Destination rectangle (dx, dy, dWidth, dHeight)

                // Draw right half: Source is right half of hidden 'After' canvas
                ctxMain.drawImage(canvasAfterHidden,
                    halfWidth, 0, w - halfWidth, h, // Source rectangle (sx, sy, sWidth, sHeight)
                    halfWidth, 0, w - halfWidth, h); // Destination rectangle (dx, dy, dWidth, dHeight)

                // Draw the dividing line directly onto the main canvas
                 ctxMain.save(); // Save current context settings
                 // Set line style based on current theme
                 const isDarkMode = document.documentElement.getAttribute('data-bs-theme') === 'dark';
                 ctxMain.strokeStyle = isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'; // White or Black-ish
                 ctxMain.lineWidth = 1; // Line thickness
                 ctxMain.setLineDash([4, 2]); // Dashed line pattern (4 pixels on, 2 pixels off)
                 ctxMain.beginPath();         // Start drawing path
                 ctxMain.moveTo(halfWidth, 0);  // Move to top-middle
                 ctxMain.lineTo(halfWidth, h);  // Draw line down to bottom-middle
                 ctxMain.stroke();            // Render the line
                 ctxMain.restore();           // Restore previous context settings (line style, etc.)
                break;

            default:
                // Fallback case if view mode is somehow invalid
                console.error(`Unknown view mode encountered: ${currentViewMode}`);
                // Display the 'after' view as a safe default
                ctxMain.drawImage(canvasAfterHidden, 0, 0);
        }
    }


    // --- Image Export Functionality ---

    /**
     * Handles the click event on the 'Export' button. Generates an image
     * file from the hidden 'After' canvas (which holds the final filtered result)
     * in the user-selected format (PNG or JPEG) and triggers a download.
     */
    function handleExport() {
        // Ensure an image has been processed
        if (!originalImage || !canvasAfterHidden || canvasAfterHidden.width === 0) {
            alert("Please load and optionally edit an image before exporting.");
            return;
        }

        const format = exportFormatSelect.value || 'image/png'; // Default to PNG
        const quality = 0.92; // Quality setting for JPEG (0.0 to 1.0), ignored for PNG
        let filename = `edited_image`; // Base filename

        // Determine file extension based on format
        if (format === 'image/jpeg') {
            filename += '.jpg';
        } else { // Default to png
            filename += '.png';
        }

        console.log(`Attempting to export as ${format} with filename ${filename}`);

        // Use canvas.toBlob for better performance, especially with large images
        canvasAfterHidden.toBlob(function(blob) {
            if (blob) {
                // Create a temporary anchor element to trigger the download
                const link = document.createElement('a');
                // Create a URL for the blob object
                link.href = URL.createObjectURL(blob);
                // Set the desired filename for the download
                link.download = filename;

                // Programmatically click the link to start the download
                document.body.appendChild(link); // Append required for Firefox compatibility
                link.click();                   // Simulate click
                document.body.removeChild(link); // Clean up by removing the link

                // Release the object URL to free up memory
                URL.revokeObjectURL(link.href);
                console.log(`Image export initiated as ${filename}`);
            } else {
                // Handle potential errors during blob creation
                alert("Sorry, there was an error creating the image file for export.");
                console.error("canvas.toBlob callback received null blob.");
            }
        }, format, quality); // Pass format and quality to toBlob
    }


    // --- Initial Setup Call ---
    loadInitialTheme(); // Apply saved theme or default on page load
    // Call resetAll initially to ensure clean state and potentially disable controls?
    // resetAll();


}); // End DOMContentLoaded wrapper