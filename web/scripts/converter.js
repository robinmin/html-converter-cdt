/**
 * HTML Converter CDT - Accessible Web Interface
 *
 * This JavaScript file implements the accessibility features for the web interface,
 * including keyboard navigation, ARIA live regions, focus management, and screen reader support.
 */

// Import the HTML converter library
import { HTMLConverter } from "../../src/api/html-converter.js"

/**
 * Accessibility-enhanced HTML Converter Interface
 */
class AccessibleConverter {
  constructor() {
    this.converter = null
    this.currentConversion = null
    this.isConverting = false
    this.settings = this.loadSettings()

    this.initializeElements()
    this.setupEventListeners()
    this.setupKeyboardNavigation()
    this.setupAccessibilityFeatures()
    this.applySettings()
  }

  /**
   * Initialize DOM element references
   */
  initializeElements() {
    // Input elements
    this.urlInput = document.getElementById("url-field")
    this.htmlInput = document.getElementById("html-field")
    this.fileInput = document.getElementById("file-field")

    // Input method radios
    this.urlRadio = document.getElementById("url-input")
    this.htmlRadio = document.getElementById("html-input")
    this.fileRadio = document.getElementById("file-input")

    // Input groups
    this.urlInputGroup = document.getElementById("url-input-group")
    this.htmlInputGroup = document.getElementById("html-input-group")
    this.fileInputGroup = document.getElementById("file-input-group")

    // Format selection
    this.formatRadios = document.querySelectorAll("input[name=\"output-format\"]")

    // Options
    this.filenameInput = document.getElementById("filename-input")
    this.paperSizeSelect = document.getElementById("paper-size")
    this.imageQualityInput = document.getElementById("image-quality")
    this.includeBackgroundCheckbox = document.getElementById("include-background")
    this.includeMetadataCheckbox = document.getElementById("include-metadata")

    // Buttons
    this.convertButton = document.getElementById("convert-button")
    this.cancelButton = document.getElementById("cancel-button")
    this.downloadButton = document.getElementById("download-button")
    this.retryButton = document.getElementById("retry-button")

    // Progress elements
    this.progressContainer = document.getElementById("progress-container")
    this.progressBar = document.getElementById("progress-bar")
    this.progressPercentage = document.getElementById("progress-percentage")
    this.progressMessage = document.getElementById("progress-message")
    this.currentStep = document.getElementById("current-step")

    // Results
    this.resultsContainer = document.getElementById("results-container")
    this.successResult = document.getElementById("success-result")
    this.errorResult = document.getElementById("error-result")

    // Settings dialog
    this.settingsDialog = document.getElementById("settings-dialog")
    this.settingsOpenButton = document.querySelector("[href=\"#settings\"]")
    this.settingsCloseButton = document.getElementById("settings-close-button")
    this.settingsSaveButton = document.getElementById("settings-save-button")
    this.settingsCancelButton = document.getElementById("settings-cancel-button")

    // Settings controls
    this.themeSelect = document.getElementById("theme-select")
    this.fontSizeSelect = document.getElementById("font-size-select")
    this.timeoutInput = document.getElementById("timeout-input")

    // Live regions for announcements
    this.conversionAnnouncement = document.getElementById("conversion-announcement")
    this.errorAnnouncement = document.getElementById("error-announcement")
    this.statusAnnouncement = document.getElementById("status-announcement")
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Input method change
    [this.urlRadio, this.htmlRadio, this.fileRadio].forEach((radio) => {
      radio.addEventListener("change", this.handleInputMethodChange.bind(this))
    })

    // Format change
    this.formatRadios.forEach((radio) => {
      radio.addEventListener("change", this.handleFormatChange.bind(this))
    })

    // Image quality slider
    this.imageQualityInput?.addEventListener("input", this.handleImageQualityChange.bind(this))

    // Convert button
    this.convertButton.addEventListener("click", this.handleConvert.bind(this))

    // Cancel button
    this.cancelButton.addEventListener("click", this.handleCancel.bind(this))

    // Download button
    this.downloadButton.addEventListener("click", this.handleDownload.bind(this))

    // Retry button
    this.retryButton.addEventListener("click", this.handleRetry.bind(this))

    // Settings dialog
    this.settingsOpenButton?.addEventListener("click", this.openSettingsDialog.bind(this))
    this.settingsCloseButton.addEventListener("click", this.closeSettingsDialog.bind(this))
    this.settingsSaveButton.addEventListener("click", this.saveSettings.bind(this))
    this.settingsCancelButton.addEventListener("click", this.closeSettingsDialog.bind(this))

    // Settings controls
    this.themeSelect.addEventListener("change", this.handleThemeChange.bind(this))
    this.fontSizeSelect.addEventListener("change", this.handleFontSizeChange.bind(this))

    // Dialog overlay click
    this.settingsDialog.addEventListener("click", this.handleDialogOverlayClick.bind(this))

    // Form validation
    this.urlInput?.addEventListener("input", this.validateUrlInput.bind(this))
    this.htmlInput?.addEventListener("input", this.validateHtmlInput.bind(this))
    this.fileInput?.addEventListener("change", this.validateFileInput.bind(this))
  }

  /**
   * Setup keyboard navigation
   */
  setupKeyboardNavigation() {
    // Global keyboard shortcuts
    document.addEventListener("keydown", this.handleGlobalKeydown.bind(this))

    // Ensure proper tab order in dialogs
    this.settingsDialog.addEventListener("keydown", this.handleDialogKeydown.bind(this))
  }

  /**
   * Setup accessibility features
   */
  setupAccessibilityFeatures() {
    // Detect user preferences
    this.detectUserPreferences()

    // Setup ARIA live regions
    this.setupLiveRegions()

    // Setup focus management
    this.setupFocusManagement()

    // Setup screen reader announcements
    this.setupScreenReaderSupport()
  }

  /**
   * Handle input method change
   */
  handleInputMethodChange(event) {
    const selectedMethod = event.target.value

    // Hide all input groups
    this.urlInputGroup.classList.add("hidden")
    this.htmlInputGroup.classList.add("hidden")
    this.fileInputGroup.classList.add("hidden")

    // Show selected input group
    switch (selectedMethod) {
      case "url":
        this.urlInputGroup.classList.remove("hidden")
        this.urlInput.focus()
        break
      case "html":
        this.htmlInputGroup.classList.remove("hidden")
        this.htmlInput.focus()
        break
      case "file":
        this.fileInputGroup.classList.remove("hidden")
        this.fileInput.focus()
        break
    }

    // Announce change to screen readers
    this.announceToScreenReader(`Switched to ${selectedMethod} input mode`)
  }

  /**
   * Handle format change
   */
  handleFormatChange(event) {
    const format = event.target.value

    // Show/hide format-specific options
    const pdfOptions = document.getElementById("pdf-options")
    const imageOptions = document.getElementById("image-options")

    if (pdfOptions) {
      pdfOptions.classList.toggle("hidden", format !== "pdf")
    }

    if (imageOptions) {
      imageOptions.classList.toggle("hidden", !["png", "jpeg"].includes(format))
    }

    // Announce format change
    this.announceToScreenReader(`Output format changed to ${format.toUpperCase()}`)
  }

  /**
   * Handle image quality change
   */
  handleImageQualityChange(event) {
    const quality = event.target.value
    const qualityDisplay = document.getElementById("image-quality-value")

    if (qualityDisplay) {
      qualityDisplay.textContent = `${quality}%`
    }

    // Announce quality change
    this.announceToScreenReader(`Image quality set to ${quality}%`)
  }

  /**
   * Handle conversion
   */
  async handleConvert() {
    if (this.isConverting) {
      return
    }

    // Validate input
    const input = this.getInput()
    const format = this.getSelectedFormat()

    if (!input) {
      this.showError("Please provide a URL, HTML content, or file to convert.")
      return
    }

    if (!format) {
      this.showError("Please select an output format.")
      return
    }

    // Start conversion
    this.startConversion(input, format)
  }

  /**
   * Start conversion process
   */
  async startConversion(input, format) {
    this.isConverting = true
    this.updateUIForConversionStart()

    try {
      // Initialize converter if not already done
      if (!this.converter) {
        this.converter = new HTMLConverter({
          config: {
            defaultTimeout: (this.settings.timeout || 30) * 1000,
            enableProgressiveEnhancement: true,
            chromeCDP: {
              enabled: true,
              headless: true,
            },
          },
        })

        // Setup event listeners
        this.setupConverterEvents()
      }

      // Get conversion options
      const options = this.getConversionOptions(format)

      // Start conversion
      const result = await this.converter.convert(input, format, options)

      // Handle success
      this.handleConversionSuccess(result)
    } catch (error) {
      // Handle error
      this.handleConversionError(error)
    } finally {
      this.isConverting = false
      this.updateUIForConversionEnd()
    }
  }

  /**
   * Setup converter event listeners
   */
  setupConverterEvents() {
    if (!this.converter) {
      return
    }

    this.converter.on("conversion-progress", (event) => {
      this.updateProgress(event.data.progress)
    })
  }

  /**
   * Update progress UI
   */
  updateProgress(progress) {
    if (this.progressBar) {
      this.progressBar.style.width = `${progress.percentage}%`
      this.progressBar.setAttribute("aria-valuenow", progress.percentage)
    }

    if (this.progressPercentage) {
      this.progressPercentage.textContent = `${progress.percentage}%`
    }

    if (this.progressMessage) {
      this.progressMessage.textContent = progress.message
    }

    if (this.currentStep) {
      this.currentStep.textContent = `Step ${progress.currentStepNumber} of ${progress.totalSteps}: ${progress.currentStep}`
    }

    // Announce progress to screen readers
    if (progress.percentage % 25 === 0) { // Announce every 25%
      this.announceToScreenReader(`Conversion progress: ${progress.percentage}%. ${progress.message}`)
    }
  }

  /**
   * Handle conversion success
   */
  handleConversionSuccess(result) {
    this.currentConversion = result

    // Update results UI
    this.updateResultsUI(result)

    // Focus on results
    this.resultsContainer.focus()

    // Announce success
    this.announceToScreenReader(`Conversion completed successfully. Document converted to ${result.format.toUpperCase()} format.`)
  }

  /**
   * Handle conversion error
   */
  handleConversionError(error) {
    console.error("Conversion error:", error)

    // Update error UI
    this.updateErrorUI(error)

    // Focus on error message
    this.errorResult.focus()

    // Announce error
    this.announceToScreenReader(`Conversion failed: ${error.message}`, true)
  }

  /**
   * Update UI for conversion start
   */
  updateUIForConversionStart() {
    // Disable controls
    this.setControlsDisabled(true)

    // Show progress
    this.progressContainer.classList.remove("hidden")
    this.resultsContainer.classList.add("hidden")

    // Update button
    this.convertButton.setAttribute("aria-busy", "true")
    this.convertButton.querySelector(".button-text").textContent = "Converting..."
    this.convertButton.querySelector(".button-spinner").classList.remove("hidden")

    // Show cancel button
    this.cancelButton.classList.remove("hidden")

    // Announce start
    this.announceToScreenReader("Conversion started")
  }

  /**
   * Update UI for conversion end
   */
  updateUIForConversionEnd() {
    // Enable controls
    this.setControlsDisabled(false)

    // Update button
    this.convertButton.setAttribute("aria-busy", "false")
    this.convertButton.querySelector(".button-text").textContent = "Convert Document"
    this.convertButton.querySelector(".button-spinner").classList.add("hidden")

    // Hide cancel button
    this.cancelButton.classList.add("hidden")
  }

  /**
   * Set controls disabled state
   */
  setControlsDisabled(disabled) {
    const controls = [
      this.urlInput,
      this.htmlInput,
      this.fileInput,
      this.filenameInput,
      this.paperSizeSelect,
      this.imageQualityInput,
      this.includeBackgroundCheckbox,
      this.includeMetadataCheckbox,
      ...this.formatRadios,
      ...document.querySelectorAll("input[name=\"input-method\"]"),
    ]

    controls.forEach((control) => {
      if (control) {
        control.disabled = disabled
      }
    })

    this.convertButton.disabled = disabled
  }

  /**
   * Handle cancel conversion
   */
  handleCancel() {
    if (this.converter && this.currentConversion) {
      this.converter.cancelConversion(this.currentConversion.conversionId)
    }

    this.isConverting = false
    this.updateUIForConversionEnd()

    // Announce cancellation
    this.announceToScreenReader("Conversion cancelled")
  }

  /**
   * Handle download
   */
  async handleDownload() {
    if (!this.currentConversion) {
      return
    }

    try {
      // Create download link
      const blob = new Blob([this.currentConversion.content], {
        type: this.currentConversion.mimeType,
      })

      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = this.currentConversion.suggestedFileName

      // Trigger download
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up
      URL.revokeObjectURL(url)

      // Announce download
      this.announceToScreenReader(`Download started: ${this.currentConversion.suggestedFileName}`)
    } catch (error) {
      console.error("Download error:", error)
      this.showError("Failed to download the converted document.")
    }
  }

  /**
   * Handle retry
   */
  handleRetry() {
    // Hide results and start over
    this.resultsContainer.classList.add("hidden")
    this.errorResult.classList.add("hidden")

    // Focus on first input
    const activeInputMethod = document.querySelector("input[name=\"input-method\"]:checked")
    if (activeInputMethod) {
      this.handleInputMethodChange({ target: activeInputMethod })
    }
  }

  /**
   * Get current input
   */
  getInput() {
    const activeMethod = document.querySelector("input[name=\"input-method\"]:checked")?.value

    switch (activeMethod) {
      case "url":
        return this.urlInput?.value.trim()
      case "html":
        return this.htmlInput?.value.trim()
      case "file":
        return this.fileInput?.files?.[0]
      default:
        return null
    }
  }

  /**
   * Get selected format
   */
  getSelectedFormat() {
    return document.querySelector("input[name=\"output-format\"]:checked")?.value
  }

  /**
   * Get conversion options
   */
  getConversionOptions(format) {
    const options = {
      includeMetadata: this.includeMetadataCheckbox?.checked ?? true,
      includeBackground: this.includeBackgroundCheckbox?.checked ?? true,
    }

    // Add format-specific options
    if (format === "pdf") {
      options.format = this.paperSizeSelect?.value || "A4"
    }

    if (["png", "jpeg"].includes(format)) {
      options.quality = Number.parseInt(this.imageQualityInput?.value) || 80
    }

    // Add custom filename if provided
    if (this.filenameInput?.value.trim()) {
      options.filename = this.filenameInput.value.trim()
    }

    return options
  }

  /**
   * Update results UI
   */
  updateResultsUI(result) {
    // Update success result
    const resultMessage = document.getElementById("result-message")
    if (resultMessage) {
      resultMessage.textContent = `Your document has been successfully converted to ${result.format.toUpperCase()} format.`
    }

    // Update metadata
    const resultFormat = document.getElementById("result-format")
    const resultSize = document.getElementById("result-size")
    const resultTime = document.getElementById("result-time")
    const resultMethod = document.getElementById("result-method")

    if (resultFormat) {
      resultFormat.textContent = result.format.toUpperCase()
    }
    if (resultSize) {
      resultSize.textContent = this.formatFileSize(result.content?.length || 0)
    }
    if (resultTime) {
      resultTime.textContent = `${(result.performance?.conversionTime || 0).toFixed(2)}ms`
    }
    if (resultMethod) {
      resultMethod.textContent = result.conversionTier || "Unknown"
    }

    // Show success result
    this.successResult.classList.remove("hidden")
    this.errorResult.classList.add("hidden")
    this.resultsContainer.classList.remove("hidden")

    // Make results region focusable
    this.resultsContainer.setAttribute("tabindex", "-1")
  }

  /**
   * Update error UI
   */
  updateErrorUI(error) {
    // Update error message
    const errorMessage = document.getElementById("error-message")
    const errorDescription = document.getElementById("error-description")
    const recoveryList = document.getElementById("recovery-list")

    if (errorMessage) {
      errorMessage.textContent = error.message || "An unknown error occurred during conversion."
    }

    if (errorDescription) {
      errorDescription.textContent = error.details || error.stack || "No additional error details available."
    }

    if (recoveryList && error.recoverySuggestions) {
      recoveryList.innerHTML = ""
      error.recoverySuggestions.forEach((suggestion) => {
        const li = document.createElement("li")
        li.textContent = suggestion
        recoveryList.appendChild(li)
      })
    }

    // Show error result
    this.errorResult.classList.remove("hidden")
    this.successResult.classList.add("hidden")
    this.resultsContainer.classList.remove("hidden")

    // Make results region focusable
    this.resultsContainer.setAttribute("tabindex", "-1")
  }

  /**
   * Show error message
   */
  showError(message) {
    // Update error announcement
    if (this.errorAnnouncement) {
      this.errorAnnouncement.textContent = message
    }

    // Also show as temporary alert
    const alertDiv = document.createElement("div")
    alertDiv.className = "error-toast"
    alertDiv.setAttribute("role", "alert")
    alertDiv.setAttribute("aria-live", "assertive")
    alertDiv.textContent = message

    document.body.appendChild(alertDiv)

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.parentNode.removeChild(alertDiv)
      }
    }, 5000)
  }

  /**
   * Format file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) {
      return "0 Bytes"
    }

    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return Number.parseFloat((bytes / k ** i).toFixed(2)) + " " + sizes[i]
  }

  /**
   * Handle global keyboard shortcuts
   */
  handleGlobalKeydown(event) {
    // Ignore when typing in input fields
    if (event.target.matches("input, textarea, select")) {
      return
    }

    // Ctrl+Enter: Convert
    if (event.ctrlKey && event.key === "Enter") {
      event.preventDefault()
      this.handleConvert()
      return
    }

    // Ctrl+D: Download (when available)
    if (event.ctrlKey && event.key === "d" && this.currentConversion) {
      event.preventDefault()
      this.handleDownload()
      return
    }

    // Escape: Cancel conversion or close dialog
    if (event.key === "Escape") {
      event.preventDefault()
      if (this.isConverting) {
        this.handleCancel()
      } else if (!this.settingsDialog.classList.contains("hidden")) {
        this.closeSettingsDialog()
      }
      return
    }

    // Alt+S: Open settings
    if (event.altKey && event.key === "s") {
      event.preventDefault()
      this.openSettingsDialog()
      return
    }

    // Alt+H: Jump to help
    if (event.altKey && event.key === "h") {
      event.preventDefault()
      document.getElementById("help").scrollIntoView()
    }
  }

  /**
   * Handle dialog keyboard navigation
   */
  handleDialogKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault()
      this.closeSettingsDialog()
      return
    }

    if (event.key === "Tab") {
      // Trap focus within dialog
      const focusableElements = this.settingsDialog.querySelectorAll(
        "button, input, select, textarea, [href], [tabindex]:not([tabindex=\"-1\"])",
      )

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }
  }

  /**
   * Open settings dialog
   */
  openSettingsDialog() {
    this.settingsDialog.classList.remove("hidden")
    this.settingsCloseButton.focus()

    // Announce dialog opening
    this.announceToScreenReader("Settings dialog opened")
  }

  /**
   * Close settings dialog
   */
  closeSettingsDialog() {
    this.settingsDialog.classList.add("hidden")

    // Return focus to settings link
    this.settingsOpenButton?.focus()

    // Announce dialog closing
    this.announceToScreenReader("Settings dialog closed")
  }

  /**
   * Handle dialog overlay click
   */
  handleDialogOverlayClick(event) {
    if (event.target === this.settingsDialog) {
      this.closeSettingsDialog()
    }
  }

  /**
   * Handle theme change
   */
  handleThemeChange(event) {
    const theme = event.target.value
    this.applyTheme(theme)
  }

  /**
   * Handle font size change
   */
  handleFontSizeChange(event) {
    const fontSize = event.target.value
    this.applyFontSize(fontSize)
  }

  /**
   * Apply theme
   */
  applyTheme(theme) {
    if (theme === "system") {
      // Remove theme attribute to let system preference take effect
      document.documentElement.removeAttribute("data-theme")
    } else {
      document.documentElement.setAttribute("data-theme", theme)
    }

    // Announce theme change
    this.announceToScreenReader(`Theme changed to ${theme}`)
  }

  /**
   * Apply font size
   */
  applyFontSize(fontSize) {
    document.documentElement.setAttribute("data-font-size", fontSize)

    // Announce font size change
    this.announceToScreenReader(`Font size changed to ${fontSize}`)
  }

  /**
   * Load settings from localStorage
   */
  loadSettings() {
    try {
      const saved = localStorage.getItem("html-converter-settings")
      return saved ? JSON.parse(saved) : this.getDefaultSettings()
    } catch {
      return this.getDefaultSettings()
    }
  }

  /**
   * Get default settings
   */
  getDefaultSettings() {
    return {
      theme: "system",
      fontSize: "medium",
      timeout: 30,
    }
  }

  /**
   * Save settings
   */
  saveSettings() {
    this.settings = {
      theme: this.themeSelect.value,
      fontSize: this.fontSizeSelect.value,
      timeout: Number.parseInt(this.timeoutInput.value) || 30,
    }

    try {
      localStorage.setItem("html-converter-settings", JSON.stringify(this.settings))
    } catch (error) {
      console.error("Failed to save settings:", error)
    }

    this.closeSettingsDialog()

    // Announce settings saved
    this.announceToScreenReader("Settings saved successfully")
  }

  /**
   * Apply loaded settings
   */
  applySettings() {
    this.applyTheme(this.settings.theme)
    this.applyFontSize(this.settings.fontSize)

    if (this.themeSelect) {
      this.themeSelect.value = this.settings.theme
    }
    if (this.fontSizeSelect) {
      this.fontSizeSelect.value = this.settings.fontSize
    }
    if (this.timeoutInput) {
      this.timeoutInput.value = this.settings.timeout
    }
  }

  /**
   * Detect user preferences
   */
  detectUserPreferences() {
    // Detect reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.documentElement.setAttribute("data-reduced-motion", "true")
    }

    // Detect high contrast preference
    if (window.matchMedia("(prefers-contrast: high)").matches) {
      document.documentElement.setAttribute("data-high-contrast", "true")
    }
  }

  /**
   * Setup live regions
   */
  setupLiveRegions() {
    // Live regions are already in HTML, just ensure they're properly configured
    [this.conversionAnnouncement, this.errorAnnouncement, this.statusAnnouncement].forEach((region) => {
      if (region) {
        region.setAttribute("aria-live", "polite")
        region.setAttribute("aria-atomic", "true")
      }
    })
  }

  /**
   * Setup focus management
   */
  setupFocusManagement() {
    // Manage focus for dynamic content
    this.setupFocusForInputMethodChanges()
    this.setupFocusForResults()
    this.setupFocusForDialogs()
  }

  /**
   * Setup focus for input method changes
   */
  setupFocusForInputMethodChanges() {
    // Focus management handled in handleInputMethodChange
  }

  /**
   * Setup focus for results
   */
  setupFocusForResults() {
    // Results focus handled in success/error handlers
  }

  /**
   * Setup focus for dialogs
   */
  setupFocusForDialogs() {
    // Dialog focus handled in dialog open/close methods
  }

  /**
   * Setup screen reader support
   */
  setupScreenReaderSupport() {
    // Add additional ARIA attributes as needed
    this.enhanceARIAAttributes()
    this.setupScreenReaderAnnouncements()
  }

  /**
   * Enhance ARIA attributes
   */
  enhanceARIAAttributes() {
    // Add ARIA attributes to interactive elements
    const interactiveElements = document.querySelectorAll("button, input, select, textarea, a")
    interactiveElements.forEach((element) => {
      if (!element.hasAttribute("aria-label") && !element.hasAttribute("aria-labelledby")) {
        // Add aria-label based on content if needed
        if (element.textContent.trim()) {
          element.setAttribute("aria-label", element.textContent.trim())
        }
      }
    })
  }

  /**
   * Setup screen reader announcements
   */
  setupScreenReaderAnnouncements() {
    // Announcements handled through announceToScreenReader method
  }

  /**
   * Announce message to screen readers
   */
  announceToScreenReader(message, isAssertive = false) {
    const announcement = isAssertive ? this.errorAnnouncement : this.conversionAnnouncement

    if (announcement) {
      announcement.textContent = message

      // Clear after announcement to allow repeated announcements
      setTimeout(() => {
        announcement.textContent = ""
      }, 1000)
    }
  }

  /**
   * Input validation methods
   */
  validateUrlInput() {
    const url = this.urlInput?.value.trim()
    const errorElement = document.getElementById("url-error")

    if (!url) {
      this.showInputError(errorElement, "URL is required")
      return false
    }

    try {
      void URL.canParse(url)
      this.clearInputError(errorElement)
      return true
    } catch {
      this.showInputError(errorElement, "Please enter a valid URL")
      return false
    }
  }

  validateHtmlInput() {
    const html = this.htmlInput?.value.trim()
    const errorElement = document.getElementById("html-error")

    if (!html) {
      this.showInputError(errorElement, "HTML content is required")
      return false
    }

    if (!html.trim().startsWith("<")) {
      this.showInputError(errorElement, "Please enter valid HTML content")
      return false
    }

    this.clearInputError(errorElement)
    return true
  }

  validateFileInput() {
    const file = this.fileInput?.files?.[0]
    const errorElement = document.getElementById("file-error")

    if (!file) {
      this.showInputError(errorElement, "Please select a file")
      return false
    }

    if (!file.name.match(/\.html?$/i)) {
      this.showInputError(errorElement, "Please select an HTML file")
      return false
    }

    this.clearInputError(errorElement)
    return true
  }

  showInputError(errorElement, message) {
    if (errorElement) {
      errorElement.textContent = message
      errorElement.style.display = "block"
    }
  }

  clearInputError(errorElement) {
    if (errorElement) {
      errorElement.textContent = ""
      errorElement.style.display = "none"
    }
  }
}

// Initialize the converter when the DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Check for required browser features
  if (!window.Promise || !window.fetch) {
    const errorDiv = document.createElement("div")
    errorDiv.className = "browser-error"
    errorDiv.setAttribute("role", "alert")
    errorDiv.innerHTML = `
      <h2>Browser Not Supported</h2>
      <p>Your browser doesn't support the features required for this application. Please update to a modern browser.</p>
    `
    document.body.appendChild(errorDiv)
    return
  }

  // Initialize the accessible converter
  window.accessibleConverter = new AccessibleConverter()

  // Announce page load to screen readers
  setTimeout(() => {
    const announcement = document.getElementById("status-announcement")
    if (announcement) {
      announcement.textContent = "HTML Converter interface loaded. Use Tab to navigate or Alt+H for help."
    }
  }, 1000)
})

// Export for testing
export { AccessibleConverter }
