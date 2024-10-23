# ohms.js

ohms.js is a Javascript-based viewer for [Oral History Metadata Synchronizer (OHMS)](https://www.oralhistoryonline.org)
XML files.

## Usage

`ohms.html` is the viewer, and it takes the URL of the OHMS XML file to display as the `cachefile` query string parameter,
so `ohms.html?cachefile=example.xml` where `example.xml` is the XML file's URL. Relative and absolute URLs are both accepted.

### Customization

Additional query string parameters can be used to customize the viewer interface.

- `link_color`: sets the color used for links; pass a six-character hex color code without the leading `#`
- `metadata`: pass `none` to disable displaying the title and repository on the top of the viewer

## Cross-origin files and CORS

Loading OHMS XML files for display is subject to the same-origin policy. This isn't an issue if your files are on the
same domain as the ohms.js viewer, but if they're on a different domain, you'll need to make sure CORS headers
(i.e., `Access-Control-Allow-Origin`) are set by the server that hosts the XML files.
