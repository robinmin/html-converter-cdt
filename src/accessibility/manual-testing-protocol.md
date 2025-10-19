# Manual Accessibility Testing Protocol
## HTML Converter CDT - WCAG 2.1 AA Compliance

This document outlines the manual testing procedures to ensure comprehensive accessibility compliance beyond automated testing.

### Testing Environment Setup

#### Required Tools
- **Screen Readers:**
  - NVDA (Windows) - Latest version
  - JAWS (Windows) - Latest version
  - VoiceOver (macOS) - Built-in
  - TalkBack (Android) - Built-in

- **Browser Testing:**
  - Chrome (Latest) with extensions
  - Firefox (Latest) with extensions
  - Safari (Latest) on macOS
  - Edge (Latest) on Windows

- **Testing Tools:**
  - WAVE Web Accessibility Evaluation Tool
  - axe DevTools Browser Extension
  - Colour Contrast Analyser
  - Keyboard-only testing setup

#### Browser Extensions Required
- axe DevTools
- WAVE Evaluation Tool
- High Contrast extension
- Accessibility Insights for Web

---

### 1. Keyboard Navigation Testing

#### 1.1 Tab Order Testing
**Procedure:**
1. Open the HTML converter interface
2. Press `Tab` repeatedly to navigate through all interactive elements
3. Press `Shift+Tab` to navigate backwards
4. Document the tab order and verify logical flow

**Expected Results:**
- All interactive elements are reachable via keyboard
- Tab order follows logical visual order
- No keyboard traps
- Focus is clearly visible on all elements

**Test Cases:**
- [ ] Navigate from URL input to HTML content input
- [ ] Navigate through format selection options
- [ ] Navigate through all conversion options
- [ ] Navigate to and activate convert button
- [ ] Navigate to download button when available
- [ ] Navigate through settings dialog controls
- [ ] Test skip link functionality

#### 1.2 Keyboard Shortcuts Testing
**Procedure:**
1. Test all documented keyboard shortcuts
2. Verify each shortcut works as expected
3. Test shortcuts in different contexts (normal, conversion in progress, dialog open)

**Shortcuts to Test:**
- [ ] `Ctrl+Enter` - Start conversion
- [ ] `Ctrl+D` - Download document (when available)
- [ ] `Escape` - Cancel conversion/close dialog
- [ ] `Alt+S` - Open settings dialog
- [ ] `Alt+H` - Jump to help section
- [ ] `Space/Enter` - Activate buttons and links
- [ ] Arrow keys - Navigate radio buttons and select options

#### 1.3 Focus Management Testing
**Procedure:**
1. Test focus behavior during dynamic content changes
2. Verify focus is properly managed in dialogs
3. Test focus restoration after closing dialogs

**Test Cases:**
- [ ] Focus moves to appropriate input when switching input methods
- [ ] Focus is trapped within settings dialog
- [ ] Focus is properly restored after closing settings
- [ ] Focus moves to results section after successful conversion
- [ ] Focus moves to error message after failed conversion

---

### 2. Screen Reader Testing

#### 2.1 NVDA Testing (Windows)
**Setup:**
1. Install NVDA (latest version)
2. Use default settings initially
3. Test with Firefox and Chrome

**Test Cases:**
- [ ] Page title is announced on load
- [ ] Skip link is announced and functional
- [ ] All landmarks are properly announced (banner, navigation, main, contentinfo)
- [ ] Heading structure is announced correctly
- [ ] Form labels are associated with controls
- [ ] Error messages are announced
- [ ] Progress updates are announced
- [ ] Success/error results are announced
- [ ] Dialog titles and content are announced
- [ ] Keyboard navigation is announced

#### 2.2 JAWS Testing (Windows)
**Setup:**
1. Install JAWS (latest version)
2. Test with default settings
3. Test in both Chrome and Firefox

**Test Cases:**
- [ ] Page structure is announced correctly
- [ ] All interactive elements have accessible names
- [ ] Forms are properly announced
- [ ] Dynamic content changes are announced
- [ ] Virtual cursor navigation works correctly
- [ ] Tables (if any) are properly announced
- [ ] Lists are properly announced

#### 2.3 VoiceOver Testing (macOS)
**Setup:**
1. Enable VoiceOver in System Preferences
2. Test with Safari (primary) and Chrome
3. Use default rotor settings

**Test Cases:**
- [ ] Page loads with proper announcement
- [ ] Landmarks are available in rotor
- [ ] Headings are properly structured in rotor
- [ ] Form controls are properly announced
- [ ] Focus management works correctly
- [ ] Touch gestures work on mobile (if testing mobile version)

---

### 3. Visual Accessibility Testing

#### 3.1 Color Contrast Testing
**Tools:**
- WebAIM Contrast Checker
- Colour Contrast Analyser
- Chrome DevTools Contrast Checker

**Test Cases:**
- [ ] All text meets WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text)
- [ ] Interactive elements have sufficient contrast
- [ ] Focus indicators meet contrast requirements
- [ ] Error states have sufficient contrast
- [ ] Success states have sufficient contrast

#### 3.2 High Contrast Mode Testing
**Procedure:**
1. Enable high contrast mode in OS settings
2. Test interface with high contrast theme
3. Verify all elements remain visible and usable

**Test Cases:**
- [ ] High contrast theme applies correctly
- [ ] All text remains readable
- [ ] Focus indicators remain visible
- [ ] Interactive elements remain identifiable
- [ ] Custom CSS variables work with high contrast

#### 3.3 Zoom and Magnification Testing
**Procedure:**
1. Test browser zoom at 200%, 300%, and 400%
2. Test with OS magnifier if available
3. Verify content remains functional

**Test Cases:**
- [ ] Interface remains usable at 200% zoom
- [ ] Horizontal scrolling is minimized
- [ ] No content overlaps
- [ ] All controls remain accessible
- [ ] Text remains readable at high zoom levels

---

### 4. Mobile Accessibility Testing

#### 4.1 Touch Target Testing
**Procedure:**
1. Test on actual mobile devices or browser emulation
2. Verify minimum touch target size (44x44px)
3. Test with various finger sizes

**Test Cases:**
- [ ] All buttons meet minimum touch target size
- [ ] Links have adequate spacing
- [ ] Form controls are easily tappable
- [ ] No touch targets are too close together

#### 4.2 Mobile Screen Reader Testing
**Procedure:**
1. Test with TalkBack on Android
2. Test with VoiceOver on iOS
3. Test interface gestures

**Test Cases:**
- [ ] All elements are accessible via swipe gestures
- [ ] Double-tap activation works
- [ ] Context menus work correctly
- [ ] Reading order matches visual order

#### 4.3 Orientation Testing
**Procedure:**
1. Test in portrait and landscape orientations
2. Verify functionality in both orientations
3. Test zoom behavior

**Test Cases:**
- [ ] Interface works in portrait mode
- [ ] Interface works in landscape mode
- [ ] Content reflows properly
- [ ] No horizontal scrolling in portrait mode

---

### 5. Cognitive Accessibility Testing

#### 5.1 Language and Readability
**Test Cases:**
- [ ] Language attribute is correctly set
- [ ] Text is clear and simple
- [ ] Instructions are easy to understand
- [ ] Error messages are helpful and clear

#### 5.2 Consistency and Predictability
**Test Cases:**
- [ ] Interface elements are consistent
- [ ] Navigation is predictable
- [ ] Feedback is consistent across actions
- [ ] Help information is available and accessible

#### 5.3 Focus and Memory Support
**Test Cases:**
- [ ] Progress is clearly indicated
- [ ] User's place is maintained during processes
- [ ] Clear indicators for current step/status
- [ ] Time limits are controllable or sufficient

---

### 6. Conversion Workflow Testing

#### 6.1 Input Method Testing
**Test Cases:**
- [ ] URL input is accessible with all assistive technologies
- [ ] HTML content input is accessible with screen readers
- [ ] File upload is accessible and provides feedback
- [ ] Input validation errors are properly announced

#### 6.2 Format Selection Testing
**Test Cases:**
- [ ] All format options are accessible
- [ ] Format changes are properly announced
- [ ] Format-specific options appear/disappear correctly
- [ ] Custom format options are accessible

#### 6.3 Conversion Process Testing
**Test Cases:**
- [ ] Conversion start is announced
- [ ] Progress updates are announced at appropriate intervals
- [ ] Cancel functionality is accessible
- [ ] Success results are properly announced
- [ ] Error messages are clear and actionable
- [ ] Download functionality is accessible

---

### 7. Error Handling and Recovery Testing

#### 7.1 Validation Error Testing
**Test Cases:**
- [ ] Invalid URLs show clear error messages
- [ ] Invalid HTML content is properly handled
- [ ] Invalid file types are rejected with clear messages
- [ ] Empty input validation works correctly

#### 7.2 System Error Testing
**Test Cases:**
- [ ] Network errors are handled gracefully
- [ ] Time-out errors provide clear feedback
- [ ] Server errors are communicated effectively
- [ ] Recovery suggestions are helpful and accessible

#### 7.3 Error Recovery Testing
**Test Cases:**
- [ ] Retry functionality works correctly
- [ ] Form state is preserved after errors
- [ ] Users can easily correct input errors
- [ ] Error messages don't disappear too quickly

---

### 8. Documentation Testing

#### 8.1 Help Content Testing
**Test Cases:**
- [ ] Help section is accessible
- [ ] Keyboard shortcuts are documented accessibly
- [ ] Instructions are clear and actionable
- [ ] Accessibility features are documented

#### 8.2 Instructions and Labels Testing
**Test Cases:**
- [ ] All form fields have clear labels
- [ ] Instructions are provided for complex tasks
- [ ] Help text is associated with controls
- [ ] Placeholder text is not used as a replacement for labels

---

### Testing Checklist Summary

#### Automated Tests (axe-core)
- [ ] All WCAG 2.1 AA rules pass
- [ ] No color contrast violations
- [ ] No keyboard navigation violations
- [ ] No ARIA violations
- [ ] No semantic HTML violations

#### Manual Tests Required
- [ ] Keyboard navigation fully functional
- [ ] Screen reader compatibility verified
- [ ] Visual accessibility confirmed
- [ ] Mobile accessibility tested
- [ ] Cognitive accessibility considered
- [ ] Error handling accessible
- [ ] Documentation accessible

#### Cross-Platform Testing
- [ ] Windows (NVDA, JAWS)
- [ ] macOS (VoiceOver)
- [ ] Android (TalkBack)
- [ ] iOS (VoiceOver)
- [ ] Multiple browsers tested

---

### Bug Reporting Template

When accessibility issues are found, report with:

1. **Issue Description:** Clear description of the accessibility problem
2. **WCAG Guideline:** Which WCAG 2.1 guideline is violated
3. **Assistive Technology:** Which screen reader/assistive technology was used
4. **Browser/Platform:** Browser version and operating system
5. **Steps to Reproduce:** Detailed steps to reproduce the issue
6. **Expected Behavior:** What should happen for accessibility
7. **Actual Behavior:** What actually happens
8. **Severity:** Impact on users (Critical, High, Medium, Low)
9. **Suggested Fix:** Recommended solution if known

---

### Regression Testing Schedule

- **Before each release:** Full accessibility testing suite
- **After major UI changes:** Complete retesting
- **After minor changes:** Targeted testing of affected areas
- **Monthly:** Automated testing + manual spot checks
- **Quarterly:** Comprehensive manual testing

This protocol should be followed for each release to ensure continued accessibility compliance.
