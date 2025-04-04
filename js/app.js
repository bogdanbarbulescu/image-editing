// js/app.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const imageLoader = document.getElementById('imageLoader');
    const canvasBefore = document.getElementById('canvasBefore');
    const canvasAfter = document.getElementById('canvasAfter');
    const ctxBefore = canvasBefore.getContext('2d');
    // Optimization hint for frequent readbacks (though we currently read from 'Before')
    const ctxAfter = canvasAfter.getContext('2d', { willReadFrequently: true });

    // Sliders
    const exposureSlider = document.getElementById('exposureSlider');
    const contrastSlider = document.getElementById('contrastSlider');
    const highlightsSlider = document.getElementById('highlightsSlider');
    const shadowsSlider = document.getElementById('shadowsSlider');
    const saturationSlider = document.getElementById('saturationSlider');
    const temperatureSlider = document.getElementById('temperatureSlider');
    const tintSlider = document.getElementById('tintSlider');
    const sepiaSlider = document.getElementById('sepiaSlider');
    const sharpnessSlider = document.getElementById('sharpnessSlider'); // Still disabled in HTML/not implemented

    // Buttons & Select
    const resetAllBtn = document.getElementById('resetAllBtn');
    const exportBtn = document.getElementById('exportBtn');
    const exportFormatSelect = document.getElementById('exportFormat');
    const themeToggleBtn = document.getElementById('themeToggleBtn'); // Theme Toggle Button

    // --- State Variables ---
    let originalImage = null; // Holds the loaded Image object
    let debounceTimer;        // Holds the timer ID for debouncing slider events

    // --- Constants ---
    const THEME_STORAGE_KEY = 'imageEditorTheme'; // Key for localStorage

    // --- Utility Functions ---

    /**
     * Simple debounce function. Delays function execution until after 'delay' ms have passed since the last invocation.
     * @param {Function} func The function to debounce.
     * @param {number} delay Delay in milliseconds.
     * @returns {Function} The debounced function.
     */
    function debounce(func, delay) {
        return function(...args) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    /**
     * Clamps a value between a minimum and maximum.
     * @param {number} value The value to clamp.
     * @param {number} min The minimum allowed value.
     * @param {number} max The maximum allowed value.
     * @returns {number} The clamped value.
     */
    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    // --- Theme Handling ---

    /**
     * Sets the theme on the HTML element, saves preference, and updates the toggle button icon.
     * @param {string} theme - The theme to apply ('light' or 'dark').
     */
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-bs-theme', theme);
        localStorage.setItem(THEME_STORAGE_KEY, theme); // Persist choice
        updateThemeToggleButton(theme); // Update button appearance
        console.log(`Theme applied: ${theme}`);
    }

    /**
     * Updates the theme toggle button's icon based on the current theme.
     * @param {string} theme - The currently active theme ('light' or 'dark').
     */
    function updateThemeToggleButton(theme) {
         if (themeToggleBtn) {
            const icon = themeToggleBtn.querySelector('i'); // Get the <i> element inside the button
            if (icon) {
                if (theme === 'dark') {
                    // If dark mode is active, show the sun icon
                    icon.classList.remove('bi-moon-stars-fill');
                    icon.classList.add('bi-sun-fill');
                    themeToggleBtn.setAttribute('aria-label', 'Switch to light theme');
                } else {
                    // If light mode is active, show the moon icon
                    icon.classList.remove('bi-sun-fill');
                    icon.classList.add('bi-moon-stars-fill');
                    themeToggleBtn.setAttribute('aria-label', 'Switch to dark theme');
                }
            }
        }
    }

    /**
     * Loads the theme preference from localStorage on page load, defaulting to 'light'.
     */
    function loadInitialTheme() {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        // Optional: Could add logic here to check system preference if no theme is saved
        // const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme = savedTheme ? savedTheme : 'light'; // Default to light if no preference saved
        applyTheme(initialTheme); // Apply the loaded or default theme
    }

    /**
     * Handles the click event for the theme toggle button, switching the theme.
     */
    function handleThemeToggle() {
        const currentTheme = document.documentElement.getAttribute('data-bs-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark'; // Determine the opposite theme
        applyTheme(newTheme); // Apply the new theme
    }


    // --- Event Listeners Setup ---

    // Attach event listeners to the relevant DOM elements
    imageLoader.addEventListener('change', handleImageUpload);
    resetAllBtn.addEventListener('click', handleReset);
    themeToggleBtn.addEventListener('click', handleThemeToggle);
    // exportBtn.addEventListener('click', handleExport); // Add export listener when function is ready

    // Setup listeners for all filter sliders (except sharpness for now)
    setupSliderListeners();


    // --- Core Image Handling and Filtering Functions ---

    /**
     * Sets up 'input' event listeners for all filter sliders, applying debouncing.
     */
    function setupSliderListeners() {
        const sliders = [
            exposureSlider, contrastSlider, highlightsSlider, shadowsSlider,
            saturationSlider, temperatureSlider, tintSlider, sepiaSlider
            // sharpnessSlider excluded as its filter is not implemented
        ];

        // Create a debounced version of the applyFilters function
        const debouncedApplyFilters = debounce(applyFilters, 150); // Adjust delay as needed (e.g., 100-250ms)

        sliders.forEach(slider => {
            if(slider) { // Ensure the slider element exists
                 // Use the 'input' event for real-time feedback as the slider moves
                 slider.addEventListener('input', debouncedApplyFilters);
            }
        });
    }

    /**
     * Handles the file input change event: loads, reads, and displays the selected image.
     * @param {Event} e The 'change' event object from the file input.
     */
    function handleImageUpload(e) {
        const file = e.target.files[0]; // Get the selected file
        // Validate if a file was selected and if it's an image
        if (!file || !file.type.startsWith('image/')) {
            alert('Please select a valid image file (e.g., JPG, PNG).');
            imageLoader.value = ''; // Clear the file input
            resetCanvases();       // Clear any previous image
            return;
        }

        const reader = new FileReader(); // Create a FileReader to read the file content

        // Define what happens once the FileReader finishes reading the file
        reader.onload = function(event) {
            originalImage = new Image(); // Create a new Image object

            // Define what happens once the Image object successfully loads the image data
            originalImage.onload = function() {
                console.log(`Image loaded: ${originalImage.width}x${originalImage.height}`);

                // Set canvas dimensions to match the loaded image EXACTLY
                // This clears the canvas and sets its drawing surface size
                canvasBefore.width = originalImage.width;
                canvasBefore.height = originalImage.height;
                canvasAfter.width = originalImage.width;
                canvasAfter.height = originalImage.height;

                // Draw the original image onto the 'Before' canvas
                ctxBefore.drawImage(originalImage, 0, 0);
                // Draw the original image onto the 'After' canvas (it will be modified by filters)
                ctxAfter.drawImage(originalImage, 0, 0);

                resetAllSliders(); // Reset sliders to default positions visually
                console.log("Image drawn to both canvases.");
                // TODO: Enable sliders/buttons if they were disabled
            }

            // Handle errors during image object loading (e.g., corrupt image data)
            originalImage.onerror = function() {
                alert('Error loading the image data. The file might be corrupt or unsupported.');
                resetCanvases();
            }

            // Start loading the image data into the Image object using the Data URL from FileReader
            originalImage.src = event.target.result;
        }

        // Handle errors during the file reading process itself
        reader.onerror = function() {
            alert('Error reading the selected file.');
            resetCanvases();
        }

        // Start the asynchronous file reading process
        reader.readAsDataURL(file);
    }

     /**
     * Resets sliders visually to their defaults and redraws the original image to the 'After' canvas.
     */
    function handleReset() {
        // Only proceed if an image has been loaded
        if (!originalImage) {
            console.log("Reset called, but no image is loaded.");
            return;
        }

        console.log("Resetting filters and sliders...");
        resetAllSliders(); // Reset slider positions visually

        // Redraw the *original* image onto the 'After' canvas, discarding any filter effects
        ctxAfter.drawImage(originalImage, 0, 0);

        console.log("'After' canvas has been reset to the original image.");
    }


    /**
     * Resets all filter sliders to their default visual values (mostly 0).
     */
    function resetAllSliders() {
        console.log("Resetting sliders visually...");
        // Check if each slider exists before setting its value
        if(exposureSlider) exposureSlider.value = 0;
        if(contrastSlider) contrastSlider.value = 0;
        if(highlightsSlider) highlightsSlider.value = 0;
        if(shadowsSlider) shadowsSlider.value = 0;
        if(saturationSlider) saturationSlider.value = 0;
        if(temperatureSlider) temperatureSlider.value = 0;
        if(tintSlider) tintSlider.value = 0;
        if(sepiaSlider) sepiaSlider.value = 0;
        if(sharpnessSlider) sharpnessSlider.value = 0; // Reset even if disabled/unimplemented
    }

    /**
     * Clears both canvases and resets the application's image state.
     */
    function resetCanvases() {
         console.log("Clearing canvases and resetting image state.");
         // Clear the drawing areas
         ctxBefore.clearRect(0, 0, canvasBefore.width, canvasBefore.height);
         ctxAfter.clearRect(0, 0, canvasAfter.width, canvasAfter.height);

         // Reset the image variable
         originalImage = null;

         // Optional: Reset canvas dimensions to a default or 0
         // canvasBefore.width = 300; canvasBefore.height = 150; // Example placeholder size
         // canvasAfter.width = 300; canvasAfter.height = 150;

         // TODO: Disable sliders/buttons until a new image is loaded
    }


    /**
     * Applies all currently selected filter adjustments to the 'After' canvas.
     * Reads pixel data from the 'Before' canvas (containing the original image)
     * and writes the modified pixel data to the 'After' canvas.
     */
    function applyFilters() {
        // Only proceed if an image is loaded
        if (!originalImage) {
            // This might happen if sliders are moved before an image is loaded
            // or if called during reset/load sequences improperly.
            console.warn("ApplyFilters called but no originalImage is available.");
            return;
        }
        console.time('applyFilters'); // Start timing the filter application process

        // --- 1. Get Current Filter Values from Sliders ---
        // Parse slider values and normalize them into useful ranges for calculations
        const exposureValue = parseInt(exposureSlider.value, 10);       // -100 to 100 -> direct offset
        let contrastFactor = (parseInt(contrastSlider.value, 10) + 100) / 100; // -100 to 100 -> 0 to 2
        contrastFactor *= contrastFactor;                              // Square for more effect -> 0 to 4
        const highlightValue = parseInt(highlightsSlider.value, 10) / 100; // -100 to 100 -> -1 to 1
        const shadowValue = parseInt(shadowsSlider.value, 10) / 100;     // -100 to 100 -> -1 to 1
        const saturationValue = parseInt(saturationSlider.value, 10) / 100; // -100 to 100 -> -1 (grayscale) to 1 (double saturation)
        const temperatureValue = parseInt(temperatureSlider.value, 10);   // -100 (cool) to 100 (warm)
        const tintValue = parseInt(tintSlider.value, 10);             // -100 (green) to 100 (magenta)
        const sepiaValue = parseInt(sepiaSlider.value, 10) / 100;       // 0 to 100 -> 0 to 1 (blend factor)

        // --- 2. Get Original Pixel Data ---
        // Always read from the 'Before' canvas which holds the unmodified original image data.
        // This ensures filters are applied based on the original state, not compounded on previous edits.
        const imageData = ctxBefore.getImageData(0, 0, canvasBefore.width, canvasBefore.height);
        const data = imageData.data; // The actual pixel data array [R,G,B,A, R,G,B,A, ...]
        const len = data.length;     // Total number of elements in the array

        // --- 3. Apply Filters Pixel by Pixel ---
        // Iterate through the pixel data array, processing one pixel (4 elements: R, G, B, A) at a time.
        for (let i = 0; i < len; i += 4) {
            // Get the original RGB values for the current pixel
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            // We generally don't modify the alpha channel (data[i + 3])

            // Apply filters sequentially. The order can matter.
            // (Example: Applying saturation after sepia might yield different results than before)

            // a) Exposure (Brightness adjustment)
            r += exposureValue;
            g += exposureValue;
            b += exposureValue;

            // b) Contrast
            r = contrastFactor * (r - 128) + 128;
            g = contrastFactor * (g - 128) + 128;
            b = contrastFactor * (b - 128) + 128;

            // c) Temperature (Shift towards Red/Orange or Blue)
            if (temperatureValue > 0) { // Warmer
                r += temperatureValue * 0.6; // Increase red more
                b -= temperatureValue * 0.4; // Decrease blue
            } else { // Cooler (temperatureValue is negative)
                r += temperatureValue * 0.4; // Decrease red (add negative)
                b -= temperatureValue * 0.6; // Increase blue (subtract negative)
            }

            // d) Tint (Shift towards Green or Magenta)
            if (tintValue > 0) { // Magenta tint: Reduce Green
                g -= tintValue * 0.5;
            } else { // Green tint: Increase Green (tintValue is negative)
                g -= tintValue * 0.5; // Subtracting negative increases green
            }

            // e) Saturation
            // Calculate luminance (perceived brightness/grayscale value)
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            // Calculate saturation factor (0 = grayscale, 1 = normal, >1 = increased saturation)
            const satFactor = 1.0 + saturationValue;
            // Mix gray with the original color based on saturation factor
            r = gray + (r - gray) * satFactor;
            g = gray + (g - gray) * satFactor;
            b = gray + (b - gray) * satFactor;

            // f) Highlights & Shadows (Basic approach affecting bright/dark areas)
            const brightness = (r + g + b) / 765; // Rough brightness estimate (0 to 1)
            // Apply highlight adjustment (stronger effect on brighter pixels)
            if (highlightValue !== 0) {
                const highlightAmount = highlightValue * brightness * 255; // Scale adjustment
                r += highlightAmount; g += highlightAmount; b += highlightAmount;
            }
            // Apply shadow adjustment (stronger effect on darker pixels)
            if (shadowValue !== 0) {
                const shadowAmount = shadowValue * (1 - brightness) * 255; // Scale adjustment
                r += shadowAmount; g += shadowAmount; b += shadowAmount;
            }

            // g) Sepia
            if (sepiaValue > 0) {
                // Standard sepia RGB weights
                const sr = r * 0.393 + g * 0.769 + b * 0.189;
                const sg = r * 0.349 + g * 0.686 + b * 0.168;
                const sb = r * 0.272 + g * 0.534 + b * 0.131;
                // Blend the sepia result with the current color based on the slider value
                r = (1 - sepiaValue) * r + sepiaValue * sr;
                g = (1 - sepiaValue) * g + sepiaValue * sg;
                b = (1 - sepiaValue) * b + sepiaValue * sb;
            }

            // --- 4. Clamp Final Values ---
            // Ensure all RGB values are within the valid 0-255 range after all filters.
            data[i]     = clamp(r, 0, 255);
            data[i + 1] = clamp(g, 0, 255);
            data[i + 2] = clamp(b, 0, 255);
            // data[i + 3] remains the original alpha value
        }

        // --- 5. Put Modified Data onto 'After' Canvas ---
        // Write the modified pixel data back to the 'After' canvas
        ctxAfter.putImageData(imageData, 0, 0);

        console.timeEnd('applyFilters'); // Stop timing the filter application process
    }

    // --- Initial Setup Call ---
    // Load the saved theme preference (or default) when the page loads
    loadInitialTheme();


    // --- Placeholder for Export Functionality ---
    /*
    function handleExport() {
        if (!originalImage || !canvasAfter) {
            alert("Please load an image before exporting.");
            return;
        }

        const format = exportFormatSelect.value || 'image/png'; // Get selected format
        const filename = `edited_image.${format.split('/')[1]}`; // Basic filename

        canvasAfter.toBlob(function(blob) {
            if (blob) {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = filename;
                document.body.appendChild(link); // Required for Firefox
                link.click();
                document.body.removeChild(link); // Clean up
                URL.revokeObjectURL(link.href); // Release memory
                console.log(`Image exported as ${filename}`);
            } else {
                alert("Error creating image blob for export.");
            }
        }, format, 0.9); // Include format and quality (for JPEG)
    }
    // Remember to add the event listener:
    // exportBtn.addEventListener('click', handleExport);
    */


}); // End DOMContentLoaded wrapper