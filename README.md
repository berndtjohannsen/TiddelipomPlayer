# TiddelipomPlayer
RSS pod player as chrome (only) extension
(this is the continuation of the repository "SidebarRSS, which is no more maintained)
This is still very much work in progress

To test: upload all files in Chrome (chrome://extensions)

Remaining work:
- package for easy upload
- support for pod search
- support for direect audio (channel)
- better looks ..

## Styling Guide

The extension comes with a standalone HTML version that can be used for styling purposes. Any styles applied to the standalone version (except width-related properties) will work in both the standalone and extension versions.

### What Can Be Styled

1. Typography
   - Font sizes, families, and weights
   - Line heights
   - Text colors
   - Text overflow/ellipsis behavior

2. Colors
   - Background colors
   - Text colors
   - Border colors
   - Hover state colors
   - Played/unplayed state colors

3. Spacing and Layout (except width-related)
   - Padding and margins
   - Grid gap adjustments
   - Row heights
   - Vertical spacing between sections

4. Visual Effects
   - Border styles
   - Border radius
   - Box shadows
   - Opacity
   - Transitions/animations
   - Hover/active states

5. Icons and Controls
   - Play/pause button appearance
   - Checkbox styles
   - Toggle arrow appearance
   - Button hover effects

6. Section Styling
   - Feed header backgrounds
   - Episode row backgrounds
   - Separator lines
   - Column header appearance

7. Player Controls
   - Audio player button colors
   - Progress bar colors
   - Volume control appearance

### Important Notes

- Do not modify any width-related properties (width, min-width, max-width) as these need to stay fixed for proper extension behavior
- The standalone version is purely for styling purposes and does not include actual functionality
- All styling should be done through CSS to ensure consistency between both versions